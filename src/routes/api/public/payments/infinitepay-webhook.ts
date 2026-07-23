import { createFileRoute } from "@tanstack/react-router";
import {
  handleAthleticMembership,
  handleAthleticEventTicket,
  handleAthleticProductOrder,
} from "./mp-webhook";

/**
 * Webhook InfinitePay — Checkout Integrado.
 * O payload varia; extraímos o essencial: order_nsu (ou order_id / receipt.order_nsu),
 * status/paid, e valor pago. Se o webhook_secret estiver configurado por atlética,
 * validamos via HMAC-SHA256 do corpo cru contra o header `x-signature`.
 */
export const Route = createFileRoute("/api/public/payments/infinitepay-webhook")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "content-type, x-signature",
            "access-control-allow-methods": "POST, OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: any = {};
        try { body = JSON.parse(raw); } catch { /* pode vir vazio */ }

        // Extrai order_nsu (external reference no formato ath_memb:<id>, ath_event:<id>, ath_prod:<id>)
        const nsu: string | undefined =
          body?.order_nsu ??
          body?.orderNsu ??
          body?.receipt?.order_nsu ??
          body?.data?.order_nsu ??
          body?.transaction?.order_nsu ??
          body?.order?.nsu ??
          undefined;

        if (!nsu || !nsu.includes(":")) {
          console.warn("[infinitepay] webhook sem order_nsu válido", body);
          return new Response("ok", { status: 200 });
        }

        const [category, refId] = nsu.split(":");
        if (!category || !refId) return new Response("ok", { status: 200 });

        // Validação opcional de assinatura por atlética
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { decryptString } = await import("@/lib/crypto.server");
          const { hmacSha256Hex, timingSafeEqualHex } = await import("@/lib/infinitepay.server");

          let athleticId: string | null = null;
          if (category === "ath_memb") {
            const { data } = await supabaseAdmin
              .from("athletic_membership_payments").select("athletic_id").eq("id", refId).maybeSingle();
            athleticId = (data as any)?.athletic_id ?? null;
          } else if (category === "ath_event") {
            const { data } = await supabaseAdmin
              .from("athletic_event_tickets").select("athletic_id: event_id").eq("id", refId).maybeSingle();
            // fallback: pegar via evento
            if ((data as any)?.event_id || (data as any)?.athletic_id) {
              const evId = (data as any).event_id;
              if (evId) {
                const { data: ev } = await supabaseAdmin.from("athletic_events").select("athletic_id").eq("id", evId).maybeSingle();
                athleticId = (ev as any)?.athletic_id ?? null;
              }
            }
          } else if (category === "ath_prod") {
            const { data } = await supabaseAdmin
              .from("athletic_product_orders").select("athletic_id").eq("id", refId).maybeSingle();
            athleticId = (data as any)?.athletic_id ?? null;
          }

          if (athleticId) {
            const { data: acc } = await supabaseAdmin
              .from("athletic_infinitepay_accounts")
              .select("webhook_secret_encrypted").eq("athletic_id", athleticId).maybeSingle();
            const enc = (acc as any)?.webhook_secret_encrypted as string | null | undefined;
            if (enc) {
              const secret = await decryptString(enc);
              const sigHeader = request.headers.get("x-signature") ?? request.headers.get("x-infinitepay-signature") ?? "";
              const provided = sigHeader.replace(/^sha256=/, "").trim();
              const expected = await hmacSha256Hex(secret, raw);
              if (!provided || !timingSafeEqualHex(provided.toLowerCase(), expected.toLowerCase())) {
                console.warn("[infinitepay] assinatura inválida");
                return new Response("invalid signature", { status: 401 });
              }
            }
          }
        } catch (e) {
          console.warn("[infinitepay] erro validação de assinatura", e);
        }

        const paid: boolean =
          body?.paid === true ||
          body?.status === "paid" ||
          body?.status === "approved" ||
          body?.transaction?.status === "paid" ||
          body?.receipt?.paid === true;

        const grossAmount: number =
          Number(body?.amount ?? body?.paid_amount ?? body?.receipt?.amount ?? body?.transaction?.amount ?? 0) / 100 || 0;

        const providerId: string = String(
          body?.transaction_nsu ?? body?.receipt?.transaction_nsu ?? body?.id ?? body?.transaction?.id ?? nsu,
        );

        try {
          if (category === "ath_memb") {
            await handleAthleticMembership(refId, paid, providerId, grossAmount);
          } else if (category === "ath_event") {
            await handleAthleticEventTicket(refId, paid, providerId, grossAmount);
          } else if (category === "ath_prod") {
            await handleAthleticProductOrder(refId, paid, providerId, grossAmount);
          }
        } catch (e) {
          console.error("[infinitepay] falha ao processar", e);
          return new Response("error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
