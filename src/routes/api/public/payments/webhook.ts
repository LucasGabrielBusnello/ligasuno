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
                // Adicionar à lista de presença
                await supabaseAdmin.from("league_attendance").insert({
                  league_id: ev.league_id,
                  user_id: (reg as any).user_id,
                  activity: ev.title,
                  activity_date: ev.event_date ?? new Date().toISOString().slice(0, 10),
                  present: false,
                });
                // Notificar presidente
                await supabaseAdmin.from("league_notifications").insert({
                  league_id: ev.league_id,
                  title: "Nova inscrição paga",
                  message: `${(reg as any).full_name} confirmou inscrição em ${ev.title}.`,
                });
              }
            }

            // === ASSINATURA criada via checkout ===
            const leagueId = obj?.metadata?.league_id;
            if (leagueId && obj?.mode === "subscription" && obj?.subscription) {
              // Será também processado por customer.subscription.created, mas garantimos paid_until aqui.
              const periodEnd = new Date();
              periodEnd.setMonth(periodEnd.getMonth() + 1);
              await supabaseAdmin
                .from("leagues")
                .update({ paid_until: periodEnd.toISOString().slice(0, 10), published: true })
                .eq("id", leagueId);
            }
          }

          // === ASSINATURA: ciclo de vida ===
          if (
            type === "customer.subscription.created" ||
            type === "customer.subscription.updated"
          ) {
            const leagueId = obj?.metadata?.league_id;
            const periodEndUnix = obj?.items?.data?.[0]?.current_period_end ?? obj?.current_period_end;
            const periodStartUnix = obj?.items?.data?.[0]?.current_period_start ?? obj?.current_period_start;
            const status = obj?.status as string;
            const isActive = status === "active" || status === "trialing";

            if (leagueId) {
              await supabaseAdmin.from("league_subscriptions").upsert({
                league_id: leagueId,
                stripe_subscription_id: obj.id,
                stripe_customer_id: obj.customer,
                price_id: obj?.items?.data?.[0]?.price?.id ?? "unknown",
                status,
                current_period_start: periodStartUnix ? new Date(periodStartUnix * 1000).toISOString() : null,
                current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
                cancel_at_period_end: !!obj?.cancel_at_period_end,
                environment: "sandbox",
                updated_at: new Date().toISOString(),
              }, { onConflict: "stripe_subscription_id" });

              const updates: any = {};
              if (isActive && periodEndUnix) {
                updates.paid_until = new Date(periodEndUnix * 1000).toISOString().slice(0, 10);
                updates.published = true;
              } else if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
                updates.published = false;
              }
              if (Object.keys(updates).length) {
                await supabaseAdmin.from("leagues").update(updates).eq("id", leagueId);
              }
            }
          }

          if (type === "customer.subscription.deleted") {
            const leagueId = obj?.metadata?.league_id;
            await supabaseAdmin
              .from("league_subscriptions")
              .update({ status: "canceled", updated_at: new Date().toISOString() })
              .eq("stripe_subscription_id", obj.id);
            if (leagueId) {
              await supabaseAdmin.from("leagues").update({ published: false }).eq("id", leagueId);
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
