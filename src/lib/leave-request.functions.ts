import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendLeaveRequestEmail } from "@/lib/gmail.server";

// Ligante cria pedido de desistência. Envia e-mail ao presidente.
export const createLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
    reason: z.string().max(1000).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Garante que é ligante atual
    const { data: mem } = await (supabaseAdmin as any).from("league_memberships")
      .select("role").eq("league_id", data.league_id).eq("user_id", userId).maybeSingle();
    if (!mem || !["ligante", "diretor"].includes((mem as any).role)) {
      throw new Error("Você não é membro desta liga");
    }

    // Verifica pedido pendente existente
    const { data: existing } = await (supabaseAdmin as any).from("league_leave_requests")
      .select("id").eq("league_id", data.league_id).eq("user_id", userId).eq("status", "pending").maybeSingle();
    if (existing) throw new Error("Você já tem um pedido pendente");

    const { data: req, error } = await (supabaseAdmin as any).from("league_leave_requests")
      .insert({ league_id: data.league_id, user_id: userId, reason: data.reason ?? null, status: "pending" })
      .select("*").single();
    if (error) throw new Error(error.message);

    // Envia e-mail ao presidente
    try {
      const [{ data: league }, { data: profile }] = await Promise.all([
        (supabaseAdmin as any).from("leagues").select("id, name, slug, theme_color, president_id, president2_id").eq("id", data.league_id).maybeSingle(),
        (supabaseAdmin as any).from("profiles").select("full_name, username, email, cpf, registration_number").eq("id", userId).maybeSingle(),
      ]);
      if (league && (league as any).president_id) {
        const { data: presProfile } = await (supabaseAdmin as any)
          .from("profiles").select("email").eq("id", (league as any).president_id).maybeSingle();
        if ((presProfile as any)?.email) {
          await sendLeaveRequestEmail({
            to: (presProfile as any).email,
            leagueName: (league as any).name,
            leagueSlug: (league as any).slug,
            brandColor: (league as any).theme_color,
            ligante: {
              fullName: (profile as any)?.full_name || (profile as any)?.username || "Ligante",
              cpf: (profile as any)?.cpf,
              registration: (profile as any)?.registration_number,
              email: (profile as any)?.email,
            },
            reason: data.reason,
          });
        }
      }
    } catch (e) {
      console.error("Falha ao enviar e-mail de desistência", e);
    }

    return { ok: true, id: (req as any).id };
  });

// Presidente aprova/rejeita
export const processLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    request_id: z.string().uuid(),
    action: z.enum(["approve", "reject"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: req } = await (supabaseAdmin as any).from("league_leave_requests")
      .select("*, leagues:league_id(president_id, president2_id)").eq("id", data.request_id).maybeSingle();
    if (!req) throw new Error("Pedido não encontrado");
    if ((req as any).leagues?.president_id !== userId && (req as any).leagues?.president2_id !== userId) {
      const { data: isAdmin } = await (supabaseAdmin as any).rpc("is_admin_master", { _user_id: userId });
      if (!isAdmin) throw new Error("Não autorizado");
    }

    const status = data.action === "approve" ? "approved" : "rejected";
    if (data.action === "approve") {
      // remove membership
      await (supabaseAdmin as any).from("league_memberships")
        .delete().eq("league_id", (req as any).league_id).eq("user_id", (req as any).user_id);
    }

    const { error } = await (supabaseAdmin as any).from("league_leave_requests")
      .update({ status, processed_at: new Date().toISOString() }).eq("id", data.request_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyPendingLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: req } = await (supabaseAdmin as any).from("league_leave_requests")
      .select("*").eq("league_id", data.league_id).eq("user_id", context.userId)
      .eq("status", "pending").maybeSingle();
    return { request: req };
  });

// Lista pedidos de desistência da liga (para o presidente).
export const listLeagueLeaveRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: league } = await (supabaseAdmin as any)
      .from("leagues").select("president_id, president2_id").eq("id", data.league_id).maybeSingle();
    const { data: isAdmin } = await (supabaseAdmin as any).rpc("is_admin_master", { _user_id: userId });
    if ((league as any)?.president_id !== userId && (league as any)?.president2_id !== userId && !isAdmin) throw new Error("Não autorizado");

    const { data: rows } = await (supabaseAdmin as any).from("league_leave_requests")
      .select("*").eq("league_id", data.league_id).eq("status", "pending")
      .order("created_at", { ascending: false });
    const ids = (rows ?? []).map((r: any) => r.user_id);
    let profiles: any[] = [];
    if (ids.length > 0) {
      const { data: ps } = await (supabaseAdmin as any).from("profiles")
        .select("id, full_name, username, email, cpf, registration_number").in("id", ids);
      profiles = ps ?? [];
    }
    const enriched = (rows ?? []).map((r: any) => ({ ...r, profile: profiles.find((p) => p.id === r.user_id) ?? null }));
    return { requests: enriched };
  });
