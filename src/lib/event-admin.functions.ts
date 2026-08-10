import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCanManageEvent(supabase: any, userId: string, eventId: string) {
  const { data: ev } = await supabase
    .from("league_events").select("id, league_id").eq("id", eventId).maybeSingle();
  if (!ev) throw new Error("Evento não encontrado");
  const leagueId = (ev as any).league_id;

  const { data: isAdmin } = await supabase.rpc("is_admin_master", { _user_id: userId });
  if (isAdmin) return ev;

  const { data: lg } = await supabase
    .from("leagues").select("id,president_id,president2_id").eq("id", leagueId).maybeSingle();
  if (lg && ((lg as any).president_id === userId || (lg as any).president2_id === userId)) return ev;

  const { data: mem } = await supabase
    .from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", userId).maybeSingle();
  if (mem && ["diretor", "presidente"].includes((mem as any).role)) return ev;

  throw new Error("Sem permissão para gerenciar este evento");
}

export const searchProfilesForEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ event_id: z.string().uuid(), query: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageEvent(supabase, userId, data.event_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const q = data.query.trim();
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,email,username,full_name,phone")
      .or(`email.ilike.%${q}%,username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(20);

    const ids = (profs ?? []).map((p: any) => p.id);
    let taken = new Set<string>();
    if (ids.length) {
      const { data: regs } = await supabaseAdmin
        .from("event_registrations").select("user_id").eq("event_id", data.event_id).in("user_id", ids);
      taken = new Set((regs ?? []).map((r: any) => r.user_id));
    }

    return (profs ?? []).map((p: any) => ({
      id: p.id, email: p.email, username: p.username, full_name: p.full_name,
      already: taken.has(p.id),
    }));
  });

export const adminAddEventRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    event_id: z.string().uuid(),
    user_id: z.string().uuid(),
    full_name: z.string().trim().min(2).max(150),
    category: z.enum(["ligante", "partner", "visitor"]).default("visitor"),
    paid_price: z.number().min(0).default(0),
    status: z.enum(["paid", "pending"]).default("paid"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageEvent(supabase, userId, data.event_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: exists } = await supabaseAdmin
      .from("event_registrations").select("id").eq("event_id", data.event_id).eq("user_id", data.user_id).maybeSingle();
    if (exists) throw new Error("Esta pessoa já está inscrita no evento");

    const { error } = await supabaseAdmin.from("event_registrations").insert({
      event_id: data.event_id,
      user_id: data.user_id,
      full_name: data.full_name,
      category: data.category,
      paid_price: data.paid_price,
      status: data.status,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateEventRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    registration_id: z.string().uuid(),
    full_name: z.string().trim().min(2).max(150).optional(),
    category: z.enum(["ligante", "partner", "visitor"]).optional(),
    paid_price: z.number().min(0).optional(),
    status: z.enum(["paid", "pending"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg } = await supabaseAdmin
      .from("event_registrations").select("id,event_id").eq("id", data.registration_id).maybeSingle();
    if (!reg) throw new Error("Inscrição não encontrada");
    await assertCanManageEvent(supabase, userId, (reg as any).event_id);

    const patch: any = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.category !== undefined) patch.category = data.category;
    if (data.paid_price !== undefined) patch.paid_price = data.paid_price;
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("event_registrations").update(patch).eq("id", data.registration_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteEventRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ registration_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg } = await supabaseAdmin
      .from("event_registrations").select("id,event_id,user_id").eq("id", data.registration_id).maybeSingle();
    if (!reg) throw new Error("Inscrição não encontrada");
    await assertCanManageEvent(supabase, userId, (reg as any).event_id);

    // remove também as inscrições em minicursos deste evento
    const { data: mcs } = await supabaseAdmin
      .from("league_minicourses").select("id").eq("event_id", (reg as any).event_id);
    const mcIds = (mcs ?? []).map((m: any) => m.id);
    if (mcIds.length) {
      await supabaseAdmin.from("minicourse_registrations")
        .delete().eq("user_id", (reg as any).user_id).in("minicourse_id", mcIds);
    }

    const { error } = await supabaseAdmin.from("event_registrations").delete().eq("id", data.registration_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
