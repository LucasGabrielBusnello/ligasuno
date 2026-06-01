import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeFee, createSplitPreference, loadFeeForCategory, loadLeagueMpAccount } from "@/lib/mp.server";

const PUBLISHED_URL = "https://ligasuno.lovable.app";
const WEBHOOK_URL = `${PUBLISHED_URL}/api/public/payments/mp-webhook`;

const schema = z.object({
  minicourse_id: z.string().uuid(),
  origin_url: z.string().url(),
});

export const createMinicourseCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: mc, error: mcErr } = await supabase
      .from("league_minicourses")
      .select("*, league_events!inner(id, title, league_id, leagues!inner(slug,name))")
      .eq("id", data.minicourse_id).maybeSingle();
    if (mcErr || !mc) throw new Error("Minicurso não encontrado");
    if (!(mc as any).published) throw new Error("Minicurso indisponível");

    const { count } = await supabaseAdmin
      .from("minicourse_registrations")
      .select("id", { count: "exact", head: true })
      .eq("minicourse_id", data.minicourse_id)
      .in("status", ["paid", "pending"]);
    const max = Number((mc as any).max_registrations) || 0;
    if (max > 0 && (count ?? 0) >= max) throw new Error("Vagas esgotadas");

    const eventId = (mc as any).event_id;
    const leagueId = (mc as any).league_events.league_id;
    const { data: evReg } = await supabaseAdmin
      .from("event_registrations").select("id,status")
      .eq("event_id", eventId).eq("user_id", userId).maybeSingle();
    if (!evReg || (evReg as any).status !== "paid") {
      throw new Error("Você precisa estar inscrito (e pago) no evento para acessar os minicursos.");
    }

    const isFree = !!(mc as any).is_free || Number((mc as any).price) <= 0;
    const price = isFree ? 0 : Number((mc as any).price);

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("minicourse_registrations")
      .upsert({
        minicourse_id: data.minicourse_id, user_id: userId,
        event_registration_id: (evReg as any).id, paid_price: price,
        status: isFree ? "paid" : "pending",
      }, { onConflict: "minicourse_id,user_id" } as any)
      .select("*").single();
    if (regErr || !reg) throw new Error(regErr?.message || "Falha ao registrar");

    if (isFree) return { free: true, registration_id: (reg as any).id };

    const mpAccount = await loadLeagueMpAccount(supabaseAdmin, leagueId);
    const feeCfg = await loadFeeForCategory(supabaseAdmin, "minicourse");
    const marketplaceFee = computeFee(price, feeCfg.pct, feeCfg.fixed);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();

    const ev: any = (mc as any).league_events;
    const slug = ev.leagues.slug;
    const origin = data.origin_url.replace(/\/$/, "");

    const pref = await createSplitPreference({
      sellerAccessToken: (mpAccount as any).access_token,
      title: `Minicurso: ${(mc as any).title} — ${ev.title}`,
      unitPrice: price,
      payerEmail: (prof as any)?.email,
      successUrl: `${origin}/${slug}?event=${eventId}&mc_paid=1`,
      failureUrl: `${origin}/${slug}?event=${eventId}`,
      marketplaceFee,
      externalReference: `minicourse:${(reg as any).id}`,
      notificationUrl: WEBHOOK_URL,
      metadata: { minicourse_registration_id: (reg as any).id, minicourse_id: data.minicourse_id, user_id: userId, league_id: leagueId },
      pixOnly: true,
    });

    await supabaseAdmin.from("minicourse_registrations")
      .update({ stripe_session_id: pref.id }).eq("id", (reg as any).id);

    return { free: false, registration_id: (reg as any).id, url: pref.init_point };
  });
