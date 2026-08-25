import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicCase(c: any) {
  const p = c.patient ?? {};
  return {
    id: c.id,
    title: c.title,
    area: c.area,
    level: c.level,
    patient: { name: p.name ?? "Paciente", age: p.age ?? null, gender: p.gender ?? null, occupation: p.occupation ?? null },
    triage: c.triage ?? {},
    patient_image_url: c.patient_image_url ?? null,
  };
}

export const startSimSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ level: z.number().int().min(1).max(7), area: z.string().min(1).max(80).nullable().optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertCredits, chargeCaseStart } = await import("./sim-billing.server");
    await assertCredits(context.userId);

    let q = supabaseAdmin.from("sim_cases").select("*").eq("published", true).eq("level", data.level);
    if (data.area) q = q.eq("area", data.area);
    const { data: cases, error } = await q;
    if (error) throw new Error(error.message);
    if (!cases?.length) throw new Error("Ainda não há casos cadastrados para esse nível e área. Escolha outra combinação.");

    const { data: done } = await supabaseAdmin
      .from("sim_sessions")
      .select("case_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const seen = new Set((done ?? []).map((d: any) => d.case_id));
    const pool = cases.filter((c: any) => !seen.has(c.id));
    const chosen = (pool.length ? pool : cases)[Math.floor(Math.random() * (pool.length ? pool.length : cases.length))] as any;

    // Variáveis comportamentais do paciente, sorteadas localmente (custo zero).
    const { buildPersona } = await import("./sim-persona");
    const p = chosen.patient ?? {};
    const persona = buildPersona({
      age: p.age ?? null,
      occupation: p.occupation ?? null,
      area: chosen.area,
      level: chosen.level,
      sensitiveTopic: /ist|dst|hiv|sífilis|droga|álcool|alcool|depress|ansiedad|psiqui|sexual/i.test(
        `${chosen.area} ${chosen.diagnosis} ${chosen.hidden_history ?? ""}`,
      ),
    });

    const { data: session, error: e2 } = await supabaseAdmin
      .from("sim_sessions")
      .insert({ user_id: context.userId, case_id: chosen.id, level: chosen.level, area: chosen.area, persona: persona as any })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);

    // 1 crédito = 1 caso clínico.
    const balance = await chargeCaseStart(context.userId, session.id as string);
    return { sessionId: session.id as string, case: publicCase(chosen), balance };
  });


export const resumeSimSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin
      .from("sim_sessions")
      .select("*, sim_cases(*)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s || (s as any).user_id !== context.userId) throw new Error("Sessão não encontrada.");
    const row: any = s;
    if (row.status !== "active") throw new Error("Esta sessão de treino já foi encerrada.");
    const { sessionTokenState } = await import("./sim-billing.server");
    const cap = await sessionTokenState(row.id);
    return {
      sessionId: row.id as string,
      case: publicCase(row.sim_cases),
      transcript: (row.transcript ?? []) as any[],
      physical_findings: (row.physical_findings ?? []) as any[],
      exam_requests: (row.exam_requests ?? []) as any[],
      anamnese: row.anamnese ?? "",
      hypothesis: row.hypothesis ?? "",
      capReached: cap.capReached,
    };
  });


export const saveSimNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ sessionId: z.string().uuid(), anamnese: z.string().max(8000).default(""), hypothesis: z.string().max(500).default("") }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.from("sim_sessions").select("id, user_id, status").eq("id", data.sessionId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!s || (s as any).user_id !== context.userId) throw new Error("Sessão não encontrada.");
    if ((s as any).status !== "active") throw new Error("Esta sessão de treino já foi encerrada.");
    const update: any = {};
    if (data.anamnese !== undefined) update.anamnese = data.anamnese;
    if (data.hypothesis !== undefined) update.hypothesis = data.hypothesis;
    const { error: e2 } = await supabaseAdmin.from("sim_sessions").update(update).eq("id", data.sessionId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

async function loadSession(userId: string, sessionId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("sim_sessions")
    .select("*, sim_cases(*)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new Error("Sessão não encontrada.");
  if (data.status !== "active") throw new Error("Esta sessão de treino já foi encerrada.");
  return { supabaseAdmin, session: data as any, sim: (data as any).sim_cases };
}

/** Timeout de segurança: bloqueia novas interações quando o caso bateu o teto de tokens. */
async function assertUnderTokenCap(sessionId: string) {
  const { sessionTokenState, TIMEOUT_MESSAGE } = await import("./sim-billing.server");
  const st = await sessionTokenState(sessionId);
  if (st.capReached) {
    const e = new Error(TIMEOUT_MESSAGE);
    (e as any).capReached = true;
    throw e;
  }
}

export const simSay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid(), message: z.string().min(1).max(1500) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, session, sim } = await loadSession(context.userId, data.sessionId);
    const { recordUsage, sessionTokenState, TIMEOUT_MESSAGE } = await import("./sim-billing.server");

    // Teto atingido antes desta mensagem: o paciente já foi liberado.
    const before = await sessionTokenState(session.id);
    if (before.capReached) {
      return { reply: TIMEOUT_MESSAGE, findings: [], balance: 0, capReached: true, system: true };
    }

    const { patientTurn } = await import("./sim.server");
    const out = await patientTurn(sim, session.transcript ?? [], data.message, session.persona ?? null);
    const billing = await recordUsage({
      userId: context.userId,
      sessionId: session.id,
      phase: "chat",
      model: out.model,
      usage: out.usage,
      tier: "chat",
    });

    const reply = billing.capReached ? `${out.reply}\n\n${TIMEOUT_MESSAGE}` : out.reply;
    const transcript = [
      ...(session.transcript ?? []),
      { role: "user", content: data.message, at: new Date().toISOString() },
      { role: "patient", content: reply, at: new Date().toISOString() },
    ];
    const prev = (session.physical_findings ?? []) as any[];
    const merged = [...prev];
    for (const f of out.findings as any[]) if (!merged.some((m) => m.key === f.key)) merged.push(f);

    await supabaseAdmin.from("sim_sessions").update({ transcript, physical_findings: merged }).eq("id", session.id);
    return { reply, findings: out.findings, balance: billing.balance, capReached: billing.capReached };
  });

export const simExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid(), examName: z.string().min(2).max(160) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, session, sim } = await loadSession(context.userId, data.sessionId);
    const { examResult } = await import("./sim.server");
    const { recordUsage } = await import("./sim-billing.server");
    await assertUnderTokenCap(session.id);
    const result = await examResult(sim, data.examName);
    const billing = await recordUsage({
      userId: context.userId,
      sessionId: session.id,
      phase: "exame_complementar",
      model: result.model,
      usage: result.usage,
      tier: "chat",
    });
    const list = [...((session.exam_requests ?? []) as any[]), { ...result, at: new Date().toISOString() }];
    await supabaseAdmin.from("sim_sessions").update({ exam_requests: list }).eq("id", session.id);
    return { ...result, balance: billing.balance, capReached: billing.capReached };
  });


export const simRevealFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid(), key: z.string().min(1).max(80) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, session, sim } = await loadSession(context.userId, data.sessionId);
    const findings = (Array.isArray(sim.findings) ? sim.findings : []) as any[];
    let f = findings.find((x) => x.key === data.key);
    if (!f) {
      // Manobra do catálogo padrão que este caso não descreve: gera achado coerente.
      const { resolveFindings } = await import("./sim.server");
      const { recordUsage } = await import("./sim-billing.server");
      await assertUnderTokenCap(session.id);

      const out = await resolveFindings(sim, [data.key]);
      f = out.findings[0];
      if (!f) throw new Error("Essa manobra não está disponível.");
      await recordUsage({
        userId: context.userId,
        sessionId: session.id,
        phase: "exame_fisico",
        model: out.model,
        usage: out.usage,
        tier: "chat",
      });
    }
    const prev = (session.physical_findings ?? []) as any[];
    if (!prev.some((m) => m.key === f.key)) {
      await supabaseAdmin.from("sim_sessions").update({ physical_findings: [...prev, f] }).eq("id", session.id);
    }
    return f;
  });

export const simExamMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { session, sim } = await loadSession(context.userId, data.sessionId);
    const { PHYSICAL_EXAM_CATALOG } = await import("./sim-exam-catalog");
    const findings = (Array.isArray(sim.findings) ? sim.findings : []) as any[];
    const revealed = new Set(((session.physical_findings ?? []) as any[]).map((f) => f.key));
    // Catálogo completo de manobras + eventuais manobras exclusivas deste caso.
    const items = PHYSICAL_EXAM_CATALOG.map((i) => {
      const own = findings.find((f) => f.key === i.key);
      return {
        key: i.key,
        label: own?.label ?? i.label,
        group: i.group,
        sound_category: own?.sound_category ?? i.sound_category,
        revealed: revealed.has(i.key),
      };
    });
    for (const f of findings) {
      if (!items.some((i) => i.key === f.key)) {
        items.push({
          key: f.key,
          label: f.label,
          group: "Específicas do caso",
          sound_category: f.sound_category ?? "nenhum",
          revealed: revealed.has(f.key),
        });
      }
    }
    return items;
  });

export const simFinish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        anamnese: z.string().max(8000).default(""),
        hypothesis: z.string().min(2).max(500),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, session, sim } = await loadSession(context.userId, data.sessionId);
    const { recordUsage } = await import("./sim-billing.server");
    const { data: rules } = await supabaseAdmin.from("sim_ai_rules").select("rule").eq("active", true).limit(50);
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("full_name, username")
      .eq("id", context.userId)
      .maybeSingle();
    const studentName = ((prof as any)?.full_name || (prof as any)?.username || "").trim().split(/\s+/)[0] ?? "";
    const { gradeSession } = await import("./sim.server");
    const review = await gradeSession({
      c: sim,
      transcript: session.transcript ?? [],
      exams: session.exam_requests ?? [],
      findings: session.physical_findings ?? [],
      anamnese: data.anamnese,
      hypothesis: data.hypothesis,
      rules: (rules ?? []).map((r: any) => r.rule),
      studentName,
    });
    const billing = await recordUsage({
      userId: context.userId,
      sessionId: session.id,
      phase: "correcao_preceptor",
      model: review.model,
      usage: review.usage,
      tier: "grade",
    });
    await supabaseAdmin
      .from("sim_sessions")
      .update({
        status: "finished",
        anamnese: data.anamnese,
        hypothesis: data.hypothesis,
        score: review.score,
        review,
        finished_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    return { ...review, balance: billing.balance, case: { title: sim.title, diagnosis: sim.diagnosis, expected_conduct: sim.expected_conduct, hidden_history: sim.hidden_history } };
  });

/**
 * Loop de esclarecimento de conduta: o aluno responde até 2 perguntas do
 * preceptor e a avaliação roda em modelo rápido/barato (Gemini Flash).
 */
export const answerSimClarifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        answers: z
          .array(z.object({ question: z.string().min(1).max(500), answer: z.string().min(1).max(2000) }))
          .min(1)
          .max(2),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin
      .from("sim_sessions")
      .select("*, sim_cases(*)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row: any = s;
    if (!row || row.user_id !== context.userId) throw new Error("Sessão não encontrada.");

    const { evaluateClarifications } = await import("./sim.server");
    const { recordUsage } = await import("./sim-billing.server");
    const out = await evaluateClarifications({ c: row.sim_cases, items: data.answers });
    await recordUsage({
      userId: context.userId,
      sessionId: row.id,
      phase: "esclarecimento",
      model: out.model,
      usage: out.usage,
      tier: "chat",
    });

    const review = { ...(row.review ?? {}), veredictos_esclarecimento: out.veredictos, perguntas_esclarecimento: [] };
    await supabaseAdmin
      .from("sim_sessions")
      .update({ review, clarifications: data.answers as any })
      .eq("id", row.id);
    return { veredictos: out.veredictos };
  });


export const regenerateSimReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin
      .from("sim_sessions")
      .select("*, sim_cases(*)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s || (s as any).user_id !== context.userId) throw new Error("Sessão não encontrada.");
    const row: any = s;
    if (row.status !== "finished") throw new Error("Só é possível gerar parecer novamente para treinos finalizados.");

    const { recordUsage } = await import("./sim-billing.server");
    const { data: rules } = await supabaseAdmin.from("sim_ai_rules").select("rule").eq("active", true).limit(50);
    const { gradeSession } = await import("./sim.server");
    const review = await gradeSession({
      c: row.sim_cases,
      transcript: row.transcript ?? [],
      exams: row.exam_requests ?? [],
      findings: row.physical_findings ?? [],
      anamnese: row.anamnese ?? "",
      hypothesis: row.hypothesis ?? "",
      rules: (rules ?? []).map((r: any) => r.rule),
    });
    const billing = await recordUsage({
      userId: context.userId,
      sessionId: row.id,
      phase: "correcao_preceptor",
      model: review.model,
      usage: review.usage,
      tier: "grade",
    });
    await supabaseAdmin
      .from("sim_sessions")
      .update({ score: review.score, review })
      .eq("id", row.id);
    return { review, balance: billing.balance };
  });

/** CHAMADA B — aula teórica (Gemini Flash), disparada em paralelo com a correção. */
export const simTheory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, session, sim } = await loadSession(context.userId, data.sessionId);
    const { recordUsage } = await import("./sim-billing.server");
    const { theoryLesson } = await import("./sim.server");
    const out = await theoryLesson({ diagnosis: sim.diagnosis, area: sim.area, level: sim.level });
    await recordUsage({
      userId: context.userId,
      sessionId: session.id,
      phase: "revisao_teorica",
      model: out.model,
      usage: out.usage,
      tier: "chat",
    });
    // A correção (chamada A) roda em paralelo e também grava `review`.
    // Espera ela terminar (ou 20s) antes de mesclar, para não sobrescrever.
    let fresh: any = null;
    for (let i = 0; i < 20; i++) {
      const { data: row } = await supabaseAdmin
        .from("sim_sessions")
        .select("review, status")
        .eq("id", session.id)
        .maybeSingle();
      fresh = (row as any)?.review ?? null;
      if ((row as any)?.status === "finished") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    await supabaseAdmin
      .from("sim_sessions")
      .update({ review: { ...(fresh ?? {}), aula: out.aula } })
      .eq("id", session.id);
    return { aula: out.aula };

  });


export const simTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ audio: z.string().min(50).max(9_000_000), format: z.enum(["webm", "m4a", "mp3", "wav", "ogg"]) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { recordUsage } = await import("./sim-billing.server");
    const { transcribeAudio } = await import("./sim.server");
    const out = await transcribeAudio(data.audio, data.format);
    const billing = await recordUsage({
      userId: context.userId,
      phase: "transcricao",
      model: out.model,
      usage: out.usage,
      tier: "chat",
    });
    return { text: out.text, balance: billing.balance };
  });

export const listMySimSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sim_sessions")
      .select("id, status, score, area, level, created_at, finished_at, hypothesis, review, sim_cases(title, diagnosis)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []).map((s: any) => ({
      id: s.id,
      status: s.status,
      score: s.score,
      area: s.area,
      level: s.level,
      created_at: s.created_at,
      finished_at: s.finished_at,
      hypothesis: s.hypothesis,
      review: s.review,
      title: s.sim_cases?.title ?? "Caso clínico",
      diagnosis: s.status === "finished" ? s.sim_cases?.diagnosis ?? null : null,
    }));
  });

export const getSimSessionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin
      .from("sim_sessions")
      .select("*, sim_cases(title, area, diagnosis, expected_conduct)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s || (s as any).user_id !== context.userId) throw new Error("Sessão não encontrada.");
    const row: any = s;
    const finished = row.status === "finished";
    return {
      id: row.id,
      status: row.status,
      score: row.score,
      area: row.area,
      level: row.level,
      created_at: row.created_at,
      finished_at: row.finished_at,
      title: row.sim_cases?.title ?? "Caso clínico",
      transcript: (row.transcript ?? []) as any[],
      physical_findings: (row.physical_findings ?? []) as any[],
      exam_requests: (row.exam_requests ?? []) as any[],
      anamnese: row.anamnese ?? "",
      hypothesis: row.hypothesis ?? "",
      review: row.review ?? null,
      diagnosis: finished ? row.sim_cases?.diagnosis ?? null : null,
      expected_conduct: finished ? row.sim_cases?.expected_conduct ?? null : null,
    };
  });


export const sendSimFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ sessionId: z.string().uuid(), rating: z.enum(["up", "down"]), comment: z.string().max(2000).default("") }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("sim_sessions").select("id, user_id, review").eq("id", data.sessionId).maybeSingle();
    if (!s || (s as any).user_id !== context.userId) throw new Error("Sessão não encontrada.");
    const { error } = await supabaseAdmin.from("sim_feedback").insert({
      session_id: data.sessionId,
      user_id: context.userId,
      rating: data.rating,
      comment: data.comment,
      ai_review: (s as any).review ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const simPreceptorHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ sessionId: z.string().uuid(), previousHints: z.array(z.string().max(600)).max(10).default([]) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, session, sim } = await loadSession(context.userId, data.sessionId);
    if (Number(sim.level) > 2) return { off_track: false, hint: "" };
    const { recordUsage } = await import("./sim-billing.server");
    const { preceptorHint } = await import("./sim.server");
    const out = await preceptorHint({
      c: sim,
      transcript: session.transcript ?? [],
      exams: session.exam_requests ?? [],
      findings: session.physical_findings ?? [],
      previousHints: data.previousHints,
    });
    await recordUsage({
      userId: context.userId,
      sessionId: session.id,
      phase: "dica_preceptor",
      model: out.model,
      usage: out.usage,
      tier: "chat",
    });
    void supabaseAdmin;
    return { off_track: out.off_track, hint: out.hint };
  });
