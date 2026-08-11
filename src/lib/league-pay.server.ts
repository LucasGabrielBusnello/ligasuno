// Camada única de pagamento das ligas — SERVER ONLY.
// A liga escolhe o provedor: "mercadopago" (confirmação automática)
// ou "infinitepay" (link de checkout, sem confirmação automática).

import { createPixPayment, getPayment, loadLeagueMpAccount } from "@/lib/mp.server";
import { buildCheckoutUrl, checkPaymentByNsu } from "@/lib/infinitepay.server";

export type LeagueProvider = "mercadopago" | "infinitepay";

export type LeaguePaymentSetup =
  | { provider: "mercadopago"; accessToken: string }
  | { provider: "infinitepay"; handle: string };

export async function loadLeaguePaymentSetup(
  supabaseAdmin: any,
  leagueId: string,
): Promise<LeaguePaymentSetup> {
  const { data: league } = await supabaseAdmin
    .from("leagues").select("payment_provider").eq("id", leagueId).maybeSingle();
  const provider: LeagueProvider =
    league?.payment_provider === "infinitepay" ? "infinitepay" : "mercadopago";

  if (provider === "infinitepay") {
    const { data } = await (supabaseAdmin as any)
      .from("league_infinitepay_accounts").select("handle").eq("league_id", leagueId).maybeSingle();
    if (!data?.handle) {
      throw new Error("Esta liga ainda não conectou a conta InfinitePay. O presidente precisa conectar antes de aceitar pagamentos.");
    }
    return { provider: "infinitepay", handle: String(data.handle) };
  }

  const mp = await loadLeagueMpAccount(supabaseAdmin, leagueId);
  return { provider: "mercadopago", accessToken: String((mp as any).access_token) };
}

export type UnifiedPixResult = {
  provider: LeagueProvider;
  payment_id: string;
  status: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  expires_at?: string;
};

function originOf(url: string): string {
  try { return new URL(url).origin; } catch { return ""; }
}

/** Cria uma cobrança na conta da liga, no provedor configurado. */
export async function createLeaguePix(args: {
  supabaseAdmin: any;
  leagueId: string;
  amount: number;
  description: string;
  externalReference: string;
  notificationUrl: string;
  payer: { email: string; firstName: string; lastName: string; cpf: string };
  applicationFee?: number;
  metadata?: Record<string, any>;
  expiresInMinutes?: number;
}): Promise<UnifiedPixResult> {
  const setup = await loadLeaguePaymentSetup(args.supabaseAdmin, args.leagueId);

  if (setup.provider === "infinitepay") {
    const origin = originOf(args.notificationUrl);
    const url = await buildCheckoutUrl({
      handle: setup.handle,
      items: [{ description: args.description, quantity: 1, price: Math.round(args.amount * 100) }],
      orderNsu: args.externalReference,
      redirectUrl: origin || "https://ligasuno.com.br",
      webhookUrl: args.notificationUrl,
      customerName: `${args.payer.firstName} ${args.payer.lastName}`.trim(),
      customerEmail: args.payer.email,
    });
    return {
      provider: "infinitepay",
      payment_id: args.externalReference,
      status: "pending",
      ticket_url: url,
    };
  }

  const pay = await createPixPayment({
    sellerAccessToken: setup.accessToken,
    amount: args.amount,
    description: args.description,
    payerEmail: args.payer.email,
    payerFirstName: args.payer.firstName,
    payerLastName: args.payer.lastName,
    payerCpf: args.payer.cpf,
    externalReference: args.externalReference,
    notificationUrl: args.notificationUrl,
    applicationFee: args.applicationFee ?? 0,
    metadata: args.metadata,
    expiresInMinutes: args.expiresInMinutes,
  });
  const tx = pay?.point_of_interaction?.transaction_data ?? {};
  return {
    provider: "mercadopago",
    payment_id: String(pay.id),
    status: String(pay.status),
    qr_code: tx.qr_code,
    qr_code_base64: tx.qr_code_base64,
    ticket_url: tx.ticket_url,
    expires_at: pay.date_of_expiration,
  };
}

/** Link de checkout completo (Pix + cartão) na conta da liga. */
export async function createLeagueCheckoutLink(args: {
  supabaseAdmin: any;
  leagueId: string;
  amount: number;
  description: string;
  externalReference: string;
  payer: { name: string; cpf: string; email?: string };
}): Promise<{ provider: LeagueProvider; payment_id: string; url: string } | null> {
  const setup = await loadLeaguePaymentSetup(args.supabaseAdmin, args.leagueId);
  if (setup.provider !== "infinitepay") return null;
  const url = await buildCheckoutUrl({
    handle: setup.handle,
    items: [{ description: args.description, quantity: 1, price: Math.round(args.amount * 100) }],
    orderNsu: args.externalReference,
    redirectUrl: "https://ligasuno.com.br",
    webhookUrl: "https://ligasuno.com.br/api/public/payments/infinitepay-webhook",
    customerName: args.payer.name,
    customerEmail: args.payer.email,
  });
  return { provider: "infinitepay", payment_id: args.externalReference, url };
}

/** Consulta o status de um pagamento no provedor da liga (normalizado ao padrão MP). */
export async function getLeaguePaymentStatus(
  supabaseAdmin: any,
  leagueId: string,
  paymentId: string,
): Promise<string | null> {
  try {
    const setup = await loadLeaguePaymentSetup(supabaseAdmin, leagueId);
    if (setup.provider === "infinitepay") {
      const r = await checkPaymentByNsu(setup.handle, String(paymentId));
      return r.paid ? "approved" : "pending";
    }
    const pay = await getPayment(String(paymentId), setup.accessToken);
    return pay?.status ?? null;
  } catch (e) {
    console.error("getLeaguePaymentStatus falhou", e);
    return null;
  }
}
