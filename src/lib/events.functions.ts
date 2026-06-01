import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";
import { computeFee, createSplitPreference, loadFeeForCategory, loadLeagueMpAccount } from "@/lib/mp.server";

const PUBLISHED_URL = "https://ligasuno.lovable.app";
const WEBHOOK_URL = `${PUBLISHED_URL}/api/public/payments/mp-webhook`;

const schema = z.object({
  event_id: z.string().uuid(),
  full_name: z.string().min(2).max(150),
  social_name: z.string().max(150).optional().nullable(),
  cpf: z.string().min(11).max(20),
  course: z.enum(["medicina", "enfermagem", "egresso_medicina", "outro", "egresso_outro"]),
  origin_url: z.string().url(),
});

export const createEventCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: event, error: evErr } = await supabase
      .from("league_events")
      .select("*, leagues!inner(id, name, slug)")
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr || !event) throw new Error("Evento não encontrado");

    const leagueId = (event as any).league_id;
    const partnerIds: string[] = (event as any).partner_league_ids ?? [];
    const normalizedCpf = normalizeCpf(data.cpf);
    if (!isValidCPF(normalizedCpf)) throw new Error("CPF inválido");

    const { data: myMemberships } = await supabase
      .from("league_memberships").select("league_id, role").eq("user_id", userId);
    const memberships = myMemberships ?? [];
    const isLigante = memberships.some(
      (m: any) => m.league_id === leagueId && ["ligante", "diretor", "presidente"].includes(m.role),
    );
    const isPartner = !isLigante && memberships.some(
      (m: any) => partnerIds.includes(m.league_id) && ["ligante", "diretor", "presidente"].includes(m.role),
    );

    let category: "ligante" | "partner" | "visitor" = "visitor";
    let base = Number((event as any).price_visitor) || 0;
    let paid = base;
    let discountReason: string | null = null;
    if (isLigante) {
      category = "ligante"; paid = Number((event as any).price_ligante) || 0;
      discountReason = "Desconto exclusivo para ligantes da liga";
    } else if (isPartner) {
      category = "partner"; paid = Number((event as any).price_partner) || 0;
      discountReason = "Desconto para integrantes de ligas parceiras";
    }

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("event_registrations")
      .upsert({
        event_id: data.event_id, user_id: userId,
        full_name: data.full_name, social_name: data.social_name || null,
        cpf: normalizedCpf, course: data.course, category,
        base_price: base, paid_price: paid, discount_reason: discountReason,
        status: paid === 0 ? "paid" : "pending",
      }, { onConflict: "event_id,user_id" })
      .select("*").single();
    if (regErr || !reg) throw new Error(regErr?.message || "Falha ao registrar");

    if (paid === 0) return { free: true, registration_id: reg.id };

    // Carrega conta MP da liga + taxa configurada
    const mpAccount = await loadLeagueMpAccount(supabaseAdmin, leagueId);
    const feeCfg = await loadFeeForCategory(supabaseAdmin, "event");
    const marketplaceFee = computeFee(paid, feeCfg.pct, feeCfg.fixed);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();

    const origin = data.origin_url.replace(/\/$/, "");
    const slug = (event as any).leagues.slug;

    const pref = await createSplitPreference({
      sellerAccessToken: (mpAccount as any).access_token,
      title: `${(event as any).title} — ${(event as any).leagues.name}`,
      unitPrice: paid,
      payerEmail: (prof as any)?.email,
      successUrl: `${origin}/${slug}?event=${data.event_id}&paid=1`,
      failureUrl: `${origin}/${slug}?event=${data.event_id}&paid=0`,
      marketplaceFee,
      externalReference: `event:${reg.id}`,
      notificationUrl: WEBHOOK_URL,
      metadata: { registration_id: reg.id, event_id: data.event_id, user_id: userId, league_id: leagueId },
    });

    await supabaseAdmin.from("event_registrations")
      .update({ stripe_session_id: pref.id }).eq("id", reg.id);

    return { free: false, registration_id: reg.id, url: pref.init_point };
  });
