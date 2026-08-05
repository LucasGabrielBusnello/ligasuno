import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function isLeagueManager(userId: string, leagueId: string) {
  const { data: lg } = await supabaseAdmin
    .from("leagues").select("president_id, president2_id").eq("id", leagueId).maybeSingle();
  if (lg && ((lg as any).president_id === userId || (lg as any).president2_id === userId)) return true;
  const { data: m } = await supabaseAdmin
    .from("league_memberships").select("role")
    .eq("league_id", leagueId).eq("user_id", userId).eq("role", "diretor").maybeSingle();
  if (m) return true;
  const { data: r } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();
  return !!r;
}

async function assertEventOwner(event_id: string, userId: string) {
  const { data: ev } = await supabaseAdmin
    .from("league_events").select("id, league_id, checkin_count").eq("id", event_id).maybeSingle();
  if (!ev) throw new Error("Evento não encontrado");
  if (!(await isLeagueManager(userId, (ev as any).league_id))) throw new Error("Sem permissão");
  return ev as any;
}

async function assertMinicourseOwner(mc_id: string, userId: string) {
  const { data: mc } = await supabaseAdmin
    .from("league_minicourses").select("id, event_id").eq("id", mc_id).maybeSingle();
  if (!mc) throw new Error("Minicurso não encontrado");
  const { data: ev } = await supabaseAdmin
    .from("league_events").select("league_id").eq("id", (mc as any).event_id).maybeSingle();
  if (!ev || !(await isLeagueManager(userId, (ev as any).league_id))) throw new Error("Sem permissão");
  return mc as any;
}


// ---- EVENT ----
export const listEventCheckinRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ev = await assertEventOwner(data.event_id, context.userId);
    const { data: regs } = await supabaseAdmin
      .from("event_registrations").select("id,user_id,full_name,cpf,checkin_code,status,category,paid_price")
      .eq("event_id", data.event_id).eq("status", "paid").order("full_name");
    const list = regs ?? [];
    const uids = Array.from(new Set(list.map((r: any) => r.user_id)));
    let pmap: Record<string, any> = {};
    if (uids.length > 0) {
      const { data: p } = await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", uids);
      (p ?? []).forEach((x: any) => { pmap[x.id] = x; });
    }
    const { data: chks } = await supabaseAdmin
      .from("event_checkins").select("registration_id,checkin_index,checked_in_at,method")
      .eq("event_id", data.event_id);
    const cmap: Record<string, Record<number, any>> = {};
    (chks ?? []).forEach((c: any) => {
      cmap[c.registration_id] ||= {}; cmap[c.registration_id][c.checkin_index] = c;
    });
    return {
      checkin_count: Number(ev.checkin_count) || 1,
      members: list.map((r: any) => ({
        ...r,
        email: pmap[r.user_id]?.email ?? null,
        checkins: cmap[r.id] ?? {},
      })),
    };
  });

export const toggleEventCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    event_id: z.string().uuid(), registration_id: z.string().uuid(),
    checkin_index: z.number().int().min(1), present: z.boolean(),
    method: z.enum(["manual", "qr"]).default("manual"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertEventOwner(data.event_id, context.userId);
    if (data.present) {
      const { error } = await supabaseAdmin.from("event_checkins").upsert({
        registration_id: data.registration_id, event_id: data.event_id,
        checkin_index: data.checkin_index, method: data.method, by_user_id: context.userId,
        checked_in_at: new Date().toISOString(),
      }, { onConflict: "registration_id,checkin_index" } as any);
      if (error) throw new Error(error.message);
    } else {
      await supabaseAdmin.from("event_checkins").delete()
        .eq("registration_id", data.registration_id).eq("checkin_index", data.checkin_index);
    }
    return { ok: true };
  });

export const scanEventCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    event_id: z.string().uuid(), checkin_index: z.number().int().min(1), code: z.string().min(1),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertEventOwner(data.event_id, context.userId);
    const code = data.code.trim().replace(/\D/g, "").padStart(6, "0").slice(-6);
    const { data: reg } = await supabaseAdmin.from("event_registrations")
      .select("id,full_name,status").eq("event_id", data.event_id).eq("checkin_code", code).maybeSingle();
    if (!reg) return { ok: false, error: "Código não encontrado" };
    if ((reg as any).status !== "paid") return { ok: false, error: "Inscrição não está paga" };
    const { data: existing } = await supabaseAdmin.from("event_checkins")
      .select("id").eq("registration_id", (reg as any).id).eq("checkin_index", data.checkin_index).maybeSingle();
    if (existing) return { ok: true, duplicate: true, name: (reg as any).full_name };
    const { error } = await supabaseAdmin.from("event_checkins").insert({
      registration_id: (reg as any).id, event_id: data.event_id,
      checkin_index: data.checkin_index, method: "qr", by_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, name: (reg as any).full_name };
  });

// ---- MINICURSO ----
export const listMinicourseCheckinRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ minicourse_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertMinicourseOwner(data.minicourse_id, context.userId);
    const { data: regs } = await supabaseAdmin
      .from("minicourse_registrations").select("id,user_id,full_name,cpf,checkin_code,status")
      .eq("minicourse_id", data.minicourse_id).eq("status", "paid");
    const list = regs ?? [];
    const uids = Array.from(new Set(list.map((r: any) => r.user_id)));
    let pmap: Record<string, any> = {};
    if (uids.length > 0) {
      const { data: p } = await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", uids);
      (p ?? []).forEach((x: any) => { pmap[x.id] = x; });
    }
    const { data: chks } = await supabaseAdmin
      .from("minicourse_checkins").select("registration_id,checked_in_at,method")
      .eq("minicourse_id", data.minicourse_id);
    const cset = new Set((chks ?? []).map((c: any) => c.registration_id));
    return {
      members: list.map((r: any) => ({
        ...r, email: pmap[r.user_id]?.email ?? null, present: cset.has(r.id),
      })),
    };
  });

export const toggleMinicourseCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    minicourse_id: z.string().uuid(), registration_id: z.string().uuid(), present: z.boolean(),
    method: z.enum(["manual", "qr"]).default("manual"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertMinicourseOwner(data.minicourse_id, context.userId);
    if (data.present) {
      const { error } = await supabaseAdmin.from("minicourse_checkins").upsert({
        registration_id: data.registration_id, minicourse_id: data.minicourse_id,
        method: data.method, by_user_id: context.userId, checked_in_at: new Date().toISOString(),
      }, { onConflict: "registration_id" } as any);
      if (error) throw new Error(error.message);
    } else {
      await supabaseAdmin.from("minicourse_checkins").delete().eq("registration_id", data.registration_id);
    }
    return { ok: true };
  });

export const scanMinicourseCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    minicourse_id: z.string().uuid(), code: z.string().min(1),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertMinicourseOwner(data.minicourse_id, context.userId);
    const code = data.code.trim().replace(/\D/g, "").padStart(6, "0").slice(-6);
    const { data: reg } = await supabaseAdmin.from("minicourse_registrations")
      .select("id,full_name,status").eq("minicourse_id", data.minicourse_id).eq("checkin_code", code).maybeSingle();
    if (!reg) return { ok: false, error: "Código não encontrado" };
    if ((reg as any).status !== "paid") return { ok: false, error: "Inscrição não está paga" };
    const { data: existing } = await supabaseAdmin.from("minicourse_checkins")
      .select("id").eq("registration_id", (reg as any).id).maybeSingle();
    if (existing) return { ok: true, duplicate: true, name: (reg as any).full_name };
    const { error } = await supabaseAdmin.from("minicourse_checkins").insert({
      registration_id: (reg as any).id, minicourse_id: data.minicourse_id,
      method: "qr", by_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, name: (reg as any).full_name };
  });
