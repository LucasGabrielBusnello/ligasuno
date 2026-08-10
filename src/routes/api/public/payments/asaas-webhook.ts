import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do Asaas.
 * Corpo: { event: "PAYMENT_RECEIVED", payment: {...} }.
 * Segurança: se ASAAS_WEBHOOK_TOKEN estiver configurado, o header
 * `asaas-access-token` precisa bater (é o token que o Asaas envia).
 */
export const Route = createFileRoute("/api/public/payments/asaas-webhook")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
        if (expected) {
          const got = request.headers.get("asaas-access-token");
          if (got !== expected) return new Response("invalid token", { status: 401 });
        }

        let payload: any = {};
        try { payload = await request.json(); } catch { /* ignora corpo vazio */ }

        try {
          const payment = payload?.payment;
          const externalRef: string | undefined = payment?.externalReference;
          if (!payment || !externalRef) return new Response("ok");

          const [category, refId] = String(externalRef).split(":");
          if (!category || !refId) return new Response("ok");

          const [{ normalizeAsaasStatus }, { settleLeaguePayment }] = await Promise.all([
            import("@/lib/asaas.server"),
            import("@/lib/payment-settlement.server"),
          ]);

          const gross = Number(payment?.value ?? 0);
          const net = Number(payment?.netValue ?? gross);
          const fee = Math.max(0, Math.round((gross - net) * 100) / 100);

          await settleLeaguePayment({
            category,
            refId,
            paymentId: String(payment.id),
            status: normalizeAsaasStatus(payment?.status),
            grossAmount: gross,
            feeAmount: fee,
            method: String(payment?.billingType ?? "").toLowerCase() || null,
            raw: payload,
          });
        } catch (e) {
          console.error("Asaas webhook error", e);
          return new Response("ok-with-error", { status: 200 });
        }

        return new Response("ok");
      },
    },
  },
});
