import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ event_id: z.string().uuid() });

/**
 * Lista os ligantes (membros da liga organizadora) que podem ser indicados
 * como "quem trouxe" o inscrito.
 */
export const listEventReferrers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("league_events")
      .select("league_id")
      .eq("id", data.event_id)
      .maybeSingle();
    if (!ev) return [] as Array<{ id: string; name: string }>;

    const { data: members } = await supabaseAdmin
      .from("league_memberships")
      .select("user_id, role")
      .eq("league_id", (ev as any).league_id)
      .in("role", ["ligante", "diretor", "presidente"]);

    const ids = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
    if (ids.length === 0) return [] as Array<{ id: string; name: string }>;

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", ids);

    return (profs ?? [])
      .map((p: any) => ({ id: p.id as string, name: (p.full_name || p.username || "Sem nome") as string }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  });
