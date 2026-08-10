// Efeitos colaterais de um pagamento aprovado/recusado nas categorias de LIGA.
// Compartilhado pelos webhooks (Mercado Pago e Asaas).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailLayout, sendGmail, sendMinicourseRegistrationEmail } from "@/lib/gmail.server";
import { sendEventBadgeEmail } from "@/lib/event-badge-email.server";

export type SettleInput = {
  category: string;
  refId: string;
  paymentId: string;
  /** approved | pending | rejected | cancelled | refunded */
  status: string;
  grossAmount: number;
  feeAmount: number;
  method?: string | null;
  raw?: any;
  leagueId?: string | null;
  userId?: string | null;
};

export async function settleLeaguePayment(input: SettleInput) {
  const approved = input.status === "approved";

  await supabaseAdmin.from("payment_transactions").upsert({
    category: input.category,
    reference_id: input.refId,
    mp_payment_id: String(input.paymentId),
    payment_method: input.method ?? null,
    gross_amount: input.grossAmount,
    fee_amount: input.feeAmount,
    status: input.status,
    raw: input.raw ?? null,
    league_id: input.leagueId ?? null,
    user_id: input.userId ?? null,
  } as any, { onConflict: "mp_payment_id" });

  if (input.category === "event") {
    await supabaseAdmin.from("event_registrations")
      .update({ status: approved ? "paid" : "pending" }).eq("id", input.refId);
    if (approved) {
      const { data: reg } = await supabaseAdmin.from("event_registrations")
        .select("full_name, league_events!inner(title, league_id)")
        .eq("id", input.refId).maybeSingle();
      if (reg) {
        const ev: any = (reg as any).league_events;
        await supabaseAdmin.from("league_notifications").insert({
          league_id: ev.league_id,
          title: "Nova inscrição paga",
          message: `${(reg as any).full_name} confirmou inscrição em ${ev.title}.`,
        } as any);
      }
      try { await sendEventBadgeEmail(input.refId); }
      catch (e) { console.error("event badge email failed", e); }
    }
    return;
  }

  if (input.category === "minicourse") {
    await supabaseAdmin.from("minicourse_registrations")
      .update({ status: approved ? "paid" : "pending" }).eq("id", input.refId);
    if (!approved) return;
    const { data: mr } = await supabaseAdmin.from("minicourse_registrations")
      .select("paid_price, league_minicourses!inner(title, instructor, starts_at, location, description, league_events!inner(leagues:league_id(name, slug, theme_color))), profiles!minicourse_registrations_user_id_fkey(email, full_name, username)")
      .eq("id", input.refId).maybeSingle();
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
    return;
  }

  if (input.category === "selection") {
    await supabaseAdmin.from("league_selection_registrations")
      .update({ status: approved ? "paid" : "pending" }).eq("id", input.refId);
    return;
  }

  if (input.category === "semester" && approved) {
    await supabaseAdmin.from("semester_payments").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      amount_paid_cents: Math.round(input.grossAmount * 100),
      mp_payment_id: String(input.paymentId),
    }).eq("id", input.refId);

    const { data: sp } = await supabaseAdmin
      .from("semester_payments")
      .select("amount_paid_cents, semester_cycles!inner(semester, year), leagues:league_id(name, theme_color), profiles!semester_payments_user_id_fkey(email, full_name, username)")
      .eq("id", input.refId).maybeSingle();
    const email = (sp as any)?.profiles?.email;
    if (!email) return;
    const name = (sp as any).profiles?.full_name || (sp as any).profiles?.username || "ligante";
    const cy = (sp as any).semester_cycles;
    const leagueName = (sp as any).leagues?.name ?? "";
    const brand = (sp as any).leagues?.theme_color ?? "#1f5132";
    const paidValue = (((sp as any).amount_paid_cents ?? 0) / 100)
      .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    try {
      await sendGmail({
        to: email,
        subject: `Semestralidade paga — ${leagueName}`,
        html: emailLayout({
          title: `Olá, ${name}. Recebemos seu pagamento.`,
          brandColor: brand,
          leagueName,
          bodyHtml: `<p>Confirmamos o pagamento da sua semestralidade <strong>${cy?.semester}º/${cy?.year}</strong> da <strong>${leagueName}</strong>.</p>
            <p style="margin:18px 0 0;color:#cfd9d3;"><strong style="color:#fff;">Valor pago:</strong> ${paidValue}</p>`,
          signature: `— Presidência da ${leagueName}`,
        }),
      });
    } catch (e) { console.error("semester email failed", e); }
  }
}
