import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Stripe sends events; on completed checkout, mark registration paid.
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const type = payload?.type as string | undefined;
        const obj = payload?.data?.object;

        try {
          if (type === "checkout.session.completed" || type === "transaction.completed") {
            const regId =
              obj?.metadata?.registration_id ||
              payload?.metadata?.registration_id;
            if (regId) {
              await supabaseAdmin
                .from("event_registrations")
                .update({ status: "paid" })
                .eq("id", regId);
            }
          }
        } catch (e) {
          console.error("webhook error", e);
          return new Response("error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
