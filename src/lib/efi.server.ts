// Efí (antiga Gerencianet) — helper SERVER ONLY.
// Usa a API de Cobranças (client_id + client_secret), que NÃO exige certificado
// nem abrir conta em banco específico: o saldo é sacado para a conta bancária
// da liga em qualquer banco (Nubank, Caixa, Santander, etc.).
//
// Docs: https://dev.efipay.com.br/docs/api-cobrancas

export type EfiCreds = { clientId: string; clientSecret: string; sandbox: boolean };

export function efiBase(sandbox: boolean) {
  return sandbox
    ? "https://cobrancas-h.api.efipay.com.br"
    : "https://cobrancas.api.efipay.com.br";
}

function basicAuth(clientId: string, clientSecret: string) {
  const raw = `${clientId}:${clientSecret}`;
  // btoa está disponível no runtime de workers
  return btoa(unescape(encodeURIComponent(raw)));
}

/** Obtém um access_token (client_credentials). */
export async function efiAuthorize(creds: EfiCreds): Promise<string> {
  const res = await fetch(`${efiBase(creds.sandbox)}/v1/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(creds.clientId, creds.clientSecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok || !json?.access_token) {
    const msg = json?.error_description || json?.message || text || `erro ${res.status}`;
    throw new Error(`Efí [${res.status}]: ${String(msg).slice(0, 300)}`);
  }
  return String(json.access_token);
}

async function efiFetch<T = any>(
  creds: EfiCreds,
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const token = opts.token ?? (await efiAuthorize(creds));
  const res = await fetch(`${efiBase(creds.sandbox)}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error_description || json?.errors?.[0]?.message || json?.message || text;
    throw new Error(`Efí [${res.status}]: ${String(msg).slice(0, 300)}`);
  }
  return json as T;
}

/** Valida as credenciais tentando autenticar. */
export async function validateEfiCredentials(creds: EfiCreds) {
  await efiAuthorize(creds);
  return { ok: true };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type EfiChargeResult = { payment_id: string; status: string; url: string };

/**
 * Cria um link de pagamento (Pix, cartão de crédito e boleto) na conta da liga.
 * `notificationUrl` recebe o token de notificação da Efí.
 */
export async function createEfiChargeLink(args: {
  creds: EfiCreds;
  amount: number;
  description: string;
  externalReference: string;
  notificationUrl?: string;
  payer?: { name?: string; email?: string };
  expireInDays?: number;
}): Promise<EfiChargeResult> {
  const cents = Math.max(1, Math.round(args.amount * 100));
  const body: any = {
    items: [
      {
        name: args.description.slice(0, 255) || "Pagamento",
        value: cents,
        amount: 1,
      },
    ],
    settings: {
      payment_method: "all",
      expire_at: isoDate(new Date(Date.now() + (args.expireInDays ?? 3) * 86400000)),
      request_delivery_address: false,
      message: args.description.slice(0, 255),
    },
    metadata: {
      custom_id: args.externalReference.slice(0, 255),
      ...(args.notificationUrl ? { notification_url: args.notificationUrl } : {}),
    },
  };

  const r = await efiFetch<any>(args.creds, "/v1/charge/one-step/link", {
    method: "POST",
    body,
  });
  const d = r?.data ?? {};
  const url = d.payment_url ?? d.link ?? d.payment?.link;
  if (!url) throw new Error("Efí não retornou o link de pagamento.");
  return {
    payment_id: String(d.charge_id ?? d.id ?? ""),
    status: String(d.status ?? "new"),
    url: String(url),
  };
}

export async function getEfiCharge(creds: EfiCreds, chargeId: string) {
  const r = await efiFetch<any>(creds, `/v1/charge/${chargeId}`);
  return r?.data ?? null;
}

/** Consulta as atualizações associadas a um token de notificação. */
export async function getEfiNotification(creds: EfiCreds, token: string) {
  const r = await efiFetch<any>(creds, `/v1/notification/${token}`);
  return (r?.data ?? []) as any[];
}

/** Traduz status da Efí para o vocabulário do app (padrão Mercado Pago). */
export function normalizeEfiStatus(status?: string): string {
  const s = String(status ?? "").toLowerCase();
  if (["paid", "settled"].includes(s)) return "approved";
  if (["refunded", "contested"].includes(s)) return "refunded";
  if (["canceled", "cancelled", "expired"].includes(s)) return "cancelled";
  if (["unpaid"].includes(s)) return "rejected";
  return "pending";
}
