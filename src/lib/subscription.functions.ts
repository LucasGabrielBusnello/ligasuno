import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://connector-gateway.lovable.dev/stripe";

const schema = z.object({
  league_id: z.string().uuid(),
  origin_url: z.string().url(),
});

export const createLeagueSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: league, error: lErr } = await supabase
      .from("leagues")
      .select("id, name, slug, president_id")
      .eq("id", data.league_id)
      .maybeSingle();
    if (lErr || !league) throw new Error("Liga não encontrada");
    if ((league as any).president_id !== userId) throw new Error("Apenas a presidência pode pagar a anuidade");

    // Lê valor atual sempre do banco — admin pode alterar no painel
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("annual_fee_credit_monthly")
      .eq("id", 1)
      .maybeSingle();
    const monthly = Number(settings?.annual_fee_credit_monthly ?? 0.05);
    const unitAmount = Math.max(1, Math.round(monthly * 100)); // mínimo 1 centavo

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const STRIPE_KEY = process.env.STRIPE_SANDBOX_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!STRIPE_KEY) throw new Error("STRIPE_SANDBOX_API_KEY não configurada");

    const origin = data.origin_url.replace(/\/$/, "");
    const successUrl = `${origin}/presidente/${(league as any).slug}?anuidade=ok`;
    const cancelUrl = `${origin}/presidente/${(league as any).slug}?anuidade=cancel`;

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "brl");
    params.append("line_items[0][price_data][recurring][interval]", "month");
    params.append("line_items[0][price_data][unit_amount]", String(unitAmount));
    params.append("line_items[0][price_data][product_data][name]", `Anuidade ${(league as any).name} (Cartão)`);
    params.append("metadata[league_id]", data.league_id);
    params.append("subscription_data[metadata][league_id]", data.league_id);
    // Anuidade parcelada: marca para o webhook aplicar cancel_at de 12 ciclos
    params.append("subscription_data[metadata][cancel_after_months]", "12");



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

    return { url: session.url as string };
  });
