import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://connector-gateway.lovable.dev/stripe";

function getStripeConnectionKey() {
  return process.env.STRIPE_LIVE_API_KEY ?? process.env.STRIPE_SANDBOX_API_KEY;
}

const schema = z.object({
  minicourse_id: z.string().uuid(),
  payment_method: z.enum(["card", "pix"]).default("card"),
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
      .eq("id", data.minicourse_id)
      .maybeSingle();
    if (mcErr || !mc) throw new Error("Minicurso não encontrado");
    if (!(mc as any).published) throw new Error("Minicurso indisponível");

    // Capacidade
    const { count } = await supabaseAdmin
      .from("minicourse_registrations")
      .select("id", { count: "exact", head: true })
      .eq("minicourse_id", data.minicourse_id)
      .in("status", ["paid", "pending"]);
    const max = Number((mc as any).max_registrations) || 0;
    if (max > 0 && (count ?? 0) >= max) throw new Error("Vagas esgotadas");

    // Precisa estar inscrito no evento
    const eventId = (mc as any).event_id;
    const { data: evReg } = await supabaseAdmin
      .from("event_registrations")
      .select("id,status")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!evReg || (evReg as any).status !== "paid") {
      throw new Error("Você precisa estar inscrito (e pago) no evento para acessar os minicursos.");
    }

    const isFree = !!(mc as any).is_free || Number((mc as any).price) <= 0;
    const price = isFree ? 0 : Number((mc as any).price);

    // upsert registration
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("minicourse_registrations")
      .upsert({
        minicourse_id: data.minicourse_id,
        user_id: userId,
        event_registration_id: (evReg as any).id,
        paid_price: price,
        status: isFree ? "paid" : "pending",
      }, { onConflict: "minicourse_id,user_id" } as any)
      .select("*")
      .single();
    if (regErr || !reg) throw new Error(regErr?.message || "Falha ao registrar");

    if (isFree) return { free: true, registration_id: (reg as any).id };

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const STRIPE_KEY = getStripeConnectionKey();
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!STRIPE_KEY) throw new Error("Integração de pagamentos não configurada");

    const ev: any = (mc as any).league_events;
    const slug = ev.leagues.slug;
    const origin = data.origin_url.replace(/\/$/, "");
    const successUrl = `${origin}/${slug}?event=${eventId}&mc_paid=1`;
    const cancelUrl = `${origin}/${slug}?event=${eventId}`;

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email,full_name").eq("id", userId).maybeSingle();
    const email = (prof as any)?.email;

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("payment_method_types[]", data.payment_method);
    if (data.payment_method === "pix") {
      params.append("payment_method_options[pix][expires_after_seconds]", "3600");
    }
    if (email) params.append("customer_email", email);
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "brl");
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(price * 100)));
    params.append("line_items[0][price_data][product_data][name]", `Minicurso: ${(mc as any).title} — ${ev.title}`);
    params.append("metadata[minicourse_registration_id]", (reg as any).id);
    params.append("metadata[minicourse_id]", data.minicourse_id);
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
      const message = session?.error?.message ?? JSON.stringify(session);
      if (typeof message === "string" && message.toLowerCase().includes("pix")) {
        throw new Error("Pix ainda não está habilitado na conta de pagamentos conectada. Ative o Pix nas configurações da conta para liberar esse método.");
      }
      throw new Error(`Stripe falhou [${res.status}]: ${message}`);
    }

    await supabaseAdmin.from("minicourse_registrations")
      .update({ stripe_session_id: session.id })
      .eq("id", (reg as any).id);

    return { free: false, registration_id: (reg as any).id, url: session.url as string };
  });
