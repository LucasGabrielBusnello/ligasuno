import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ATM_CLASSES = ["ATM26", "ATM27", "ATM28", "ATM29", "ATM30", "ATM31"] as const;
const SHIFTS = ["morning", "afternoon", "night"] as const;
const KINDS = ["class", "practice", "exam", "green_zone", "abex"] as const;

async function assertCoord(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("is_coordination", { _user_id: userId });
  if (!ok) {
    // fallback via coordination_staff email
    const { data: p } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = (p as any)?.email?.toLowerCase();
    if (email) {
      const { data: cs } = await supabase.from("coordination_staff").select("email").ilike("email", email).maybeSingle();
      if (cs) return;
    }
    throw new Error("Sem permissão de coordenação");
  }
}

/* ---------- LIST ---------- */

export const listScheduleWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      weekStart: z.string(), // yyyy-mm-dd (Monday)
      classCode: z.enum(ATM_CLASSES).optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    const start = new Date(data.weekStart + "T00:00:00");
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const endStr = end.toISOString().slice(0, 10);

    const [entries, holidays] = await Promise.all([
      context.supabase.from("schedule_entries")
        .select("id, term_id, subject_id, class_code, subdivision, date, shift, start_time, end_time, kind, is_abex, color, rescheduled_from_entry_id, rescheduled_to_date, notes, subject:subjects(id,name,professor)")
        .gte("date", data.weekStart).lte("date", endStr),
      context.supabase.from("holidays").select("id, date, label").gte("date", data.weekStart).lte("date", endStr),
    ]);
    if (entries.error) throw entries.error;
    if (holidays.error) throw holidays.error;
    return { entries: entries.data ?? [], holidays: holidays.data ?? [] };
  });

/* ---------- CRUD ---------- */

const entryInput = z.object({
  id: z.string().uuid().optional(),
  term_id: z.string().uuid().nullish(),
  subject_id: z.string().uuid().nullish(),
  class_code: z.enum(ATM_CLASSES),
  subdivision: z.string().default("A"),
  date: z.string(),
  shift: z.enum(SHIFTS),
  start_time: z.string(),
  end_time: z.string(),
  kind: z.enum(KINDS).default("class"),
  is_abex: z.boolean().default(false),
  color: z.string().nullish(),
  notes: z.string().nullish(),
});

export const upsertScheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => entryInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const payload: any = {
      term_id: data.term_id ?? null,
      subject_id: data.subject_id ?? null,
      class_code: data.class_code,
      subdivision: data.subdivision || "A",
      date: data.date,
      shift: data.shift,
      start_time: data.start_time,
      end_time: data.end_time,
      kind: data.kind,
      is_abex: data.is_abex,
      color: data.color ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("schedule_entries").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    payload.created_by = context.userId;
    const { data: ins, error } = await context.supabase.from("schedule_entries").insert(payload).select("id").single();
    if (error) throw error;
    return { id: (ins as any).id };
  });

export const deleteScheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const { error } = await context.supabase.from("schedule_entries").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const rescheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      entryId: z.string().uuid(),
      newDate: z.string(),
      newShift: z.enum(SHIFTS),
      newStartTime: z.string(),
      newEndTime: z.string(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const { data: origin, error: e1 } = await context.supabase
      .from("schedule_entries").select("*").eq("id", data.entryId).single();
    if (e1) throw e1;
    const o: any = origin;
    const { data: ins, error: e2 } = await context.supabase.from("schedule_entries").insert({
      term_id: o.term_id, subject_id: o.subject_id, class_code: o.class_code, subdivision: o.subdivision,
      date: data.newDate, shift: data.newShift, start_time: data.newStartTime, end_time: data.newEndTime,
      kind: o.kind, is_abex: o.is_abex, notes: o.notes,
      rescheduled_from_entry_id: o.id, created_by: context.userId,
    }).select("id").single();
    if (e2) throw e2;
    await context.supabase.from("schedule_entries")
      .update({ rescheduled_to_date: data.newDate }).eq("id", o.id);
    return { newId: (ins as any).id };
  });

export const bulkCreateScheduleEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      class_code: z.enum(ATM_CLASSES),
      subject_id: z.string().uuid().nullish(),
      subdivision: z.string().default("A"),
      shift: z.enum(SHIFTS),
      start_time: z.string(),
      end_time: z.string(),
      kind: z.enum(KINDS).default("class"),
      is_abex: z.boolean().default(false),
      color: z.string().nullish(),
      dates: z.array(z.string()).min(1),
      term_id: z.string().uuid().nullish(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const rows = data.dates.map((d) => ({
      term_id: data.term_id ?? null,
      subject_id: data.subject_id ?? null,
      class_code: data.class_code,
      subdivision: data.subdivision || "A",
      date: d,
      shift: data.shift,
      start_time: data.start_time,
      end_time: data.end_time,
      kind: data.kind,
      is_abex: data.is_abex,
      color: data.color ?? null,
      created_by: context.userId,
    }));
    const { error } = await context.supabase.from("schedule_entries").insert(rows);
    if (error) throw error;
    return { count: rows.length };
  });

export const checkScheduleConflicts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      class_code: z.enum(ATM_CLASSES),
      date: z.string(),
      shift: z.enum(SHIFTS),
      excludeId: z.string().uuid().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("schedule_entries")
      .select("id, subdivision, start_time, end_time, kind, subject:subjects(name)")
      .eq("class_code", data.class_code)
      .eq("date", data.date)
      .eq("shift", data.shift);
    if (data.excludeId) q = q.neq("id", data.excludeId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const copyScheduleWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      class_code: z.enum(ATM_CLASSES),
      fromMonday: z.string(),
      toMonday: z.string(),
      overwrite: z.boolean().default(false),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const from = new Date(data.fromMonday + "T00:00:00");
    const fromEnd = new Date(from); fromEnd.setDate(fromEnd.getDate() + 6);
    const to = new Date(data.toMonday + "T00:00:00");
    const toEnd = new Date(to); toEnd.setDate(toEnd.getDate() + 6);
    const dayOffset = Math.round((to.getTime() - from.getTime()) / 86400000);

    const { data: src, error: e1 } = await context.supabase
      .from("schedule_entries")
      .select("*")
      .eq("class_code", data.class_code)
      .gte("date", data.fromMonday)
      .lte("date", fromEnd.toISOString().slice(0, 10));
    if (e1) throw e1;

    if (data.overwrite) {
      await context.supabase.from("schedule_entries")
        .delete()
        .eq("class_code", data.class_code)
        .gte("date", data.toMonday)
        .lte("date", toEnd.toISOString().slice(0, 10));
    }

    const rows = (src ?? []).map((o: any) => {
      const d = new Date(o.date + "T00:00:00"); d.setDate(d.getDate() + dayOffset);
      return {
        term_id: o.term_id, subject_id: o.subject_id, class_code: o.class_code,
        subdivision: o.subdivision, date: d.toISOString().slice(0, 10),
        shift: o.shift, start_time: o.start_time, end_time: o.end_time,
        kind: o.kind, is_abex: o.is_abex, notes: o.notes,
        created_by: context.userId,
      };
    });
    if (rows.length === 0) return { count: 0 };
    const { error: e2 } = await context.supabase.from("schedule_entries").insert(rows);
    if (e2) throw e2;
    return { count: rows.length };
  });

/* ---------- HOLIDAYS ---------- */

export const listHolidays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("holidays").select("*").order("date");
    if (error) throw error;
    return data ?? [];
  });

export const upsertHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      date: z.string(),
      label: z.string().min(1),
      term_id: z.string().uuid().nullish(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const payload: any = { date: data.date, label: data.label, term_id: data.term_id ?? null };
    if (data.id) {
      const { error } = await context.supabase.from("holidays").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("holidays").insert(payload).select("id").single();
    if (error) throw error;
    return { id: (ins as any).id };
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCoord(context.supabase, context.userId);
    const { error } = await context.supabase.from("holidays").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
