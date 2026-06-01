import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPayment, getPreapproval } from "@/lib/mp.server";

/**
 * Webhook do Mercado Pago.
 * MP envia tipos: payment, merchant_order, subscription_preapproval.
 * O corpo é leve ({type, data:{id}}) — buscamos o recurso completo via API.
 *
 * Segurança: MP suporta assinatura via header `x-signature` + `x-request-id`.
 * Se MP_WEBHOOK_SECRET estiver setado, validamos.
 */
export const Route = createFileRoute("/api/public/payments/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        let payload: any = {};
        try { payload = JSON.parse(rawBody); } catch { /* MP às vezes envia vazio */ }

        // Validação opcional de assinatura
        const secret = process.env.MP_WEBHOOK_SECRET;
        if (secret) {
          const sig = request.headers.get("x-signature");
          const reqId = request.headers.get("x-request-id");
          const url = new URL(request.url);
          const dataId = url.searchParams.get("data.id") || payload?.data?.id;
          // x-signature vem como "ts=...,v1=..."
          if (sig && reqId && dataId) {
            try {
              const parts = Object.fromEntries(sig.split(",").map(s => s.trim().split("=")));
              const ts = parts["ts"];
              const v1 = parts["v1"];
              const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
              const enc = new TextEncoder();
              const key = await crypto.subtle.importKey(
                "raw", enc.encode(secret),
                { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
              );
              const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
              const hex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
              if (hex !== v1) {
                console.warn("MP webhook signature mismatch");
                return new Response("invalid signature", { status: 401 });
              }
            } catch (e) {
              console.warn("MP signature validation error", e);
            }
          }
        }

        const type = payload?.type || payload?.topic || new URL(request.url).searchParams.get("type");
        const dataId = payload?.data?.id || new URL(request.url).searchParams.get("data.id") || new URL(request.url).searchParams.get("id");

        try {
          if (type === "payment" && dataId) {
            await handlePayment(String(dataId));
          } else if (type === "subscription_preapproval" || type === "preapproval") {
            if (dataId) await handlePreapproval(String(dataId));
          } else if (type === "merchant_order" && dataId) {
            // pula — usamos payment direto
          }
        } catch (e) {
          console.error("MP webhook error", e);
          // Devolvemos 200 pra MP não reentregar infinitamente em erros lógicos.
          return new Response("ok-with-error", { status: 200 });
        }

        return new Response("ok");
      },

      GET: async () => new Response("ok"),
    },
  },
});

async function handlePayment(paymentId: string) {
  // Busca via token da plataforma — funciona pq MP enxerga split nessa visão.
  const payment = await getPayment(paymentId);
  const status = payment?.status as string; // approved|pending|in_process|rejected|refunded|cancelled
  const externalRef = payment?.external_reference as string | undefined;
  const metadata = payment?.metadata ?? {};

  if (!externalRef) return;

  // external_reference vem como "category:reference_id" (ex: "event:uuid")
  const [category, refId] = externalRef.split(":");
  if (!category || !refId) return;

  const grossAmount = Number(payment?.transaction_amount ?? 0);
  const feeAmount = Number(payment?.fee_details?.find((f: any) => f.type === "marketplace_fee")?.amount ?? payment?.application_fee ?? 0);

  // Log
  await supabaseAdmin.from("payment_transactions").upsert({
    category,
    reference_id: refId,
    mp_payment_id: String(paymentId),
    payment_method: payment?.payment_method_id,
    gross_amount: grossAmount,
    fee_amount: feeAmount,
    status,
    raw: payment,
    league_id: metadata?.league_id ?? null,
    user_id: metadata?.user_id ?? null,
  }, { onConflict: "mp_payment_id" });

  const approved = status === "approved";

  if (category === "event") {
    await supabaseAdmin.from("event_registrations")
      .update({ status: approved ? "paid" : (status === "rejected" || status === "cancelled" ? "pending" : "pending") })
      .eq("id", refId);
    if (approved) {
      const { data: reg } = await supabaseAdmin.from("event_registrations")
        .select("full_name, event_id, league_events!inner(title, league_id)")
        .eq("id", refId).maybeSingle();
      if (reg) {
        const ev: any = (reg as any).league_events;
        await supabaseAdmin.from("league_notifications").insert({
          league_id: ev.league_id,
          title: "Nova inscrição paga",
          message: `${(reg as any).full_name} confirmou inscrição em ${ev.title}.`,
        });
      }
    }
  } else if (category === "minicourse") {
    await supabaseAdmin.from("minicourse_registrations")
      .update({ status: approved ? "paid" : "pending" }).eq("id", refId);
  } else if (category === "selection") {
    await supabaseAdmin.from("league_selection_registrations")
      .update({ status: approved ? "paid" : "pending" }).eq("id", refId);
  }
}

async function handlePreapproval(preapprovalId: string) {
  const sub = await getPreapproval(preapprovalId);
  const status = sub?.status as string; // authorized|paused|cancelled|pending
  const externalRef = sub?.external_reference as string | undefined;
  if (!externalRef) return;
  const [category, leagueId] = externalRef.split(":");
  if (category !== "anuidade" || !leagueId) return;

  const active = status === "authorized";
  // Próxima cobrança em ~30d a partir de agora
  const periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + 1);

  const updates: any = {};
  if (active) {
    updates.paid_until = periodEnd.toISOString().slice(0, 10);
    updates.published = true;
  } else if (status === "cancelled") {
    updates.published = false;
  }
  if (Object.keys(updates).length) {
    await supabaseAdmin.from("leagues").update(updates).eq("id", leagueId);
  }

  await supabaseAdmin.from("payment_transactions").upsert({
    category: "anuidade",
    reference_id: leagueId,
    mp_preapproval_id: String(preapprovalId),
    gross_amount: Number(sub?.auto_recurring?.transaction_amount ?? 0),
    fee_amount: 0,
    status,
    raw: sub,
    league_id: leagueId,
  }, { onConflict: "mp_payment_id" });
}
