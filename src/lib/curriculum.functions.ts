import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ATM_CLASSES = ["ATM26", "ATM27", "ATM28", "ATM29", "ATM30", "ATM31"] as const;

async function assertCoord(supabase: any, userId: string) {
  const { data: admin } = await supabase.rpc("is_admin_master", { _user_id: userId });
  if (admin) return;
  const { data: prof } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  const email = (prof as any)?.email?.toLowerCase();
  if (!email) throw new Error("Sem permissão");
  const { data: cs } = await supabase.from("coordination_staff").select("email").ilike("email", email).maybeSingle();
  if (!cs) throw new Error("Sem permissão de coordenação");
}

/* ============ SUBJECTS (componentes curriculares) ============ */

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subjects")
      .select("id,name,description,class_codes,subdivisions,professor,professor_contact,workload_hours,semester")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

const subjectInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullish(),
  class_codes: z.array(z.enum(ATM_CLASSES)).default([]),
  subdivisions: z.array(z.string().min(1)).default(["A"]),
  professor: z.string().nullish(),
  professor_contact: z.string().nullish(),
  workload_hours: z.number().int().positive().nullish(),
});

export const upsertSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => subjectInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const payload: any = {
      name: data.name,
      description: data.description ?? null,
      class_codes: data.class_codes,
      subdivisions: data.subdivisions.length ? data.subdivisions : ["A"],
      professor: data.professor ?? null,
      professor_contact: data.professor_contact ?? null,
      workload_hours: data.workload_hours ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("subjects").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase.from("subjects").insert(payload).select("id").single();
    if (error) throw error;
    return { id: (inserted as any).id };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const { error } = await context.supabase.from("subjects").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ============ ACADEMIC TERMS (semestres letivos) ============ */

export const listTerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("academic_terms").select("*").order("start_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const termInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  is_current: z.boolean().default(false),
});

export const upsertTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => termInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    if (data.is_current) {
      await context.supabase.from("academic_terms").update({ is_current: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const payload: any = {
      name: data.name, start_date: data.start_date, end_date: data.end_date, is_current: data.is_current,
    };
    if (data.id) {
      const { error } = await context.supabase.from("academic_terms").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("academic_terms").insert(payload).select("id").single();
    if (error) throw error;
    return { id: (ins as any).id };
  });

export const deleteTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const { error } = await context.supabase.from("academic_terms").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ============ PERSONAL SCHEDULE ITEMS ============ */

export const listPersonalItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ from: z.string().optional(), to: z.string().optional() }).parse(v ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("personal_schedule_items").select("*").eq("user_id", context.userId).order("date");
    if (data.from) q = q.gte("date", data.from);
    if (data.to) q = q.lte("date", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const personalInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  date: z.string(),
  start_time: z.string().nullish(),
  end_time: z.string().nullish(),
  color: z.string().default("#22c55e"),
  notes: z.string().nullish(),
});

export const upsertPersonalItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => personalInput.parse(v))
  .handler(async ({ data, context }) => {
    const payload: any = {
      user_id: context.userId,
      title: data.title,
      date: data.date,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      color: data.color,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("personal_schedule_items").update(payload).eq("id", data.id).eq("user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("personal_schedule_items").insert(payload).select("id").single();
    if (error) throw error;
    return { id: (ins as any).id };
  });

export const deletePersonalItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("personal_schedule_items").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
