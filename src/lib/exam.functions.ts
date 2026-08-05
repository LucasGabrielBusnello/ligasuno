import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendGmail, emailLayout, emailInfoCard } from "@/lib/gmail.server";

// ============== helpers ==============
function gen4digits(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10000).padStart(4, "0");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function assertPresident(leagueId: string, userId: string) {
  const [{ data: league }, { data: roles }] = await Promise.all([
    (supabaseAdmin as any).from("leagues").select("president_id, president2_id").eq("id", leagueId).maybeSingle(),
    (supabaseAdmin as any).from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin_master");
  if (!isAdmin && (!league || ((league as any).president_id !== userId && (league as any).president2_id !== userId))) {
    throw new Error("Acesso negado");
  }
}

async function ensureExam(leagueId: string) {
  const { data: existing } = await (supabaseAdmin as any).from("league_selection_exams").select("*").eq("league_id", leagueId).maybeSingle();
  if (existing) return existing;
  const { data, error } = await (supabaseAdmin as any).from("league_selection_exams").insert({
    league_id: leagueId,
    time_limit_minutes: 30,
    reentry_code: gen4digits(),
  }).select("*").single();
  if (error || !data) throw new Error(error?.message || "Falha ao criar prova");
  return data;
}

// ============== President: builder ==============
export const getExamConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPresident(data.league_id, context.userId);
    const exam = await ensureExam(data.league_id);
    const { data: qs } = await (supabaseAdmin as any).from("league_selection_exam_questions")
      .select("*").eq("exam_id", (exam as any).id).order("display_order");
    return { exam, questions: qs ?? [] };
  });

export const upsertExamConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    time_limit_minutes: z.number().int().min(1).max(360),
    shuffle: z.boolean(),
    send_answers_email: z.boolean(),
    published: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPresident(data.league_id, context.userId);
    const exam = await ensureExam(data.league_id);
    const { error } = await (supabaseAdmin as any).from("league_selection_exams").update({
      time_limit_minutes: data.time_limit_minutes,
      shuffle: data.shuffle,
      send_answers_email: data.send_answers_email,
      published: data.published,
    }).eq("id", (exam as any).id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addExamQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    question: z.string().min(1).max(2000),
    options: z.array(z.string().min(1).max(500)).min(2).max(8),
    correct_answer: z.number().int().min(0),
    image_url: z.string().url().max(1024).nullish(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPresident(data.league_id, context.userId);
    if (data.correct_answer >= data.options.length) throw new Error("Alternativa correta inválida");
    const exam = await ensureExam(data.league_id);
    const { count } = await (supabaseAdmin as any).from("league_selection_exam_questions")
      .select("id", { count: "exact", head: true }).eq("exam_id", (exam as any).id);
    const { error } = await (supabaseAdmin as any).from("league_selection_exam_questions").insert({
      exam_id: (exam as any).id,
      question: data.question,
      options: data.options,
      correct_answer: data.correct_answer,
      image_url: data.image_url || null,
      display_order: count ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateExamQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    question_id: z.string().uuid(),
    question: z.string().min(1).max(2000),
    options: z.array(z.string().min(1).max(500)).min(2).max(8),
    correct_answer: z.number().int().min(0),
    image_url: z.string().url().max(1024).nullish(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPresident(data.league_id, context.userId);
    if (data.correct_answer >= data.options.length) throw new Error("Alternativa correta inválida");
    const { error } = await (supabaseAdmin as any).from("league_selection_exam_questions")
      .update({ question: data.question, options: data.options, correct_answer: data.correct_answer, image_url: data.image_url || null })
      .eq("id", data.question_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const deleteExamQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    question_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPresident(data.league_id, context.userId);
    const { error } = await (supabaseAdmin as any).from("league_selection_exam_questions")
      .delete().eq("id", data.question_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const getReentryCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPresident(data.league_id, context.userId);
    const exam = await ensureExam(data.league_id);
    return { code: (exam as any).reentry_code as string };
  });

export const regenerateReentryCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPresident(data.league_id, context.userId);
    const exam = await ensureExam(data.league_id);
    const code = gen4digits();
    const { error } = await (supabaseAdmin as any).from("league_selection_exams")
      .update({ reentry_code: code }).eq("id", (exam as any).id);
    if (error) throw new Error(error.message);
    return { code };
  });

// ============== Inscrito: take exam ==============

async function loadRegistration(leagueId: string, userId: string) {
  const { data } = await (supabaseAdmin as any).from("league_selection_registrations")
    .select("*").eq("league_id", leagueId).eq("user_id", userId).maybeSingle();
  return data as any | null;
}

function computeTimeRemaining(exam: any, attempt: any): number {
  const limitMs = exam.time_limit_minutes * 60 * 1000;
  let used = Number(attempt.time_used_ms) || 0;
  if (!attempt.paused_at && !attempt.submitted_at) {
    used += Date.now() - new Date(attempt.started_at).getTime();
  }
  return Math.max(0, limitMs - used);
}

function buildSanitizedPayload(exam: any, attempt: any, questions: any[]) {
  // Apply per-attempt question order and per-question option order
  const qOrder: string[] = attempt.question_order ?? [];
  const optOrders: Record<string, number[]> = attempt.option_orders ?? {};
  const byId = new Map(questions.map((q: any) => [q.id, q]));
  const orderedQs = qOrder
    .map((qid: string) => byId.get(qid))
    .filter(Boolean)
    .map((q: any) => {
      const order: number[] = optOrders[q.id] ?? q.options.map((_: any, i: number) => i);
      const opts = order.map((i: number) => q.options[i]);
      return { id: q.id, question: q.question, options: opts, image_url: q.image_url ?? null };
    });
  return {
    exam_id: exam.id,
    time_limit_minutes: exam.time_limit_minutes,
    time_remaining_ms: computeTimeRemaining(exam, attempt),
    paused: !!attempt.paused_at,
    submitted: !!attempt.submitted_at,
    questions: orderedQs,
    answers: attempt.answers ?? {},
  };
}

export const startExamAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const reg = await loadRegistration(data.league_id, context.userId);
    if (!reg) throw new Error("Você não está inscrito");
    if (reg.status !== "paid") throw new Error("Inscrição não está paga");
    if (!reg.present) throw new Error("Você precisa ser marcado como presente pelo presidente para iniciar a prova");

    const { data: exam } = await (supabaseAdmin as any).from("league_selection_exams")
      .select("*").eq("league_id", data.league_id).maybeSingle();
    if (!exam || !(exam as any).published) throw new Error("Prova ainda não publicada");

    const { data: questions } = await (supabaseAdmin as any).from("league_selection_exam_questions")
      .select("*").eq("exam_id", (exam as any).id).order("display_order");
    if (!questions || questions.length === 0) throw new Error("Prova sem questões");

    let { data: attempt } = await (supabaseAdmin as any).from("league_selection_exam_attempts")
      .select("*").eq("registration_id", reg.id).maybeSingle();

    if (attempt && (attempt as any).submitted_at) {
      throw new Error("Você já enviou esta prova");
    }

    if (!attempt) {
      const doShuffle = !!(exam as any).shuffle;
      const qOrder = doShuffle ? shuffle(questions.map((q: any) => q.id)) : questions.map((q: any) => q.id);
      const optOrders: Record<string, number[]> = {};
      for (const q of questions as any[]) {
        const idxs = q.options.map((_: any, i: number) => i);
        optOrders[q.id] = doShuffle ? shuffle(idxs) : idxs;
      }
      const { data: created, error } = await (supabaseAdmin as any).from("league_selection_exam_attempts").insert({
        exam_id: (exam as any).id,
        registration_id: reg.id,
        user_id: context.userId,
        question_order: qOrder,
        option_orders: optOrders,
        started_at: new Date().toISOString(),
        time_used_ms: 0,
      }).select("*").single();
      if (error || !created) throw new Error(error?.message || "Falha ao iniciar prova");
      attempt = created;
    } else if ((attempt as any).paused_at) {
      // Resuming a paused attempt requires the reentry code endpoint.
      // Block here if user tries to start fresh while paused.
      return { paused: true, requires_code: true } as any;
    }

    return buildSanitizedPayload(exam, attempt, questions as any[]);
  });

export const resumeExamAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    reentry_code: z.string().min(4).max(4),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const reg = await loadRegistration(data.league_id, context.userId);
    if (!reg) throw new Error("Inscrição não encontrada");
    if (!reg.present) throw new Error("Sua presença foi removida pelo presidente");

    const { data: exam } = await (supabaseAdmin as any).from("league_selection_exams")
      .select("*").eq("league_id", data.league_id).maybeSingle();
    if (!exam) throw new Error("Prova não encontrada");
    if ((exam as any).reentry_code !== data.reentry_code) throw new Error("Código incorreto");

    const { data: attempt } = await (supabaseAdmin as any).from("league_selection_exam_attempts")
      .select("*").eq("registration_id", reg.id).maybeSingle();
    if (!attempt) throw new Error("Nenhuma prova em andamento");
    if ((attempt as any).submitted_at) throw new Error("Prova já enviada");

    // Resume: keep time_used_ms, set new started_at and clear paused_at
    const { data: updated } = await (supabaseAdmin as any).from("league_selection_exam_attempts").update({
      paused_at: null,
      started_at: new Date().toISOString(),
    }).eq("id", (attempt as any).id).select("*").single();

    const { data: questions } = await (supabaseAdmin as any).from("league_selection_exam_questions")
      .select("*").eq("exam_id", (exam as any).id);
    return buildSanitizedPayload(exam, updated, questions ?? []);
  });

export const pauseExamAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const reg = await loadRegistration(data.league_id, context.userId);
    if (!reg) throw new Error("Inscrição não encontrada");
    const { data: attempt } = await (supabaseAdmin as any).from("league_selection_exam_attempts")
      .select("*").eq("registration_id", reg.id).maybeSingle();
    if (!attempt || (attempt as any).submitted_at || (attempt as any).paused_at) return { ok: true };
    const used = Number((attempt as any).time_used_ms || 0) + (Date.now() - new Date((attempt as any).started_at).getTime());
    await (supabaseAdmin as any).from("league_selection_exam_attempts").update({
      paused_at: new Date().toISOString(),
      time_used_ms: used,
    }).eq("id", (attempt as any).id);
    return { ok: true };
  });

export const saveExamAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    question_id: z.string().uuid(),
    selected: z.number().int().min(0),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const reg = await loadRegistration(data.league_id, context.userId);
    if (!reg) throw new Error("Inscrição não encontrada");
    const { data: attempt } = await (supabaseAdmin as any).from("league_selection_exam_attempts")
      .select("*").eq("registration_id", reg.id).maybeSingle();
    if (!attempt || (attempt as any).submitted_at || (attempt as any).paused_at) return { ok: false };
    const answers = { ...((attempt as any).answers ?? {}), [data.question_id]: data.selected };
    await (supabaseAdmin as any).from("league_selection_exam_attempts").update({ answers }).eq("id", (attempt as any).id);
    return { ok: true };
  });

export const submitExamAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const reg = await loadRegistration(data.league_id, context.userId);
    if (!reg) throw new Error("Inscrição não encontrada");
    const { data: exam } = await (supabaseAdmin as any).from("league_selection_exams")
      .select("*").eq("league_id", data.league_id).maybeSingle();
    if (!exam) throw new Error("Prova não encontrada");
    const { data: attempt } = await (supabaseAdmin as any).from("league_selection_exam_attempts")
      .select("*").eq("registration_id", reg.id).maybeSingle();
    if (!attempt) throw new Error("Nenhuma tentativa para enviar");
    if ((attempt as any).submitted_at) return { ok: true, already: true };

    const { data: questions } = await (supabaseAdmin as any).from("league_selection_exam_questions")
      .select("*").eq("exam_id", (exam as any).id);
    const optOrders: Record<string, number[]> = (attempt as any).option_orders ?? {};
    const answers: Record<string, number> = (attempt as any).answers ?? {};
    let score = 0;
    const detail: Array<{ q: string; given: string | null; correct: string; ok: boolean }> = [];
    for (const q of (questions ?? []) as any[]) {
      const order = optOrders[q.id] ?? q.options.map((_: any, i: number) => i);
      const selectedShuffledIdx = answers[q.id];
      const selectedOriginalIdx = typeof selectedShuffledIdx === "number" ? order[selectedShuffledIdx] : -1;
      const ok = selectedOriginalIdx === q.correct_answer;
      if (ok) score += 1;
      detail.push({
        q: q.question,
        given: typeof selectedShuffledIdx === "number" ? q.options[selectedOriginalIdx] : null,
        correct: q.options[q.correct_answer],
        ok,
      });
    }

    // delivery_position: next sequential among attempts in this exam
    const { data: prev } = await (supabaseAdmin as any).from("league_selection_exam_attempts")
      .select("delivery_position").eq("exam_id", (exam as any).id).not("delivery_position", "is", null);
    const maxPos = (prev ?? []).reduce((m: number, r: any) => Math.max(m, Number(r.delivery_position) || 0), 0);
    const delivery_position = maxPos + 1;

    await (supabaseAdmin as any).from("league_selection_exam_attempts").update({
      submitted_at: new Date().toISOString(),
      score, total: (questions ?? []).length,
      delivery_position,
    }).eq("id", (attempt as any).id);

    // Push grade + delivery_position into registration for ranking compatibility
    await (supabaseAdmin as any).from("league_selection_registrations").update({
      grade: score,
      delivery_position,
    }).eq("id", reg.id);

    // Optional email with answers
    if ((exam as any).send_answers_email && reg.email) {
      try {
        const { data: league } = await (supabaseAdmin as any).from("leagues").select("name, theme_color").eq("id", data.league_id).maybeSingle();
        const rows = detail.map((d, i) => ({
          label: `Q${i + 1}`,
          value: `<em>${d.q}</em><br><strong>Sua resposta:</strong> ${d.given ?? "—"}`,
        }));
        await sendGmail({
          to: reg.email,
          subject: `Suas respostas — Prova ${(league as any)?.name ?? ""}`,
          html: emailLayout({
            title: "Confirmação das suas respostas",
            leagueName: (league as any)?.name,
            brandColor: (league as any)?.theme_color,
            bodyHtml: `<p>Você concluiu a prova. Acertos: <strong>${score}/${(questions ?? []).length}</strong>.</p>${emailInfoCard({ title: "Suas respostas", brandColor: (league as any)?.theme_color, rows })}`,
          }),
        });
      } catch (e) {
        console.error("Falha ao enviar email de respostas", e);
      }
    }

    return { ok: true, score, total: (questions ?? []).length };
  });

// Inscrito-facing: check if exam is available
export const checkExamAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const reg = await loadRegistration(data.league_id, context.userId);
    if (!reg || reg.status !== "paid") return { available: false, reason: "not_paid" as const };
    const { data: exam } = await (supabaseAdmin as any).from("league_selection_exams")
      .select("id, published").eq("league_id", data.league_id).maybeSingle();
    if (!exam || !(exam as any).published) return { available: false, reason: "not_published" as const, present: !!reg.present };
    if (!reg.present) return { available: false, reason: "not_present" as const };
    const { data: attempt } = await (supabaseAdmin as any).from("league_selection_exam_attempts")
      .select("submitted_at, paused_at").eq("registration_id", reg.id).maybeSingle();
    if (attempt && (attempt as any).submitted_at) return { available: false, reason: "already_submitted" as const };
    return { available: true, paused: !!(attempt as any)?.paused_at };
  });
