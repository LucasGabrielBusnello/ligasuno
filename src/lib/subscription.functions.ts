import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createPreapproval,
  createPixPayment,
  mpFetch,
  getPlatformAccessToken,
} from "@/lib/mp.server";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";

const PUBLISHED_URL = "https://ligasuno.com.br";
const WEBHOOK_URL = `${PUBLISHED_URL}/api/public/payments/mp-webhook`;

const schema = z.object({
  league_id: z.string().uuid(),
  origin_url: z.string().url(),
});

/**
 * Calcula o fim do semestre vigente.
 * Semestres: 1º = fev–jul (fim em 31/07), 2º = ago–jan (fim em 31/01 do ano seguinte).
 * Se já estiver pago além do fim do semestre atual, estende para o próximo.
 */
function nextSemesterEnd(baseDate: Date): Date {
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth(); // 0=jan
  // 1º semestre: fev(1) → jul(6), fim 31/jul
  if (m >= 1 && m <= 6) return new Date(y, 6, 31);
  // 2º semestre: ago(7) → jan(0) do ano seguinte, fim 31/jan
  if (m >= 7) return new Date(y + 1, 0, 31);
  // janeiro: fim 31/jan deste ano
  return new Date(y, 0, 31);
}

async function loadMonthlyFee(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("annual_fee_credit_monthly")
    .eq("id", 1)
    .maybeSingle();
  return Number(data?.annual_fee_credit_monthly ?? 9.8);
}

async function loadPixMonthlyFee(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("annual_fee_pix_monthly, annual_fee_credit_monthly")
    .eq("id", 1)
    .maybeSingle();
  return Number(data?.annual_fee_pix_monthly ?? data?.annual_fee_credit_monthly ?? 9.8);
}

function currentBillingSemester(baseDate: Date): { start: Date; end: Date } {
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  if (m >= 1 && m <= 6) return { start: new Date(y, 1, 1), end: new Date(y, 6, 31) };
  if (m >= 7) return { start: new Date(y, 7, 1), end: new Date(y + 1, 0, 31) };
  return { start: new Date(y - 1, 7, 1), end: new Date(y, 0, 31) };
}

function calculateProratedPixAmount(monthlyPix: number, baseDate = new Date()) {
  const { end } = currentBillingSemester(baseDate);
  const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
  const currentMonthFraction = Math.max(0, Math.min(1, (daysInMonth - baseDate.getDate() + 1) / daysInMonth));
  const fullMonthsAfterCurrent = Math.max(0, (end.getFullYear() - baseDate.getFullYear()) * 12 + (end.getMonth() - baseDate.getMonth()));
  const monthsAndDaysLeft = Math.min(6, Math.max(0, fullMonthsAfterCurrent + currentMonthFraction));
  const proportionalFull = Math.round(monthlyPix * monthsAndDaysLeft * 100) / 100;
  const discounted = Math.round(proportionalFull * 0.95 * 100) / 100;
  return { amount: discounted, full: proportionalFull, discount: Math.round((proportionalFull - discounted) * 100) / 100, monthsAndDaysLeft, end };
}

/**
 * Cria assinatura mensal recorrente no cartão via Mercado Pago (preapproval).
 * Valor: mensalidade configurada em app_settings.
 * Recebe na conta da plataforma (MP_ACCESS_TOKEN), sem split.
 */
export const createLeagueSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: league } = await supabase
      .from("leagues")
      .select("id, name, slug, president_id, president2_id")
      .eq("id", data.league_id)
      .maybeSingle();
    if (!league) throw new Error("Liga não encontrada");
    if ((league as any).president_id !== userId) {
      throw new Error("Apenas a presidência pode pagar a anuidade");
    }

    const monthly = await loadMonthlyFee();
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();
    const payerEmail = (prof as any)?.email;
    if (!payerEmail) throw new Error("E-mail do presidente não encontrado");

    const origin = data.origin_url.replace(/\/$/, "");
    const backUrl = `${origin}/presidente/${(league as any).slug}?anuidade=ok`;

    const pre = await createPreapproval({
      payerEmail,
      amount: Math.round(monthly * 100) / 100,
      reason: `Anuidade mensal — ${(league as any).name}`,
      backUrl,
      externalReference: `anuidade:${data.league_id}`,
    });

    return { url: pre.init_point };
  });

/**
 * Cria cobrança PIX única equivalente a 6 meses com 5% de desconto,
 * cobrindo até o fim do semestre vigente (fev–jul ou ago–jan).
 * Recebe na conta da plataforma (MP_ACCESS_TOKEN), sem split.
 */
export const createLeagueSemesterPixCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: league } = await supabase
      .from("leagues")
      .select("id, name, slug, president_id, president2_id, paid_until")
      .eq("id", data.league_id)
      .maybeSingle();
    if (!league) throw new Error("Liga não encontrada");
    if ((league as any).president_id !== userId) {
      throw new Error("Apenas a presidência pode pagar a anuidade");
    }

    const monthly = await loadPixMonthlyFee();
    const pricing = calculateProratedPixAmount(monthly);
    const semesterPrice = pricing.amount;
    if (semesterPrice <= 0) throw new Error("Não há valor proporcional a cobrar neste semestre");

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email, full_name, username, cpf").eq("id", userId).maybeSingle();
    const payerEmail = (prof as any)?.email;
    if (!payerEmail) throw new Error("E-mail do presidente não encontrado");
    const payerCpf = normalizeCpf((prof as any)?.cpf ?? "");
    if (!isValidCPF(payerCpf)) throw new Error("Cadastre um CPF válido no seu perfil antes de pagar via Pix.");

    const fullName = String((prof as any)?.full_name || (prof as any)?.username || "Presidente").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);

    const origin = data.origin_url.replace(/\/$/, "");
    const pay = await createPixPayment({
      sellerAccessToken: getPlatformAccessToken(),
      amount: semesterPrice,
      description: `Anuidade semestral proporcional — ${(league as any).name}`,
      payerEmail,
      payerFirstName: firstName || "Presidente",
      payerLastName: rest.join(" ") || firstName || "Liga",
      payerCpf,
      externalReference: `anuidade_semestral:${data.league_id}`,
      notificationUrl: WEBHOOK_URL,
      applicationFee: 0,
      metadata: {
        league_id: data.league_id,
        user_id: userId,
        kind: "anuidade_semestral",
        success_url: `${origin}/presidente/${(league as any).slug}?anuidade=ok`,
        failure_url: `${origin}/presidente/${(league as any).slug}?anuidade=fail`,
      },
      expiresInMinutes: 60,
      idempotencyKey: `anuidade-semestral-${data.league_id}-${Date.now()}`,
    });
    const tx = pay?.point_of_interaction?.transaction_data ?? {};

    return {
      payment_id: String(pay?.id ?? ""),
      amount: semesterPrice,
      full_amount: pricing.full,
      discount: pricing.discount,
      months_left: pricing.monthsAndDaysLeft,
      paid_until: pricing.end.toISOString().slice(0, 10),
      qr_code: tx.qr_code as string | undefined,
      qr_code_base64: tx.qr_code_base64 as string | undefined,
      ticket_url: tx.ticket_url as string | undefined,
      expires_at: pay?.date_of_expiration as string | undefined,
    };
  });

/**
 * Cancela a assinatura mensal (preapproval) ativa de uma liga.
 * - Tenta cancelar quaisquer preapprovals ativos no Mercado Pago (best-effort).
 * - Sempre marca a liga como sem assinatura ativa localmente (paid_until=null,
 *   published=false), garantindo que a UI reflita o cancelamento mesmo quando
 *   o MP devolve 401/unauthorized ou não encontra assinatura.
 * - Permitido para a presidência da liga OU admin master.
 */
export const cancelLeagueSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: league } = await supabaseAdmin
      .from("leagues").select("id, president_id, president2_id").eq("id", data.league_id).maybeSingle();
    if (!league) throw new Error("Liga não encontrada");

    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin_master", { _user_id: userId });
    if ((league as any).president_id !== userId && !isAdmin) {
      throw new Error("Apenas a presidência ou admin master pode cancelar");
    }

    let mpCancelled = 0;
    try {
      const search = await mpFetch<any>(
        `/preapproval/search?external_reference=anuidade:${data.league_id}`,
      );
      const results = search?.results ?? [];
      for (const sub of results) {
        if (sub?.status === "authorized" || sub?.status === "paused" || sub?.status === "pending") {
          try {
            await mpFetch(`/preapproval/${sub.id}`, { method: "PUT", body: { status: "cancelled" } });
            mpCancelled++;
          } catch (e) {
            console.error("Falha ao cancelar preapproval", sub?.id, e);
          }
        }
      }
    } catch (e) {
      console.error("Busca de preapproval no MP falhou (seguindo com cancelamento local)", e);
    }

    const { error: upErr } = await supabaseAdmin
      .from("leagues")
      .update({ paid_until: null, published: false })
      .eq("id", data.league_id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, mp_cancelled: mpCancelled };
  });

/**
 * Cancela qualquer assinatura ativa da liga e exclui a liga.
 * Apenas admin master pode excluir.
 */
export const deleteLeagueWithCancel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin_master", { _user_id: userId });
    if (!isAdmin) throw new Error("Apenas admin master pode excluir ligas.");

    // Best-effort: cancela quaisquer preapprovals ativos da liga
    try {
      const search = await mpFetch<any>(
        `/preapproval/search?external_reference=anuidade:${data.league_id}`,
      );
      const results = search?.results ?? [];
      for (const sub of results) {
        if (sub?.status === "authorized" || sub?.status === "paused" || sub?.status === "pending") {
          try {
            await mpFetch(`/preapproval/${sub.id}`, {
              method: "PUT",
              body: { status: "cancelled" },
            });
          } catch (e) {
            console.error("Falha ao cancelar preapproval", sub?.id, e);
          }
        }
      }
    } catch (e) {
      console.error("Busca de preapproval falhou (seguindo com exclusão)", e);
    }

    // Remove dados filhos (sem FK cascade no schema)
    const childTables = [
      "league_activities",
      "league_attendance",
      "league_content",
      "league_leave_requests",
      "league_memberships",
      "league_news",
      "league_notifications",
      "league_schedule_items",
      "league_selection_quotas",
      "league_selection_ranking_history",
      "league_selection_registrations",
      "league_subscriptions",
      "league_mp_accounts",
      "semester_payments",
      "semester_cycles",
    ] as const;
    for (const t of childTables) {
      const { error: e } = await supabaseAdmin.from(t).delete().eq("league_id", data.league_id);
      if (e) console.error(`Falha ao limpar ${t}`, e);
    }

    // Eventos e tabelas que dependem deles (minicursos, inscrições)
    const { data: events } = await supabaseAdmin
      .from("league_events")
      .select("id, image_url")
      .eq("league_id", data.league_id);
    const eventIds = (events ?? []).map((e: any) => e.id);
    if (eventIds.length) {
      const { data: mcs } = await supabaseAdmin
        .from("league_minicourses")
        .select("id")
        .in("event_id", eventIds);
      const mcIds = (mcs ?? []).map((m: any) => m.id);
      if (mcIds.length) {
        await supabaseAdmin.from("minicourse_registrations").delete().in("minicourse_id", mcIds);
      }
      await supabaseAdmin.from("league_minicourses").delete().in("event_id", eventIds);
      await supabaseAdmin.from("event_registrations").delete().in("event_id", eventIds);
      await supabaseAdmin.from("league_events").delete().in("id", eventIds);
    }

    // Limpeza de imagens do bucket 'images' (liga, eventos, notícias, atividades)
    try {
      const { data: league } = await supabaseAdmin.from("leagues").select("icon_url").eq("id", data.league_id).maybeSingle();
      const { data: news } = await supabaseAdmin.from("league_news").select("image_url").eq("league_id", data.league_id);
      const { data: acts } = await supabaseAdmin.from("league_activities").select("image_url").eq("league_id", data.league_id);
      const urls: string[] = [];
      if ((league as any)?.icon_url) urls.push((league as any).icon_url);
      for (const e of events ?? []) if ((e as any).image_url) urls.push((e as any).image_url);
      for (const n of news ?? []) if ((n as any).image_url) urls.push((n as any).image_url);
      for (const a of acts ?? []) if ((a as any).image_url) urls.push((a as any).image_url);
      const paths = urls.map((u) => {
        const idx = u.indexOf("/images/");
        return idx !== -1 ? decodeURIComponent(u.slice(idx + "/images/".length)) : "";
      }).filter(Boolean);
      if (paths.length) await supabaseAdmin.storage.from("images").remove(paths);
    } catch (e) {
      console.error("Falha ao limpar imagens do storage", e);
    }


    // Quiz sets e perguntas
    const { data: qsets } = await supabaseAdmin
      .from("league_quiz_sets")
      .select("id")
      .eq("league_id", data.league_id);
    const qsetIds = (qsets ?? []).map((q: any) => q.id);
    if (qsetIds.length) {
      await supabaseAdmin.from("league_quizzes").delete().in("quiz_set_id", qsetIds);
      await supabaseAdmin.from("league_quiz_sets").delete().in("id", qsetIds);
    }

    const { error } = await supabaseAdmin.from("leagues").delete().eq("id", data.league_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Exporta o helper para uso pelo webhook (cálculo de paid_until semestral)
export { nextSemesterEnd };
