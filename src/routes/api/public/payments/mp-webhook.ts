import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPayment, getPreapproval } from "@/lib/mp.server";
import { sendGmail, emailLayout, sendEventRegistrationEmail, sendMinicourseRegistrationEmail } from "@/lib/gmail.server";


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
  // Soma TODAS as taxas debitadas do vendedor (liga): taxa do MP + marketplace_fee.
  // Isso reflete o que efetivamente entra na conta da liga (net_received_amount).
  const feeDetails: any[] = Array.isArray(payment?.fee_details) ? payment.fee_details : [];
  let feeAmount = feeDetails.reduce((sum, f) => {
    const payer = String(f?.fee_payer ?? "collector").toLowerCase();
    return (payer === "collector" || payer === "seller") ? sum + (Number(f?.amount) || 0) : sum;
  }, 0);
  if (feeAmount === 0 && Number(payment?.application_fee) > 0) {
    feeAmount = Number(payment.application_fee);
  }

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
        .select("full_name, event_id, paid_price, league_events!inner(title, league_id, event_date, schedule, leagues:league_id(name, slug, theme_color)), profiles!event_registrations_user_id_fkey(email)")
        .eq("id", refId).maybeSingle();
      if (reg) {
        const ev: any = (reg as any).league_events;
        await supabaseAdmin.from("league_notifications").insert({
          league_id: ev.league_id,
          title: "Nova inscrição paga",
          message: `${(reg as any).full_name} confirmou inscrição em ${ev.title}.`,
        });
        const email = (reg as any).profiles?.email;
        const lg = ev.leagues;
        if (email && lg) {
          try {
            await sendEventRegistrationEmail({
              to: email,
              fullName: (reg as any).full_name,
              leagueName: lg.name, leagueSlug: lg.slug, brandColor: lg.theme_color,
              eventTitle: ev.title, eventDate: ev.event_date, eventTime: ev.schedule,
              paidPrice: Number((reg as any).paid_price) || 0,
            });
            await supabaseAdmin.from("event_email_log").insert({
              event_id: ev.id ?? ev.event_id ?? null, kind: "registration", reference_id: refId, recipient: email,
            } as any).then(() => {}, () => {});
          } catch (e) { console.error("event email failed", e); }
        }
      }
    }
  } else if (category === "minicourse") {
    await supabaseAdmin.from("minicourse_registrations")
      .update({ status: approved ? "paid" : "pending" }).eq("id", refId);
    if (approved) {
      const { data: mr } = await supabaseAdmin.from("minicourse_registrations")
        .select("user_id, paid_price, league_minicourses!inner(title, instructor, starts_at, location, description, event_id, league_events!inner(league_id, leagues:league_id(name, slug, theme_color))), profiles!minicourse_registrations_user_id_fkey(email, full_name, username)")
        .eq("id", refId).maybeSingle();
      const mc: any = (mr as any)?.league_minicourses;
      const lg = mc?.league_events?.leagues;
      const email = (mr as any)?.profiles?.email;
      const name = (mr as any)?.profiles?.full_name || (mr as any)?.profiles?.username || "ligante";
      if (email && lg && mc) {
        try {
          await sendMinicourseRegistrationEmail({
            to: email, fullName: name,
            leagueName: lg.name, leagueSlug: lg.slug, brandColor: lg.theme_color,
            minicourseTitle: mc.title, instructor: mc.instructor, startsAt: mc.starts_at,
            location: mc.location, description: mc.description,
            paidPrice: Number((mr as any).paid_price) || 0,
          });
        } catch (e) { console.error("minicourse email failed", e); }
      }
    }
  } else if (category === "selection") {
    await supabaseAdmin.from("league_selection_registrations")
      .update({ status: approved ? "paid" : "pending" }).eq("id", refId);
  } else if (category === "semester") {
    if (approved) {
      await supabaseAdmin.from("semester_payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          amount_paid_cents: Math.round(grossAmount * 100),
          mp_payment_id: String(paymentId),
        })
        .eq("id", refId);
      // Confirmação por e-mail
      const { data: sp } = await supabaseAdmin
        .from("semester_payments")
        .select("amount_paid_cents, semester_cycles!inner(semester, year), leagues:league_id(name, theme_color), profiles!semester_payments_user_id_fkey(email, full_name, username)")
        .eq("id", refId)
        .maybeSingle();
      const email = (sp as any)?.profiles?.email;
      if (email) {
        const name = (sp as any).profiles?.full_name || (sp as any).profiles?.username || "ligante";
        const cy = (sp as any).semester_cycles;
        const leagueName = (sp as any).leagues?.name ?? "";
        const brand = (sp as any).leagues?.theme_color ?? "#1f5132";
        const paidValue = (((sp as any).amount_paid_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        try {
          await sendGmail({
            to: email,
            subject: `Semestralidade paga — ${leagueName}`,
            html: emailLayout({
              title: `Olá, ${name}. Recebemos seu pagamento.`,
              brandColor: brand,
              leagueName,
              bodyHtml: `<p>Confirmamos o pagamento da sua semestralidade <strong>${cy?.semester}º/${cy?.year}</strong> da <strong>${leagueName}</strong>.</p>
                <p>Está tudo certo: você segue ativo na liga e com acesso a todas as atividades, plantões e oportunidades do semestre. Bom ciclo pela frente!</p>
                <p style="margin:18px 0 0;color:#cfd9d3;"><strong style="color:#fff;">Valor pago:</strong> ${paidValue}</p>`,
              signature: `— Presidência da ${leagueName}`,
            }),
          });
        } catch (e) {
          console.error("Falha ao enviar confirmação de semestralidade", e);
        }
      }
    }
  } else if (category === "ath_memb") {
    await handleAthleticMembership(refId, approved, String(paymentId), grossAmount);
  } else if (category === "ath_event") {
    await handleAthleticEventTicket(refId, approved, String(paymentId), grossAmount);
  } else if (category === "ath_prod") {
    await handleAthleticProductOrder(refId, approved, String(paymentId), grossAmount);
  } else if (category === "anuidade_semestral") {

    if (approved) {
      // Estende paid_until até o fim do semestre vigente (fev–jul = 31/jul; ago–jan = 31/jan)
      const { data: lg } = await supabaseAdmin
        .from("leagues").select("paid_until").eq("id", refId).maybeSingle();
      const today = new Date();
      const currentPaid = (lg as any)?.paid_until ? new Date((lg as any).paid_until) : null;
      const base = currentPaid && currentPaid > today ? currentPaid : today;
      const y = base.getFullYear();
      const m = base.getMonth();
      let end: Date;
      if (m >= 1 && m <= 6) end = new Date(y, 6, 31);
      else if (m >= 7) end = new Date(y + 1, 0, 31);
      else end = new Date(y, 0, 31);
      await supabaseAdmin.from("leagues")
        .update({ paid_until: end.toISOString().slice(0, 10), published: true })
        .eq("id", refId);
    }
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

/* ============ ATLÉTICA ============ */

export async function handleAthleticMembership(paymentId: string, approved: boolean, mpPaymentId: string, grossAmount: number) {
  const { data: pay } = await supabaseAdmin
    .from("athletic_membership_payments").select("*").eq("id", paymentId).maybeSingle();
  if (!pay) return;
  if ((pay as any).status === "paid") return;

  if (!approved) {
    await supabaseAdmin.from("athletic_membership_payments")
      .update({ status: "pending" }).eq("id", paymentId);
    return;
  }

  const untilDate = new Date();
  untilDate.setDate(untilDate.getDate() + (Number((pay as any).period_days) || 180));
  const untilStr = untilDate.toISOString().slice(0, 10);

  await supabaseAdmin.from("athletic_membership_payments").update({
    status: "paid",
    member_until: untilStr,
    mp_payment_id: mpPaymentId,
  }).eq("id", paymentId);

  if ((pay as any).membership_id) {
    await supabaseAdmin.from("athletic_memberships").update({
      active: true, member_until: untilStr,
    }).eq("id", (pay as any).membership_id);
  }

  await supabaseAdmin.from("athletic_cash_entries").insert({
    athletic_id: (pay as any).athletic_id,
    category: "membership",
    description: `Associação online — ${(pay as any).buyer_name}`,
    gross_amount: grossAmount,
    net_amount: grossAmount,
    is_income: true,
    related_membership_payment_id: paymentId,
  });

  try {
    const email = (pay as any).buyer_email;
    if (email) {
      const html = emailLayout({
        title: `Bem-vindo(a) à AAAMD Desbravadores`,
        leagueName: `AAAMD Desbravadores`,
        brandColor: "#F97316",
        bodyHtml: `<p>Olá <strong>${(pay as any).buyer_name}</strong>, sua associação foi confirmada!</p>
          <p>Você é sócio(a) ativo(a) até <strong>${new Date(untilStr).toLocaleDateString("pt-BR")}</strong>.</p>
          <p>Aproveite descontos exclusivos em eventos e produtos.</p>`,
      });
      await sendGmail({ to: email, subject: `Associação confirmada — AAAMD Desbravadores`, html });
    }
  } catch (e) { console.warn("[ath_memb] e-mail falhou", e); }
}

export async function handleAthleticEventTicket(ticketId: string, approved: boolean, mpPaymentId: string, grossAmount: number) {
  const { data: ticket } = await supabaseAdmin
    .from("athletic_event_tickets").select("*, athletic_events!inner(id, title, athletic_id, tickets_sold)").eq("id", ticketId).maybeSingle();
  if (!ticket) return;
  const ev: any = (ticket as any).athletic_events;

  if (!approved) {
    if ((ticket as any).status === "reserved") {
      await supabaseAdmin.from("athletic_event_tickets").update({
        status: "available", buyer_user_id: null, buyer_name: null, buyer_email: null,
        buyer_phone: null, buyer_cpf: null, price_paid: null, sold_channel: null, mp_payment_id: null,
      }).eq("id", ticketId);
    }
    return;
  }

  if ((ticket as any).status === "sold") return;

  await supabaseAdmin.from("athletic_event_tickets").update({
    status: "sold",
    payment_methods: { pix: grossAmount, dinheiro: 0, cartao: 0 },
    sold_at: new Date().toISOString(),
    mp_payment_id: mpPaymentId,
  }).eq("id", ticketId);

  await supabaseAdmin.from("athletic_events").update({
    tickets_sold: (Number(ev.tickets_sold) || 0) + 1,
  }).eq("id", ev.id);

  await supabaseAdmin.from("athletic_cash_entries").insert({
    athletic_id: ev.athletic_id,
    category: "event_online",
    description: `Ingresso online #${(ticket as any).code} — ${ev.title} — ${(ticket as any).buyer_name}`,
    gross_amount: grossAmount,
    net_amount: grossAmount,
    is_income: true,
    related_ticket_id: ticketId,
  });

  try {
    const email = (ticket as any).buyer_email;
    if (email) {
      const html = emailLayout({
        title: `Ingresso confirmado`,
        leagueName: `AAAMD Desbravadores`,
        brandColor: "#F97316",
        bodyHtml: `<p>Olá <strong>${(ticket as any).buyer_name}</strong>, seu ingresso está confirmado.</p>
          <p><strong>Evento:</strong> ${ev.title}</p>
          <p><strong>Código do ingresso:</strong><br/>
            <code style="background:#111;color:#F97316;padding:8px 14px;border-radius:8px;font-size:18px;letter-spacing:2px">${(ticket as any).code}</code>
          </p>
          <p>Apresente este e-mail na entrada. Seu QR estará disponível também na área de sócio.</p>`,
      });
      await sendGmail({ to: email, subject: `Ingresso — ${ev.title}`, html });
    }
  } catch (e) { console.warn("[ath_event] e-mail falhou", e); }
}

export async function handleAthleticProductOrder(orderId: string, approved: boolean, mpPaymentId: string, grossAmount: number) {
  const { data: order } = await supabaseAdmin
    .from("athletic_product_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return;

  if (!approved) {
    await supabaseAdmin.from("athletic_product_orders")
      .update({ status: "pending" }).eq("id", orderId);
    return;
  }

  if ((order as any).status === "paid") return;

  await supabaseAdmin.from("athletic_product_orders")
    .update({ status: "paid", mp_payment_id: mpPaymentId }).eq("id", orderId);

  // decrementa estoque
  const { data: items } = await supabaseAdmin
    .from("athletic_product_order_items").select("product_id, quantity").eq("order_id", orderId);
  for (const it of (items as any[]) ?? []) {
    if (!it.product_id) continue;
    const { data: prod } = await supabaseAdmin
      .from("athletic_products").select("stock").eq("id", it.product_id).maybeSingle();
    if (prod && (prod as any).stock != null) {
      await supabaseAdmin.from("athletic_products")
        .update({ stock: Math.max(0, Number((prod as any).stock) - Number(it.quantity)) })
        .eq("id", it.product_id);
    }
  }

  await supabaseAdmin.from("athletic_cash_entries").insert({
    athletic_id: (order as any).athletic_id,
    category: "product",
    description: `Pedido online — ${(order as any).buyer_name}`,
    gross_amount: grossAmount,
    net_amount: grossAmount,
    is_income: true,
    related_order_id: orderId,
  });

  try {
    const email = (order as any).buyer_email;
    if (email) {
      const html = emailLayout({
        title: `Pedido confirmado`,
        leagueName: `AAAMD Desbravadores`,
        brandColor: "#F97316",
        bodyHtml: `<p>Olá <strong>${(order as any).buyer_name}</strong>, recebemos seu pagamento.</p>
          <p><strong>Total:</strong> R$ ${Number((order as any).total).toFixed(2)}</p>
          <p>A diretoria entrará em contato para a entrega. Obrigado!</p>`,
      });
      await sendGmail({ to: email, subject: `Pedido confirmado — AAAMD Desbravadores`, html });
    }
  } catch (e) { console.warn("[ath_prod] e-mail falhou", e); }
}
