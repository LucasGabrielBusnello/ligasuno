import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/** Status do recebimento da liga (Mercado Pago ou InfinitePay). */
export const getLeaguePaymentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);

    const [{ data: league }, { data: mp }, { data: ipay }] = await Promise.all([
      supabaseAdmin.from("leagues").select("payment_provider").eq("id", data.league_id).maybeSingle(),
      supabaseAdmin.from("league_mp_accounts").select("league_id, nickname, connected_at")
        .eq("league_id", data.league_id).maybeSingle(),
      (supabaseAdmin as any).from("league_infinitepay_accounts")
        .select("handle, connected_at").eq("league_id", data.league_id).maybeSingle(),
    ]);

    return {
      provider: (league as any)?.payment_provider === "infinitepay" ? "infinitepay" : "mercadopago",
      mp: mp ? { nickname: (mp as any).nickname, connected_at: (mp as any).connected_at } : null,
      infinitepay: ipay ?? null,
    };
  });

/** Conecta a conta InfinitePay da liga (handle @). */
export const connectLeagueInfinitepay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    handle: z.string().min(2).max(80),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);

    const handle = data.handle.trim().replace(/^@/, "").replace(/\s+/g, "");
    if (!handle) throw new Error("Informe o handle da InfinitePay.");

    await (supabaseAdmin as any).from("league_infinitepay_accounts").upsert({
      league_id: data.league_id,
      handle,
      connected_at: new Date().toISOString(),
    }, { onConflict: "league_id" });

    await supabaseAdmin.from("leagues")
      .update({ payment_provider: "infinitepay" } as any).eq("id", data.league_id);

    return { ok: true, handle };
  });

export const disconnectLeagueInfinitepay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);
    await (supabaseAdmin as any).from("league_infinitepay_accounts")
      .delete().eq("league_id", data.league_id);
    await supabaseAdmin.from("leagues")
      .update({ payment_provider: "mercadopago" } as any).eq("id", data.league_id);
    return { ok: true };
  });

/** Define qual provedor a liga usa para receber. */
export const setLeaguePaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    provider: z.enum(["mercadopago", "infinitepay"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPresident(supabaseAdmin, data.league_id, context.userId);

    if (data.provider === "infinitepay") {
      const { data: acc } = await (supabaseAdmin as any)
        .from("league_infinitepay_accounts").select("league_id")
        .eq("league_id", data.league_id).maybeSingle();
      if (!acc) throw new Error("Conecte a conta InfinitePay antes de selecioná-la.");
    } else {
      const { data: acc } = await supabaseAdmin
        .from("league_mp_accounts").select("league_id").eq("league_id", data.league_id).maybeSingle();
      if (!acc) throw new Error("Conecte a conta Mercado Pago antes de selecioná-la.");
    }

    await supabaseAdmin.from("leagues")
      .update({ payment_provider: data.provider } as any).eq("id", data.league_id);
    return { ok: true };
  });
