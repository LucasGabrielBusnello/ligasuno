// Camada única de pagamento das ligas — SERVER ONLY.
// A liga escolhe o provedor: "mercadopago" ou "asaas" (recebe em qualquer banco).

import { createPixPayment, getPayment, loadLeagueMpAccount } from "@/lib/mp.server";
import {
  createAsaasCheckout,
  createAsaasPix,
  getAsaasPayment,
  normalizeAsaasStatus,
} from "@/lib/asaas.server";
import { decryptString } from "@/lib/crypto.server";

export type LeagueProvider = "mercadopago" | "asaas" | "efi";

export type LeaguePaymentSetup =
  | { provider: "mercadopago"; accessToken: string }
  | { provider: "asaas"; apiKey: string; sandbox: boolean }
  | { provider: "efi"; clientId: string; clientSecret: string; sandbox: boolean };

export async function loadLeaguePaymentSetup(
  supabaseAdmin: any,
  leagueId: string,
): Promise<LeaguePaymentSetup> {
  const { data: league } = await supabaseAdmin
    .from("leagues").select("payment_provider").eq("id", leagueId).maybeSingle();
  const raw = league?.payment_provider;
  const provider: LeagueProvider =
    raw === "asaas" ? "asaas" : raw === "efi" ? "efi" : "mercadopago";

  if (provider === "efi") {
    const { data } = await supabaseAdmin
      .from("league_efi_accounts").select("*").eq("league_id", leagueId).maybeSingle();
    if (!data) {
      throw new Error("Esta liga ainda não conectou a conta Efí. O presidente precisa conectar antes de aceitar pagamentos.");
    }
    return {
      provider: "efi",
      clientId: await decryptString(String(data.client_id_encrypted)),
      clientSecret: await decryptString(String(data.client_secret_encrypted)),
      sandbox: !!data.sandbox,
    };
  }

  if (provider === "asaas") {
    const { data } = await supabaseAdmin
      .from("league_asaas_accounts").select("*").eq("league_id", leagueId).maybeSingle();
    if (!data) {
      throw new Error("Esta liga ainda não conectou a conta Asaas. O presidente precisa conectar antes de aceitar pagamentos.");
    }
    const apiKey = await decryptString(String(data.api_key_encrypted));
    return { provider: "asaas", apiKey, sandbox: !!data.sandbox };
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

/** Cria uma cobrança Pix na conta da liga, no provedor configurado. */
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

  if (setup.provider === "asaas") {
    const r = await createAsaasPix({
      apiKey: setup.apiKey,
      amount: args.amount,
      description: args.description,
      externalReference: args.externalReference,
      payer: {
        name: `${args.payer.firstName} ${args.payer.lastName}`.trim(),
        cpf: args.payer.cpf,
        email: args.payer.email,
      },
      expiresInMinutes: args.expiresInMinutes,
    });
    return { provider: "asaas", ...r, status: normalizeAsaasStatus(r.status) };
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
  if (setup.provider !== "asaas") return null;
  const r = await createAsaasCheckout({
    apiKey: setup.apiKey,
    amount: args.amount,
    description: args.description,
    externalReference: args.externalReference,
    payer: args.payer,
  });
  return { provider: "asaas", ...r };
}

/** Consulta o status de um pagamento no provedor da liga (normalizado ao padrão MP). */
export async function getLeaguePaymentStatus(
  supabaseAdmin: any,
  leagueId: string,
  paymentId: string,
): Promise<string | null> {
  try {
    const setup = await loadLeaguePaymentSetup(supabaseAdmin, leagueId);
    if (setup.provider === "asaas") {
      const p = await getAsaasPayment(setup.apiKey, paymentId);
      return normalizeAsaasStatus(p?.status);
    }
    const pay = await getPayment(String(paymentId), setup.accessToken);
    return pay?.status ?? null;
  } catch (e) {
    console.error("getLeaguePaymentStatus falhou", e);
    return null;
  }
}
