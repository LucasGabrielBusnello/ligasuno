import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: any) {
  const { data } = await context.supabase.rpc("is_admin_master", { _user_id: context.userId });
  if (!data) throw new Error("Acesso restrito aos administradores.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const adminListSimCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const { data, error } = await db.from("sim_cases").select("*").order("area").order("level");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSaveSimCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        title: z.string().min(3),
        area: z.string().min(2),
        level: z.number().int().min(1).max(6),
        summary: z.string().nullable().optional(),
        diagnosis: z.string().min(2),
        expected_conduct: z.string().nullable().optional(),
        hidden_history: z.string().nullable().optional(),
        patient_image_url: z.string().nullable().optional(),
        published: z.boolean().default(true),
        patient: z.any(),
        triage: z.any(),
        findings: z.any(),
        exams: z.any(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { id: _id, ...rest } = data;
    const row = { ...rest, created_by: context.userId } as any;
    if (data.id) {
      const { error } = await db.from("sim_cases").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await db.from("sim_cases").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const adminDeleteSimCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db.from("sim_cases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGenerateSimCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ area: z.string().min(2), level: z.number().int().min(1).max(6), count: z.number().int().min(1).max(3) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { generateCases } = await import("./sim.server");
    const casos = await generateCases(data.area, data.level, data.count);
    if (!casos.length) throw new Error("A IA não retornou casos. Tente novamente.");
    const rows = casos.map((c: any) => ({
      title: String(c.title ?? "Caso clínico"),
      area: data.area,
      level: data.level,
      summary: c.summary ?? null,
      patient: c.patient ?? {},
      triage: c.triage ?? {},
      hidden_history: c.hidden_history ?? null,
      findings: c.findings ?? [],
      exams: c.exams ?? [],
      diagnosis: String(c.diagnosis ?? "—"),
      expected_conduct: c.expected_conduct ?? null,
      published: true,
      created_by: context.userId,
    }));
    const { error } = await db.from("sim_cases").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const adminListSimFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const { data } = await db
      .from("sim_feedback")
      .select("*, sim_sessions(hypothesis, score, sim_cases(title, diagnosis))")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const adminResolveSimFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        rule: z.string().max(1000).nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db.from("sim_feedback").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "approved" && data.rule && data.rule.trim().length > 3) {
      const { error: e2 } = await db.from("sim_ai_rules").insert({ rule: data.rule.trim(), source_feedback_id: data.id });
      if (e2) throw new Error(e2.message);
    }
    return { ok: true };
  });

export const adminListSimRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const { data } = await db.from("sim_ai_rules").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminSaveSimRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ id: z.string().uuid().nullable().optional(), rule: z.string().min(4).max(1000), active: z.boolean().default(true) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    if (data.id) {
      const { error } = await db.from("sim_ai_rules").update({ rule: data.rule, active: data.active }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await db.from("sim_ai_rules").insert({ rule: data.rule, active: data.active }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const adminDeleteSimRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db.from("sim_ai_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveSimSound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        category: z.string().min(2),
        region: z.string().min(1),
        finding_key: z.string().min(1),
        label: z.string().min(2),
        description: z.string().nullable().optional(),
        audio_url: z.string().nullable().optional(),
        license: z.string().nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { id: _id, ...rest } = data;
    const row = { ...rest } as any;
    if (data.id) {
      const { error } = await db.from("sim_auscultation_sounds").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await db.from("sim_auscultation_sounds").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const adminDeleteSimSound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { error } = await db.from("sim_auscultation_sounds").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
