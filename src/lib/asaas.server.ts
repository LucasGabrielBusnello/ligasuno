// Asaas — helper SERVER ONLY.
// Permite que a liga receba em QUALQUER banco: o Asaas é uma conta digital
// que aceita Pix, boleto e cartão e transfere para a conta bancária da liga.
//
// Autenticação: header `access_token` com a API Key da conta da liga.

import type { ProviderFeeTable } from "@/lib/payment-fees";

export function asaasBase(sandbox: boolean) {
  return sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

export function isSandboxKey(key: string) {
  return /hmlg/i.test(key);
}

export async function asaasFetch<T = any>(
  path: string,
  opts: { apiKey: string; sandbox?: boolean; method?: string; body?: unknown } ,
): Promise<T> {
  const sandbox = opts.sandbox ?? isSandboxKey(opts.apiKey);
  const res = await fetch(`${asaasBase(sandbox)}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      access_token: opts.apiKey,
      "Content-Type": "application/json",
      "User-Agent": "MEDUNO",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description || json?.message || text || `Asaas erro ${res.status}`;
    throw new Error(`Asaas [${res.status}]: ${String(msg).slice(0, 300)}`);
  }
  return json as T;
}

export async function getAsaasAccount(apiKey: string) {
  return asaasFetch<any>("/myAccount", { apiKey });
}

/** Taxas reais cobradas pela conta Asaas da liga. */
export async function getAsaasFees(apiKey: string): Promise<ProviderFeeTable> {
  const f = await asaasFetch<any>("/myAccount/fees", { apiKey });
  const p = f?.payment ?? {};
  const pix = p?.pix ?? {};
  const credit = p?.creditCard ?? {};
  const debit = p?.debitCard ?? {};
  const num = (v: any, fallback = 0) => (v === null || v === undefined || isNaN(Number(v)) ? fallback : Number(v));
  return {
    pix: {
      percent: num(pix.percentageFee ?? pix.creditPercentageFee, 0),
      fixed: num(pix.fixedFee ?? pix.creditFee, 0),
    },
    debit: {
      percent: num(debit.percentage ?? debit.operationPercentage, 0),
      fixed: num(debit.fee ?? debit.operationValue, 0),
    },
    credit: {
      percent: num(credit.oneInstallmentPercentage ?? credit.percentage, 0),
      fixed: num(credit.operationValue ?? credit.fee, 0),
    },
  };
}

/** Cria (ou reusa) o cliente pagador na conta Asaas da liga. */
export async function ensureAsaasCustomer(args: {
  apiKey: string;
  name: string;
  cpfCnpj: string;
  email?: string;
}): Promise<string> {
  const found = await asaasFetch<any>(`/customers?cpfCnpj=${encodeURIComponent(args.cpfCnpj)}&limit=1`, {
    apiKey: args.apiKey,
  }).catch(() => null);
  const existing = found?.data?.[0]?.id;
  if (existing) return String(existing);

  const created = await asaasFetch<any>("/customers", {
    apiKey: args.apiKey,
    method: "POST",
    body: {
      name: args.name.slice(0, 100),
      cpfCnpj: args.cpfCnpj,
      email: args.email,
      notificationDisabled: true,
    },
  });
  return String(created.id);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type AsaasPixResult = {
  payment_id: string;
  status: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  expires_at?: string;
};

/** Cobrança Pix com QR Code na conta da liga. */
export async function createAsaasPix(args: {
  apiKey: string;
  amount: number;
  description: string;
  externalReference: string;
  payer: { name: string; cpf: string; email?: string };
  expiresInMinutes?: number;
}): Promise<AsaasPixResult> {
  const customer = await ensureAsaasCustomer({
    apiKey: args.apiKey,
    name: args.payer.name,
    cpfCnpj: args.payer.cpf,
    email: args.payer.email,
  });

  const payment = await asaasFetch<any>("/payments", {
    apiKey: args.apiKey,
    method: "POST",
    body: {
      customer,
      billingType: "PIX",
      value: Math.round(args.amount * 100) / 100,
      dueDate: isoDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      description: args.description.slice(0, 500),
      externalReference: args.externalReference,
    },
  });

  const qr = await asaasFetch<any>(`/payments/${payment.id}/pixQrCode`, { apiKey: args.apiKey })
    .catch(() => null);

  return {
    payment_id: String(payment.id),
    status: String(payment.status ?? "PENDING"),
    qr_code: qr?.payload,
    qr_code_base64: qr?.encodedImage,
    ticket_url: payment.invoiceUrl,
    expires_at: qr?.expirationDate,
  };
}

/** Link de checkout (Pix + cartão de crédito/débito + boleto) na conta da liga. */
export async function createAsaasCheckout(args: {
  apiKey: string;
  amount: number;
  description: string;
  externalReference: string;
  payer: { name: string; cpf: string; email?: string };
  dueInDays?: number;
}): Promise<{ payment_id: string; url: string }> {
  const customer = await ensureAsaasCustomer({
    apiKey: args.apiKey,
    name: args.payer.name,
    cpfCnpj: args.payer.cpf,
    email: args.payer.email,
  });
  const payment = await asaasFetch<any>("/payments", {
    apiKey: args.apiKey,
    method: "POST",
    body: {
      customer,
      billingType: "UNDEFINED", // pagador escolhe Pix, cartão ou boleto
      value: Math.round(args.amount * 100) / 100,
      dueDate: isoDate(new Date(Date.now() + (args.dueInDays ?? 3) * 24 * 60 * 60 * 1000)),
      description: args.description.slice(0, 500),
      externalReference: args.externalReference,
    },
  });
  return { payment_id: String(payment.id), url: String(payment.invoiceUrl) };
}

export async function getAsaasPayment(apiKey: string, paymentId: string) {
  return asaasFetch<any>(`/payments/${paymentId}`, { apiKey });
}

/** Traduz status do Asaas para o vocabulário usado no app (padrão Mercado Pago). */
export function normalizeAsaasStatus(status?: string): string {
  const s = String(status ?? "").toUpperCase();
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(s)) return "approved";
  if (["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "REFUND_REQUESTED"].includes(s)) return "refunded";
  if (["OVERDUE"].includes(s)) return "pending";
  if (["DELETED", "CANCELLED"].includes(s)) return "cancelled";
  return "pending";
}
