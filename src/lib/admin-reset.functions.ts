import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  league_ids: z.array(z.string().uuid()).min(1),
  scopes: z.object({
    presidents: z.boolean().default(false),
    memberships: z.boolean().default(false),
    selection: z.boolean().default(false),
    event_regs: z.boolean().default(false),
    minicourse_regs: z.boolean().default(false),
    schedule: z.boolean().default(false),
    news: z.boolean().default(false),
  }),
});

export const resetLeagueData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roles } = await (supabaseAdmin as any).from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r:any) => r.role === "admin_master");
    if (!isAdmin) throw new Error("Apenas admin master pode executar reset");

    const ids = data.league_ids;
    const s = data.scopes;

    if (s.selection) {
      await (supabaseAdmin as any).from("league_selection_ranking_history").delete().in("league_id", ids);
      await (supabaseAdmin as any).from("league_selection_registrations").delete().in("league_id", ids);
      await (supabaseAdmin as any).from("league_selection_quotas").delete().in("league_id", ids);
      await (supabaseAdmin as any).from("leagues").update({
        selection_open: false, selection_total_seats: 0,
        selection_deadline: null, selection_exam_date: null, selection_exam_time: null, selection_exam_description: null,
      }).in("id", ids);
    }
    if (s.event_regs) {
      // Get event ids first
      const { data: evs } = await (supabaseAdmin as any).from("league_events").select("id").in("league_id", ids);
      const evIds = (evs ?? []).map((e:any) => e.id);
      if (evIds.length) {
        await (supabaseAdmin as any).from("event_registrations").delete().in("event_id", evIds);
      }
    }
    if (s.minicourse_regs) {
      const { data: evs } = await (supabaseAdmin as any).from("league_events").select("id").in("league_id", ids);
      const evIds = (evs ?? []).map((e:any) => e.id);
      if (evIds.length) {
        const { data: mcs } = await (supabaseAdmin as any).from("league_minicourses").select("id").in("event_id", evIds);
        const mcIds = (mcs ?? []).map((m:any) => m.id);
        if (mcIds.length) await (supabaseAdmin as any).from("minicourse_registrations").delete().in("minicourse_id", mcIds);
      }
    }
    if (s.memberships) {
      // Remove all except president keepership (handled separately)
      await (supabaseAdmin as any).from("league_memberships").delete().in("league_id", ids).neq("role", "presidente");
    }
    if (s.presidents) {
      // Remove presidents from leagues AND remove their presidente membership
      await (supabaseAdmin as any).from("league_memberships").delete().in("league_id", ids).eq("role", "presidente");
      await (supabaseAdmin as any).from("leagues").update({ president_id: null }).in("id", ids);
    }
    if (s.schedule) {
      await (supabaseAdmin as any).from("league_schedule_items").delete().in("league_id", ids);
      await (supabaseAdmin as any).from("league_attendance").delete().in("league_id", ids);
    }
    if (s.news) {
      await (supabaseAdmin as any).from("league_news").delete().in("league_id", ids);
    }

    return { ok: true };
  });
