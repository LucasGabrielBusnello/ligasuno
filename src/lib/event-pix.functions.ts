import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";
import {
  computeFee,
  createPixPayment,
  getPayment,
  loadFeeForCategory,
  loadLeagueMpAccount,
} from "@/lib/mp.server";

const PUBLISHED_URL = "https://ligasuno.com.br";
const WEBHOOK_URL = `${PUBLISHED_URL}/api/public/payments/mp-webhook`;

const eventSchema = z.object({
  event_id: z.string().uuid(),
  full_name: z.string().min(2).max(150),
  social_name: z.string().max(150).optional().nullable(),
  cpf: z.string().min(11).max(20),
  course: z.enum(["medicina", "enfermagem", "egresso_medicina", "outro", "egresso_outro"]),
});

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] ?? "Aluno";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "Ligasuno";
  return { first: first.slice(0, 50), last: last.slice(0, 50) };
}

async function ensureDeadline(deadline: any) {
  if (!deadline) return;
  const d = new Date(deadline);
  if (!isNaN(d.getTime()) && d.getTime() < Date.now()) {
    throw new Error("As inscrições para este evento já foram encerradas.");
  }
}

export const createEventPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: event, error: evErr } = await supabase
      .from("league_events")
      .select("*, leagues!inner(id, name, slug)")
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr || !event) throw new Error("Evento não encontrado");
    if ((event as any).accepting_registrations === false) {
      throw new Error("Este evento não está aceitando inscrições no momento.");
    }
    await ensureDeadline((event as any).registration_deadline);

    const leagueId = (event as any).league_id;
    const partnerIds: string[] = (event as any).partner_league_ids ?? [];
    const normalizedCpf = normalizeCpf(data.cpf);
    if (!isValidCPF(normalizedCpf)) throw new Error("CPF inválido");

    const { data: myMemberships } = await supabase
      .from("league_memberships").select("league_id, role").eq("user_id", userId);
    const memberships = myMemberships ?? [];
    const isLigante = memberships.some(
      (m: any) => m.league_id === leagueId && ["ligante", "diretor", "presidente"].includes(m.role),
    );
    const isPartner = !isLigante && memberships.some(
      (m: any) => partnerIds.includes(m.league_id) && ["ligante", "diretor", "presidente"].includes(m.role),
    );

    let category: "ligante" | "partner" | "visitor" = "visitor";
    let base = Number((event as any).price_visitor) || 0;
    let paid = base;
    let discountReason: string | null = null;
    if (isLigante) {
      category = "ligante"; paid = Number((event as any).price_ligante) || 0;
      discountReason = "Desconto exclusivo para ligantes da liga";
    } else if (isPartner) {
      category = "partner"; paid = Number((event as any).price_partner) || 0;
      discountReason = "Desconto para integrantes de ligas parceiras";
    }

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("event_registrations")
      .upsert({
        event_id: data.event_id, user_id: userId,
        full_name: data.full_name, social_name: data.social_name || null,
        cpf: normalizedCpf, course: data.course, category,
        base_price: base, paid_price: paid, discount_reason: discountReason,
        status: paid === 0 ? "paid" : "pending",
      }, { onConflict: "event_id,user_id" })
      .select("*").single();
    if (regErr || !reg) throw new Error(regErr?.message || "Falha ao registrar");

    if (paid === 0) {
      try {
        const { sendEventBadgeEmail } = await import("@/lib/event-badge-email.server");
        await sendEventBadgeEmail(reg.id);
      } catch (e) { console.error("badge email failed", e); }
      return { free: true, registration_id: reg.id, status: "paid" };
    }

    const feeCfg = await loadFeeForCategory(supabaseAdmin, "event");
    const fee = computeFee(paid, feeCfg.pct, feeCfg.fixed);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = (prof as any)?.email || `${userId}@noemail.local`;
    const { first, last } = splitName(data.full_name);

    const { createLeaguePix } = await import("@/lib/league-pay.server");
    const pay = await createLeaguePix({
      supabaseAdmin,
      leagueId,
      amount: paid,
      description: `${(event as any).title} — ${(event as any).leagues.name}`,
      payer: { email, firstName: first, lastName: last, cpf: normalizedCpf },
      externalReference: `event:${reg.id}`,
      notificationUrl: WEBHOOK_URL,
      applicationFee: fee,
      metadata: { registration_id: reg.id, event_id: data.event_id, user_id: userId, league_id: leagueId },
      expiresInMinutes: 30,
    });

    await supabaseAdmin.from("event_registrations")
      .update({ stripe_session_id: String(pay.payment_id) }).eq("id", reg.id);

    return {
      free: false,
      registration_id: reg.id,
      payment_id: pay.payment_id,
      status: pay.status,
      amount: paid,
      qr_code: pay.qr_code,
      qr_code_base64: pay.qr_code_base64,
      ticket_url: pay.ticket_url,
      expires_at: pay.expires_at,
    };
  });

export const getEventPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ registration_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: reg } = await supabaseAdmin
      .from("event_registrations")
      .select("id,user_id,status,stripe_session_id,event_id,league_events!inner(league_id)")
      .eq("id", data.registration_id)
      .maybeSingle();
    if (!reg || (reg as any).user_id !== userId) throw new Error("Inscrição não encontrada");
    if ((reg as any).status === "paid") return { status: "paid" };
    const paymentId = (reg as any).stripe_session_id;
    if (!paymentId) return { status: (reg as any).status };

    try {
      const leagueId = (reg as any).league_events.league_id;
      const { getLeaguePaymentStatus } = await import("@/lib/league-pay.server");
      const st = await getLeaguePaymentStatus(supabaseAdmin, leagueId, String(paymentId));
      if (st === "approved") {
        await supabaseAdmin.from("event_registrations")
          .update({ status: "paid" }).eq("id", (reg as any).id);
        try {
          const { sendEventBadgeEmail } = await import("@/lib/event-badge-email.server");
          await sendEventBadgeEmail((reg as any).id);
        } catch (e) { console.error("badge email failed", e); }
        return { status: "paid" };
      }
      return { status: st ?? (reg as any).status };
    } catch {
      return { status: (reg as any).status };
    }
  });

const mcSchema = z.object({ minicourse_id: z.string().uuid() });

export const createMinicoursePix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mcSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: mc, error: mcErr } = await supabase
      .from("league_minicourses")
      .select("*, league_events!inner(id, title, league_id, free_minicourse_quota, leagues!inner(slug,name))")
      .eq("id", data.minicourse_id).maybeSingle();
    if (mcErr || !mc) throw new Error("Minicurso não encontrado");
    if (!(mc as any).published) throw new Error("Minicurso indisponível");

    const { count } = await supabaseAdmin
      .from("minicourse_registrations")
      .select("id", { count: "exact", head: true })
      .eq("minicourse_id", data.minicourse_id)
      .in("status", ["paid", "pending"]);
    const max = Number((mc as any).max_registrations) || 0;
    if (max > 0 && (count ?? 0) >= max) throw new Error("Vagas esgotadas");

    const eventId = (mc as any).event_id;
    const leagueId = (mc as any).league_events.league_id;
    const { data: evReg } = await supabaseAdmin
      .from("event_registrations").select("id,status,full_name,cpf")
      .eq("event_id", eventId).eq("user_id", userId).maybeSingle();
    if (!evReg || (evReg as any).status !== "paid") {
      throw new Error("Você precisa estar inscrito (e pago) no evento para acessar os minicursos.");
    }

    // Preço base: ligantes da liga organizadora podem ter valor próprio
    let exclusiveLeagueId: string | null = null;
    let price = !!(mc as any).is_free ? 0 : Number((mc as any).price) || 0;
    if (!(mc as any).is_free) {
      const { data: myLeaguesAll } = await supabaseAdmin
        .from("league_memberships").select("league_id, role").eq("user_id", userId);
      const mine = new Set(((myLeaguesAll ?? []) as any[]).map((m) => m.league_id));
      const ligPrice = (mc as any).price_ligante;
      if (ligPrice !== null && ligPrice !== undefined && mine.has(leagueId)) {
        price = Number(ligPrice) || 0;
      }

      // Preço especial por liga: vale enquanto houver vagas daquela liga
      const { data: slots } = await supabaseAdmin
        .from("minicourse_exclusive_slots")
        .select("league_id, seats, price")
        .eq("minicourse_id", data.minicourse_id);
      const priced = ((slots ?? []) as any[]).filter((s) => s.price !== null && s.price !== undefined);
      if (priced.length) {
        const candidates = priced.filter((s) => mine.has(s.league_id)).sort((a, b) => Number(a.price) - Number(b.price));
        for (const c of candidates) {
          const { count: used } = await supabaseAdmin
            .from("minicourse_registrations")
            .select("id", { count: "exact", head: true })
            .eq("minicourse_id", data.minicourse_id)
            .eq("exclusive_league_id", c.league_id)
            .in("status", ["paid", "pending"]);
          if ((used ?? 0) < Number(c.seats) && Number(c.price) < price) {
            exclusiveLeagueId = c.league_id;
            price = Number(c.price) || 0;
            break;
          }
        }
      }
    }
    // Cota de minicursos gratuitos definida no evento
    let usesQuota = false;
    const quota = Number((mc as any).league_events?.free_minicourse_quota) || 0;
    if (price > 0 && quota > 0) {
      const { data: mine } = await supabaseAdmin
        .from("minicourse_registrations")
        .select("id, quota_used, minicourse_id, league_minicourses!inner(event_id)")
        .eq("user_id", userId)
        .in("status", ["paid", "pending"]);
      const usedCount = ((mine ?? []) as any[]).filter(
        (r) => r.quota_used && r.league_minicourses?.event_id === eventId && r.minicourse_id !== data.minicourse_id,
      ).length;
      if (usedCount < quota) {
        usesQuota = true;
        price = 0;
      }
    }
    const isFree = price <= 0;

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("minicourse_registrations")
      .upsert({
        minicourse_id: data.minicourse_id, user_id: userId,
        event_registration_id: (evReg as any).id, paid_price: price,
        exclusive_league_id: exclusiveLeagueId,
        quota_used: usesQuota,
        status: isFree ? "paid" : "pending",
      } as any, { onConflict: "minicourse_id,user_id" } as any)
      .select("*").single();


    if (regErr || !reg) throw new Error(regErr?.message || "Falha ao registrar");

    if (isFree) return { free: true, registration_id: (reg as any).id, status: "paid" };

    const mpAccount = await loadLeagueMpAccount(supabaseAdmin, leagueId);
    const feeCfg = await loadFeeForCategory(supabaseAdmin, "minicourse");
    const fee = computeFee(price, feeCfg.pct, feeCfg.fixed);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = (prof as any)?.email || `${userId}@noemail.local`;
    const { first, last } = splitName((evReg as any).full_name || "Aluno");
    const cpf = (evReg as any).cpf || "00000000000";

    const pay = await createPixPayment({
      sellerAccessToken: (mpAccount as any).access_token,
      amount: price,
      description: `Minicurso: ${(mc as any).title}`,
      payerEmail: email,
      payerFirstName: first,
      payerLastName: last,
      payerCpf: cpf,
      externalReference: `minicourse:${(reg as any).id}`,
      notificationUrl: WEBHOOK_URL,
      applicationFee: fee,
      metadata: { minicourse_registration_id: (reg as any).id, minicourse_id: data.minicourse_id, user_id: userId, league_id: leagueId },
      expiresInMinutes: 30,
    });

    await supabaseAdmin.from("minicourse_registrations")
      .update({ stripe_session_id: String(pay.id) }).eq("id", (reg as any).id);

    const tx = pay?.point_of_interaction?.transaction_data ?? {};
    return {
      free: false,
      registration_id: (reg as any).id,
      payment_id: String(pay.id),
      status: pay.status,
      amount: price,
      qr_code: tx.qr_code as string | undefined,
      qr_code_base64: tx.qr_code_base64 as string | undefined,
      ticket_url: tx.ticket_url as string | undefined,
      expires_at: pay.date_of_expiration as string | undefined,
    };
  });

export const getMinicoursePaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ registration_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: reg } = await supabaseAdmin
      .from("minicourse_registrations")
      .select("id,user_id,status,stripe_session_id,league_minicourses!inner(league_events!inner(league_id))")
      .eq("id", data.registration_id)
      .maybeSingle();
    if (!reg || (reg as any).user_id !== userId) throw new Error("Inscrição não encontrada");
    if ((reg as any).status === "paid") return { status: "paid" };
    const paymentId = (reg as any).stripe_session_id;
    if (!paymentId) return { status: (reg as any).status };
    try {
      const leagueId = (reg as any).league_minicourses.league_events.league_id;
      const mp = await loadLeagueMpAccount(supabaseAdmin, leagueId).catch(() => null);
      const pay = await getPayment(String(paymentId), (mp as any)?.access_token);
      if (pay?.status === "approved") {
        await supabaseAdmin.from("minicourse_registrations")
          .update({ status: "paid" }).eq("id", (reg as any).id);
        return { status: "paid" };
      }
      return { status: pay?.status ?? (reg as any).status };
    } catch {
      return { status: (reg as any).status };
    }
  });
