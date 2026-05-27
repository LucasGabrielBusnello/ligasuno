import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://connector-gateway.lovable.dev/stripe";

const schema = z.object({
  league_id: z.string().uuid(),
  method: z.enum(["pix", "card"]),
  origin_url: z.string().url(),
});

const PRICE_AMOUNTS = { pix: 290, card: 330 } as const;
const METHOD_LABEL = { pix: "PIX", card: "Cartão" } as const;

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
    if (data.method === "pix") {
      // PIX não é suportado em subscription pelo Stripe em todos os países;
      // mantemos card como padrão para recorrência. Caso PIX, cobramos via cartão recorrente
      // exibindo o mesmo valor PIX por mês.
      params.append("payment_method_types[]", "card");
    } else {
      params.append("payment_method_types[]", "card");
    }
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "brl");
    params.append("line_items[0][price_data][recurring][interval]", "month");
    params.append("line_items[0][price_data][unit_amount]", String(PRICE_AMOUNTS[data.method]));
    params.append("line_items[0][price_data][product_data][name]", `Anuidade ${(league as any).name} (${METHOD_LABEL[data.method]})`);
    params.append("metadata[league_id]", data.league_id);
    params.append("metadata[method]", data.method);
    params.append("subscription_data[metadata][league_id]", data.league_id);
    params.append("subscription_data[metadata][method]", data.method);

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
