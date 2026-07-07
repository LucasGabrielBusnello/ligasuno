// Mercado Pago server helper — SERVER ONLY (uses MP_ACCESS_TOKEN).
// Never import this file from client code.

const MP_BASE = "https://api.mercadopago.com";

export function getPlatformAccessToken(): string {
  const t = (process.env.MP_ACCESS_TOKEN ?? "").trim();
  if (!t) throw new Error("MP_ACCESS_TOKEN não configurado (segredo vazio). Cadastre um access token válido do Mercado Pago (começa com APP_USR- ou TEST-).");
  if (!/^(APP_USR-|TEST-)/.test(t)) throw new Error("MP_ACCESS_TOKEN inválido: deve começar com APP_USR- (produção) ou TEST- (sandbox).");
  return t;
}


export function getOAuthCredentials() {
  const client_id = process.env.MP_CLIENT_ID;
  const client_secret = process.env.MP_CLIENT_SECRET;
  if (!client_id || !client_secret) throw new Error("MP_CLIENT_ID/SECRET não configurados");
  return { client_id, client_secret };
}

export type MpFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string; // override (e.g. presidente's token)
  idempotencyKey?: string;
};

export async function mpFetch<T = any>(path: string, opts: MpFetchOptions = {}): Promise<T> {
  const token = opts.accessToken ?? getPlatformAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (opts.idempotencyKey) headers["X-Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(`${MP_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = json?.message || json?.error || text || `MP error ${res.status}`;
    throw new Error(`Mercado Pago [${res.status}]: ${msg}`);
  }
  return json as T;
}

/**
 * Calcula a taxa que será retida pela plataforma para uma transação.
 * value = preço bruto pago pelo aluno.
 * Retorna { fee, net } onde fee vai pra plataforma e net vai pro presidente
 * (antes ainda das taxas do próprio MP, que são descontadas do recebedor).
 */
export function computeFee(value: number, pct: number, fixed: number): number {
  const fee = value * (Number(pct) || 0) / 100 + (Number(fixed) || 0);
  return Math.max(0, Math.round(fee * 100) / 100);
}

export type FeeCategory = "selection" | "semester" | "event" | "minicourse" | "atletica_event" | "atletica_product" | "atletica_membership";

export async function loadFeeForCategory(supabaseAdmin: any, category: FeeCategory) {
  const { data } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const s = data ?? {};
  switch (category) {
    case "selection": return { pct: Number(s.fee_selection_pct ?? 0), fixed: Number(s.fee_selection_fixed ?? 0) };
    case "semester":  return { pct: Number(s.fee_semester_pct ?? 0),  fixed: Number(s.fee_semester_fixed ?? 0) };
    case "event":     return { pct: Number(s.fee_event_pct ?? 0),     fixed: Number(s.fee_event_fixed ?? 0) };
    case "minicourse":return { pct: Number(s.fee_minicourse_pct ?? 0),fixed: Number(s.fee_minicourse_fixed ?? 0) };
    case "atletica_event":      return { pct: Number(s.fee_atletica_event_pct ?? 0),      fixed: Number(s.fee_atletica_event_fixed ?? 0) };
    case "atletica_product":    return { pct: Number(s.fee_atletica_product_pct ?? 0),    fixed: Number(s.fee_atletica_product_fixed ?? 0) };
    case "atletica_membership": return { pct: Number(s.fee_atletica_membership_pct ?? 0), fixed: Number(s.fee_atletica_membership_fixed ?? 0) };
  }
}


/**
 * Carrega o access_token do presidente para uma liga (precisa estar conectada).
 */
export async function loadLeagueMpAccount(supabaseAdmin: any, leagueId: string) {
  const { data } = await supabaseAdmin
    .from("league_mp_accounts")
    .select("*")
    .eq("league_id", leagueId)
    .maybeSingle();
  if (!data) throw new Error("Esta liga ainda não conectou o Mercado Pago. O presidente precisa conectar a conta antes de aceitar inscrições pagas.");
  return data;
}

/**
 * Cria preferência de Checkout Pro com split de marketplace.
 * Cobramos no access_token do presidente; marketplace_fee vai pra plataforma.
 */
export async function createSplitPreference(args: {
  sellerAccessToken: string;
  title: string;
  unitPrice: number;
  quantity?: number;
  payerEmail?: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl?: string;
  marketplaceFee: number;
  externalReference: string;
  notificationUrl: string;
  metadata?: Record<string, any>;
  pixOnly?: boolean;
}) {
  const body: any = {
    items: [{
      title: args.title.slice(0, 250),
      quantity: args.quantity ?? 1,
      unit_price: args.unitPrice,
      currency_id: "BRL",
    }],
    payer: args.payerEmail ? { email: args.payerEmail } : undefined,
    back_urls: {
      success: args.successUrl,
      failure: args.failureUrl,
      pending: args.pendingUrl ?? args.successUrl,
    },
    auto_return: "approved",
    marketplace_fee: args.marketplaceFee,
    marketplace: "MP-PLATFORM",
    external_reference: args.externalReference,
    notification_url: args.notificationUrl,
    metadata: args.metadata ?? {},
    statement_descriptor: "LIGASUNO",
    binary_mode: false,
  };
  if (args.pixOnly) {
    // Restringe a Checkout Pro ao PIX: exclui cartões, boleto, débito em conta.
    body.payment_methods = {
      excluded_payment_types: [
        { id: "credit_card" },
        { id: "debit_card" },
        { id: "ticket" },
        { id: "atm" },
      ],
      installments: 1,
      default_payment_method_id: "pix",
    };
  }
  return mpFetch<{ id: string; init_point: string; sandbox_init_point: string }>(
    "/checkout/preferences",
    { method: "POST", body, accessToken: args.sellerAccessToken },
  );
}

/**
 * Busca pagamentos no MP por external_reference usando o token do vendedor.
 * Útil para reconciliar quando o webhook ainda não chegou.
 */
export async function searchPaymentsByExternalRef(externalRef: string, sellerAccessToken: string) {
  const qs = new URLSearchParams({ external_reference: externalRef, sort: "date_created", criteria: "desc", limit: "5" });
  return mpFetch<any>(`/v1/payments/search?${qs.toString()}`, { accessToken: sellerAccessToken });
}

/**
 * Cria uma assinatura (preapproval) — usado para anuidade da plataforma (sem split).
 */
export async function createPreapproval(args: {
  payerEmail: string;
  amount: number;
  reason: string;
  backUrl: string;
  externalReference: string;
}) {
  return mpFetch<{ id: string; init_point: string; status: string }>(
    "/preapproval",
    {
      method: "POST",
      body: {
        reason: args.reason,
        external_reference: args.externalReference,
        payer_email: args.payerEmail,
        back_url: args.backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: args.amount,
          currency_id: "BRL",
        },
      },
    },
  );
}

export async function getPreapproval(id: string) {
  return mpFetch<any>(`/preapproval/${id}`);
}

export async function getPayment(id: string, accessToken?: string) {
  return mpFetch<any>(`/v1/payments/${id}`, { accessToken });
}

export async function getMerchantOrder(id: string, accessToken?: string) {
  return mpFetch<any>(`/merchant_orders/${id}`, { accessToken });
}

/**
 * Cria pagamento Pix direto na conta do vendedor (split via application_fee).
 * Retorna qr_code (copia e cola) + qr_code_base64 (imagem).
 */
export async function createPixPayment(args: {
  sellerAccessToken: string;
  amount: number;
  description: string;
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
  payerCpf: string;
  externalReference: string;
  notificationUrl: string;
  applicationFee: number;
  metadata?: Record<string, any>;
  expiresInMinutes?: number;
  idempotencyKey?: string;
}) {
  const exp = new Date(Date.now() + (args.expiresInMinutes ?? 30) * 60_000);
  // Formato ISO com offset (MP exige) → 2024-01-01T12:00:00.000-03:00
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -exp.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  const expIso = `${exp.getFullYear()}-${pad(exp.getMonth() + 1)}-${pad(exp.getDate())}T${pad(exp.getHours())}:${pad(exp.getMinutes())}:${pad(exp.getSeconds())}.000${sign}${oh}:${om}`;

  const body: any = {
    transaction_amount: Math.round(args.amount * 100) / 100,
    description: args.description.slice(0, 250),
    payment_method_id: "pix",
    payer: {
      email: args.payerEmail,
      first_name: args.payerFirstName,
      last_name: args.payerLastName,
      identification: { type: "CPF", number: args.payerCpf },
    },
    external_reference: args.externalReference,
    notification_url: args.notificationUrl,
    // application_fee só funciona com marketplace OAuth; omitido para evitar erro 400
    date_of_expiration: expIso,
    metadata: args.metadata ?? {},
    statement_descriptor: "LIGASUNO",
  };
  return mpFetch<any>("/v1/payments", {
    method: "POST",
    body,
    accessToken: args.sellerAccessToken,
    idempotencyKey: args.idempotencyKey ?? `${args.externalReference}-${Date.now()}`,
  });
}

/**
 * Preferência de Checkout Pro na conta da plataforma (aceita Pix + cartão de
 * crédito/débito + boleto). Sem marketplace_fee (o token já é da plataforma).
 * Retorna init_point para redirecionar o pagador.
 */
export async function createCheckoutPreference(args: {
  title: string;
  unitPrice: number;
  quantity?: number;
  payerEmail?: string;
  payerName?: string;
  payerCpf?: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl?: string;
  externalReference: string;
  notificationUrl: string;
  metadata?: Record<string, any>;
  maxInstallments?: number;
}) {
  const [firstName, ...rest] = String(args.payerName ?? "").split(" ");
  const body: any = {
    items: [{
      title: args.title.slice(0, 250),
      quantity: args.quantity ?? 1,
      unit_price: Math.round(args.unitPrice * 100) / 100,
      currency_id: "BRL",
    }],
    payer: args.payerEmail
      ? {
          email: args.payerEmail,
          name: firstName || undefined,
          surname: rest.join(" ") || undefined,
          identification: args.payerCpf
            ? { type: "CPF", number: String(args.payerCpf).replace(/\D/g, "") }
            : undefined,
        }
      : undefined,
    back_urls: {
      success: args.successUrl,
      failure: args.failureUrl,
      pending: args.pendingUrl ?? args.successUrl,
    },
    auto_return: "approved",
    external_reference: args.externalReference,
    notification_url: args.notificationUrl,
    metadata: args.metadata ?? {},
    statement_descriptor: "LIGASUNO",
    payment_methods: {
      installments: args.maxInstallments ?? 3,
    },
  };
  return mpFetch<{ id: string; init_point: string; sandbox_init_point: string }>(
    "/checkout/preferences",
    { method: "POST", body },
  );
}
