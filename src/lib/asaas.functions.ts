import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProviderFeeTable } from "@/lib/payment-fees";

async function assertPresident(supabaseAdmin: any, leagueId: string, userId: string) {
  const { data: league } = await supabaseAdmin
    .from("leagues").select("president_id, president2_id").eq("id", leagueId).maybeSingle();
  const isPresident = league && (league.president_id === userId || league.president2_id === userId);
  if (!isPresident) {
    const { data: isAdmin } = await supabaseAdmin
      .rpc("is_admin_master", { _user_id: userId });
    if (!isAdmin) throw new Error("Apenas o presidente da liga pode alterar o recebimento.");
  }
}

/** Status do recebimento da liga + comparativo de taxas (provedor + taxa da plataforma). */
export const getLeaguePaymentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadFeeForCategory } = await import("@/lib/mp.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);

    const [{ data: league }, { data: mp }, { data: asaas }, { data: efi }] = await Promise.all([
      supabaseAdmin.from("leagues").select("payment_provider").eq("id", data.league_id).maybeSingle(),
      supabaseAdmin.from("league_mp_accounts").select("league_id, user_id_mp, nickname, connected_at")
        .eq("league_id", data.league_id).maybeSingle(),
      (supabaseAdmin as any).from("league_asaas_accounts")
        .select("account_name, account_email, sandbox, connected_at")
        .eq("league_id", data.league_id).maybeSingle(),
      (supabaseAdmin as any).from("league_efi_accounts")
        .select("account_name, sandbox, connected_at")
        .eq("league_id", data.league_id).maybeSingle(),
    ]);


    const categories = ["event", "minicourse", "selection", "semester"] as const;
    const platformFees: Record<string, { pct: number; fixed: number }> = {};
    for (const c of categories) {
      platformFees[c] = (await loadFeeForCategory(supabaseAdmin, c)) as any;
    }

    let asaasFees: ProviderFeeTable | null = null;
    let asaasError: string | null = null;
    if (asaas) {
      try {
        const [{ decryptString }, { getAsaasFees }] = await Promise.all([
          import("@/lib/crypto.server"),
          import("@/lib/asaas.server"),
        ]);
        const { data: row } = await (supabaseAdmin as any)
          .from("league_asaas_accounts").select("api_key_encrypted")
          .eq("league_id", data.league_id).maybeSingle();
        asaasFees = await getAsaasFees(await decryptString(String(row.api_key_encrypted)));
      } catch (e: any) {
        asaasError = e?.message ?? "Não foi possível ler as taxas do Asaas.";
      }
    }

    const rawProvider = (league as any)?.payment_provider;
    return {
      provider:
        rawProvider === "asaas" ? "asaas" : rawProvider === "efi" ? "efi" : "mercadopago",
      mp: mp ? { nickname: (mp as any).nickname, connected_at: (mp as any).connected_at } : null,
      asaas: asaas ?? null,
      efi: efi ?? null,
      asaasFees,
      asaasError,
      platformFees,
    };

  });

/** Conecta a conta Asaas da liga (API Key). Recebimento cai em qualquer banco. */
export const connectLeagueAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    api_key: z.string().min(20).max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);

    const [{ getAsaasAccount, isSandboxKey }, { encryptString }] = await Promise.all([
      import("@/lib/asaas.server"),
      import("@/lib/crypto.server"),
    ]);

    const apiKey = data.api_key.trim();
    const account = await getAsaasAccount(apiKey); // valida a chave

    await (supabaseAdmin as any).from("league_asaas_accounts").upsert({
      league_id: data.league_id,
      api_key_encrypted: await encryptString(apiKey),
      account_name: account?.name ?? account?.companyName ?? null,
      account_email: account?.email ?? null,
      wallet_id: account?.walletId ?? null,
      sandbox: isSandboxKey(apiKey),
      connected_at: new Date().toISOString(),
    }, { onConflict: "league_id" });

    await supabaseAdmin.from("leagues")
      .update({ payment_provider: "asaas" } as any).eq("id", data.league_id);

    return { ok: true, account_name: account?.name ?? null, sandbox: isSandboxKey(apiKey) };
  });

export const disconnectLeagueAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);
    await (supabaseAdmin as any).from("league_asaas_accounts").delete().eq("league_id", data.league_id);
    await supabaseAdmin.from("leagues")
      .update({ payment_provider: "mercadopago" } as any).eq("id", data.league_id);
    return { ok: true };
  });

/** Define qual provedor a liga usa para receber. */
export const setLeaguePaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    provider: z.enum(["mercadopago", "asaas"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);

    if (data.provider === "asaas") {
      const { data: acc } = await (supabaseAdmin as any)
        .from("league_asaas_accounts").select("league_id").eq("league_id", data.league_id).maybeSingle();
      if (!acc) throw new Error("Conecte a conta Asaas antes de selecioná-la.");
    } else {
      const { data: acc } = await supabaseAdmin
        .from("league_mp_accounts").select("league_id").eq("league_id", data.league_id).maybeSingle();
      if (!acc) throw new Error("Conecte a conta Mercado Pago antes de selecioná-la.");
    }

    await supabaseAdmin.from("leagues")
      .update({ payment_provider: data.provider } as any).eq("id", data.league_id);
    return { ok: true };
  });
