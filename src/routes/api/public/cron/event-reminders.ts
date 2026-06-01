import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEventReminderEmail, sendMinicourseDayEmail } from "@/lib/gmail.server";

// Cron diário 08:00. Envia lembretes de eventos D-7, D-1, D-0 e minicursos D-0.
// Idempotência via event_email_log (event_id + kind + recipient).
export const Route = createFileRoute("/api/public/cron/event-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const apikey = request.headers.get("apikey") ?? new URL(request.url).searchParams.get("apikey");
  const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!apikey || apikey !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const targets: Array<{ date: string; kind: "7d" | "1d" | "0d" }> = [];
  for (const [offset, kind] of [[7, "7d"], [1, "1d"], [0, "0d"]] as const) {
    const d = new Date(today); d.setDate(d.getDate() + offset);
    targets.push({ date: d.toISOString().slice(0, 10), kind });
  }

  let sent = 0;
  for (const t of targets) {
    const { data: events } = await supabaseAdmin
      .from("league_events")
      .select("id, title, event_date, schedule, league_id, leagues:league_id(name, slug, theme_color)")
      .eq("event_date", t.date);
    for (const ev of (events ?? []) as any[]) {
      const { data: regs } = await supabaseAdmin
        .from("event_registrations")
        .select("id, full_name, user_id, profiles!event_registrations_user_id_fkey(email)")
        .eq("event_id", ev.id).eq("status", "paid");
      for (const r of (regs ?? []) as any[]) {
        const email = r.profiles?.email;
        if (!email) continue;
        // dedupe
        const { data: log } = await supabaseAdmin.from("event_email_log")
          .select("id").eq("event_id", ev.id).eq("kind", t.kind).eq("recipient", email).maybeSingle();
        if (log) continue;
        try {
          await sendEventReminderEmail({
            to: email, fullName: r.full_name,
            leagueName: ev.leagues?.name ?? "", leagueSlug: ev.leagues?.slug ?? "",
            brandColor: ev.leagues?.theme_color,
            eventTitle: ev.title, eventDate: ev.event_date, eventTime: ev.schedule,
            kind: t.kind,
          });
          await supabaseAdmin.from("event_email_log").insert({
            event_id: ev.id, kind: t.kind, recipient: email, reference_id: r.id,
          } as any);
          sent++;
        } catch (e) { console.error("reminder send failed", e); }
      }

      // No dia, dispara também os minicursos
      if (t.kind === "0d") {
        const { data: mcs } = await supabaseAdmin
          .from("league_minicourses")
          .select("id, title, instructor, starts_at, location")
          .eq("event_id", ev.id);
        for (const mc of (mcs ?? []) as any[]) {
          const { data: mregs } = await supabaseAdmin
            .from("minicourse_registrations")
            .select("user_id, profiles!minicourse_registrations_user_id_fkey(email, full_name, username)")
            .eq("minicourse_id", mc.id).eq("status", "paid");
          for (const mr of (mregs ?? []) as any[]) {
            const email = mr.profiles?.email;
            if (!email) continue;
            const kind = `mc:${mc.id}`;
            const { data: log } = await supabaseAdmin.from("event_email_log")
              .select("id").eq("event_id", ev.id).eq("kind", kind).eq("recipient", email).maybeSingle();
            if (log) continue;
            try {
              await sendMinicourseDayEmail({
                to: email,
                fullName: mr.profiles?.full_name || mr.profiles?.username || "ligante",
                leagueName: ev.leagues?.name ?? "", leagueSlug: ev.leagues?.slug ?? "",
                brandColor: ev.leagues?.theme_color,
                minicourseTitle: mc.title, instructor: mc.instructor,
                startsAt: mc.starts_at, location: mc.location,
              });
              await supabaseAdmin.from("event_email_log").insert({
                event_id: ev.id, kind, recipient: email, reference_id: mc.id,
              } as any);
              sent++;
            } catch (e) { console.error("minicourse day mail failed", e); }
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
