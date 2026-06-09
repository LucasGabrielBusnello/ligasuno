import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/event-snapshot")({
  server: {
    handlers: {
      POST: async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

        const now = new Date();
        const min = new Date(now); min.setDate(now.getDate() - 30);
        const max = new Date(now); max.setDate(now.getDate() + 7);

        const { data: events } = await admin.from("league_events")
          .select("id,title,league_id,event_date")
          .gte("event_date", min.toISOString().slice(0, 10))
          .lte("event_date", max.toISOString().slice(0, 10));

        const took: any[] = [];
        for (const ev of events ?? []) {
          try {
            const { data: regs } = await admin.from("event_registrations").select("*").eq("event_id", ev.id);
            const { data: chks } = await admin.from("event_checkins").select("*").eq("event_id", ev.id);
            const { data: mcs } = await admin.from("league_minicourses").select("id,title,total_hours").eq("event_id", ev.id);
            const mcIds = (mcs ?? []).map((m: any) => m.id);
            const { data: mcRegs } = mcIds.length
              ? await admin.from("minicourse_registrations").select("*").in("minicourse_id", mcIds)
              : { data: [] as any[] };
            const { data: mcChks } = mcIds.length
              ? await admin.from("minicourse_checkins").select("*").in("minicourse_id", mcIds)
              : { data: [] as any[] };

            await admin.from("event_snapshots").insert({
              event_id: ev.id,
              payload: {
                event: ev, registrations: regs, checkins: chks,
                minicourses: mcs, minicourse_registrations: mcRegs, minicourse_checkins: mcChks,
                taken_at: new Date().toISOString(),
              } as any,
            });
            took.push({ event_id: ev.id, regs: (regs ?? []).length });
          } catch (e: any) {
            took.push({ event_id: ev.id, error: e?.message ?? String(e) });
          }
        }

        return new Response(JSON.stringify({ ok: true, processed: took.length, details: took }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
