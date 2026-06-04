import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook handler para Stripe via gateway Lovable.
// Trata pagamentos de inscrição em evento e assinatura de anuidade da liga.
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
        const obj = payload?.data?.object ?? payload?.object ?? {};

        try {
          // === EVENTO: inscrição paga ===
          if (type === "checkout.session.completed" || type === "transaction.completed") {
            const regId = obj?.metadata?.registration_id || payload?.metadata?.registration_id;
            if (regId) {
              const { data: reg } = await supabaseAdmin
                .from("event_registrations")
                .update({ status: "paid" })
                .eq("id", regId)
                .select("*, league_events!inner(id, title, league_id, event_date)")
                .single();

              if (reg) {
                const ev: any = (reg as any).league_events;
                // Notificar presidente
                await supabaseAdmin.from("league_notifications").insert({
                  league_id: ev.league_id,
                  title: "Nova inscrição paga",
                  message: `${(reg as any).full_name} confirmou inscrição em ${ev.title}.`,
                });
              }
            }

            // === MINICURSO: inscrição paga ===
            const mcRegId = obj?.metadata?.minicourse_registration_id || payload?.metadata?.minicourse_registration_id;
            if (mcRegId) {
              await supabaseAdmin
                .from("minicourse_registrations")
                .update({ status: "paid" })
                .eq("id", mcRegId);
            }

            // === PROVA SELETIVA: inscrição paga ===
            const selRegId = obj?.metadata?.selection_registration_id || payload?.metadata?.selection_registration_id;
            if (selRegId) {
              await (supabaseAdmin as any)
                .from("league_selection_registrations")
                .update({ status: "paid" })
                .eq("id", selRegId);
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
