import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPresident(supabaseAdmin: any, leagueId: string, userId: string) {
  const { data: league } = await supabaseAdmin
    .from("leagues").select("president_id, president2_id").eq("id", leagueId).maybeSingle();
  const isPresident = league && (league.president_id === userId || league.president2_id === userId);
  if (!isPresident) {
    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin_master", { _user_id: userId });
    if (!isAdmin) throw new Error("Apenas o presidente da liga pode alterar o recebimento.");
  }
}

/** Conecta a conta Efí (Gerencianet) da liga. O saque cai em qualquer banco. */
export const connectLeagueEfi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    client_id: z.string().min(10).max(500),
    client_secret: z.string().min(10).max(500),
    sandbox: z.boolean().optional(),
    account_name: z.string().max(120).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);

    const [{ validateEfiCredentials }, { encryptString }] = await Promise.all([
      import("@/lib/efi.server"),
      import("@/lib/crypto.server"),
    ]);

    const creds = {
      clientId: data.client_id.trim(),
      clientSecret: data.client_secret.trim(),
      sandbox: !!data.sandbox,
    };
    await validateEfiCredentials(creds); // falha se as credenciais forem inválidas

    await (supabaseAdmin as any).from("league_efi_accounts").upsert({
      league_id: data.league_id,
      client_id_encrypted: await encryptString(creds.clientId),
      client_secret_encrypted: await encryptString(creds.clientSecret),
      account_name: data.account_name?.trim() || null,
      sandbox: creds.sandbox,
      connected_at: new Date().toISOString(),
    }, { onConflict: "league_id" });

    await supabaseAdmin.from("leagues")
      .update({ payment_provider: "efi" } as any).eq("id", data.league_id);

    return { ok: true, sandbox: creds.sandbox };
  });

export const disconnectLeagueEfi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);
    await (supabaseAdmin as any).from("league_efi_accounts").delete().eq("league_id", data.league_id);
    const { data: league } = await supabaseAdmin
      .from("leagues").select("payment_provider").eq("id", data.league_id).maybeSingle();
    if ((league as any)?.payment_provider === "efi") {
      await supabaseAdmin.from("leagues")
        .update({ payment_provider: "mercadopago" } as any).eq("id", data.league_id);
    }
    return { ok: true };
  });
