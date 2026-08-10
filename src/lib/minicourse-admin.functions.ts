import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCanManage(supabase: any, userId: string, minicourseId: string) {
  const { data: mc } = await supabase
    .from("league_minicourses")
    .select("id, event_id, league_events!inner(id, league_id)")
    .eq("id", minicourseId)
    .maybeSingle();
  if (!mc) throw new Error("Minicurso não encontrado");
  const leagueId = (mc as any).league_events.league_id;

  const { data: isAdmin } = await supabase.rpc("is_admin_master", { _user_id: userId });
  if (isAdmin) return { minicourse: mc, leagueId };

  const { data: lg } = await supabase
    .from("leagues").select("id,president_id,president2_id").eq("id", leagueId).maybeSingle();
  if (lg && ((lg as any).president_id === userId || (lg as any).president2_id === userId)) return { minicourse: mc, leagueId };

  const { data: mem } = await supabase
    .from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", userId).maybeSingle();
  if (mem && ["diretor", "presidente"].includes((mem as any).role)) return { minicourse: mc, leagueId };

  throw new Error("Sem permissão para gerenciar este minicurso");
}

export const searchEventParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ minicourse_id: z.string().uuid(), query: z.string().default("") }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { minicourse } = await assertCanManage(supabase, userId, data.minicourse_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: regs } = await supabaseAdmin
      .from("event_registrations")
      .select("id,user_id,full_name,social_name,status,cpf")
      .eq("event_id", (minicourse as any).event_id)
      .limit(500);

    const uids = Array.from(new Set((regs ?? []).map((r: any) => r.user_id)));
    let profMap: Record<string, any> = {};
    if (uids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,email,username,full_name").in("id", uids);
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
    }

    const { data: already } = await supabaseAdmin
      .from("minicourse_registrations").select("user_id").eq("minicourse_id", data.minicourse_id);
    const taken = new Set((already ?? []).map((r: any) => r.user_id));

    const q = data.query.trim().toLowerCase();
    const rows = (regs ?? [])
      .map((r: any) => ({
        event_registration_id: r.id,
        user_id: r.user_id,
        status: r.status,
        full_name: r.full_name ?? profMap[r.user_id]?.full_name ?? profMap[r.user_id]?.username ?? "—",
        email: profMap[r.user_id]?.email ?? null,
        already: taken.has(r.user_id),
      }))
      .filter((r) => !r.already)
      .filter((r) => !q || r.full_name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q))
      .slice(0, 30);

    return rows;
  });

export const adminAddMinicourseRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    minicourse_id: z.string().uuid(),
    user_id: z.string().uuid(),
    paid_price: z.number().min(0).default(0),
    status: z.enum(["paid", "pending"]).default("paid"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { minicourse } = await assertCanManage(supabase, userId, data.minicourse_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: evReg } = await supabaseAdmin
      .from("event_registrations").select("id")
      .eq("event_id", (minicourse as any).event_id).eq("user_id", data.user_id).maybeSingle();
    if (!evReg) throw new Error("Pessoa não está inscrita no evento");

    const { error } = await supabaseAdmin.from("minicourse_registrations").upsert({
      minicourse_id: data.minicourse_id,
      user_id: data.user_id,
      event_registration_id: (evReg as any).id,
      paid_price: data.paid_price,
      status: data.status,
    } as any, { onConflict: "minicourse_id,user_id" } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateMinicourseRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    registration_id: z.string().uuid(),
    paid_price: z.number().min(0).optional(),
    status: z.enum(["paid", "pending"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg } = await supabaseAdmin
      .from("minicourse_registrations").select("id,minicourse_id").eq("id", data.registration_id).maybeSingle();
    if (!reg) throw new Error("Inscrição não encontrada");
    await assertCanManage(supabase, userId, (reg as any).minicourse_id);

    const patch: any = {};
    if (data.paid_price !== undefined) patch.paid_price = data.paid_price;
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("minicourse_registrations").update(patch).eq("id", data.registration_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteMinicourseRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ registration_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg } = await supabaseAdmin
      .from("minicourse_registrations").select("id,minicourse_id").eq("id", data.registration_id).maybeSingle();
    if (!reg) throw new Error("Inscrição não encontrada");
    await assertCanManage(supabase, userId, (reg as any).minicourse_id);

    const { error } = await supabaseAdmin.from("minicourse_registrations").delete().eq("id", data.registration_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
