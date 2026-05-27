import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://connector-gateway.lovable.dev/stripe";

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

    // Determine category (ligante > partner > visitor)
    const { data: myMemberships } = await supabase
      .from("league_memberships")
      .select("league_id, role")
      .eq("user_id", userId);
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
      category = "ligante";
      paid = Number((event as any).price_ligante) || 0;
      discountReason = "Desconto exclusivo para ligantes da liga";
    } else if (isPartner) {
      category = "partner";
      paid = Number((event as any).price_partner) || 0;
      discountReason = "Desconto para integrantes de ligas parceiras";
    }

    // Upsert registration as pending
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("event_registrations")
      .upsert({
        event_id: data.event_id,
        user_id: userId,
        full_name: data.full_name,
        social_name: data.social_name || null,
        cpf: data.cpf,
        course: data.course,
        category,
        base_price: base,
        paid_price: paid,
        discount_reason: discountReason,
        status: paid === 0 ? "paid" : "pending",
      }, { onConflict: "event_id,user_id" })
      .select("*")
      .single();
    if (regErr || !reg) throw new Error(regErr?.message || "Falha ao registrar");

    if (paid === 0) {
      return { free: true, registration_id: reg.id };
    }

    // Create Stripe Checkout Session via gateway
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const STRIPE_KEY = process.env.STRIPE_SANDBOX_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!STRIPE_KEY) throw new Error("STRIPE_SANDBOX_API_KEY não configurada");

    const origin = data.origin_url.replace(/\/$/, "");
    const successUrl = `${origin}/${(event as any).leagues.slug}?event=${data.event_id}&paid=1`;
    const cancelUrl = `${origin}/${(event as any).leagues.slug}?event=${data.event_id}&paid=0`;

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "brl");
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(paid * 100)));
    params.append("line_items[0][price_data][product_data][name]", `${(event as any).title} — ${(event as any).leagues.name}`);
    params.append("metadata[registration_id]", reg.id);
    params.append("metadata[event_id]", data.event_id);
    params.append("metadata[user_id]", userId);

    const res = await fetch(`${GATEWAY}/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": STRIPE_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok) {
      throw new Error(`Stripe falhou [${res.status}]: ${JSON.stringify(session)}`);
    }

    await supabaseAdmin.from("event_registrations")
      .update({ stripe_session_id: session.id })
      .eq("id", reg.id);

    return { free: false, registration_id: reg.id, url: session.url as string };
  });
