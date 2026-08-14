import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Traduz erros técnicos do banco em mensagens claras em português. */
function friendlyDbError(error: any, ctx: "inscrito" | "inscrição"): string {
  const msg = String(error?.message ?? "");
  const details = String(error?.details ?? "");
  const code = String(error?.code ?? "");

  if (code === "23505" || /duplicate key/i.test(msg)) {
    return "Esta pessoa já está inscrita neste evento.";
  }
  if (code === "23503" || /foreign key/i.test(msg)) {
    return "Não foi possível vincular: o usuário ou o evento não existe mais.";
  }
  if (code === "23502" || /null value in column/i.test(msg)) {
    const col = msg.match(/column "([^"]+)"/)?.[1];
    const map: Record<string, string> = {
      cpf: "CPF",
      course: "Curso",
      full_name: "Nome completo",
      user_id: "Usuário",
    };
    const label = col ? (map[col] ?? col) : "um campo obrigatório";
    return `Faltou preencher: ${label}. Preencha esse campo e tente novamente.`;
  }
  if (code === "22P02") {
    return "Algum valor foi preenchido em formato inválido (por exemplo, valor pago com letras).";
  }
  if (/permission denied|row-level security/i.test(msg)) {
    return "Você não tem permissão para alterar esta inscrição.";
  }
  return `Não foi possível salvar ${ctx === "inscrito" ? "o inscrito" : "a inscrição"}: ${msg || details || "erro desconhecido"}`;
}

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
    full_name: z.string().trim().min(2, "Informe o nome completo (mínimo 2 letras).").max(150),
    social_name: z.string().trim().max(150).optional().nullable(),
    cpf: z.string().trim().max(20).optional().nullable(),
    course: z.string().trim().max(120).optional().nullable(),
    category: z.enum(["ligante", "partner", "visitor"]).default("visitor"),
    paid_price: z.number().min(0).default(0),
    status: z.enum(["paid", "pending"]).default("paid"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageEvent(supabase, userId, data.event_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: exists } = await supabaseAdmin
      .from("event_registrations").select("id,full_name").eq("event_id", data.event_id).eq("user_id", data.user_id).maybeSingle();
    if (exists) {
      throw new Error(`Esta pessoa já está inscrita no evento (${(exists as any).full_name ?? "inscrição existente"}). Edite a inscrição existente em vez de criar outra.`);
    }

    const { error } = await supabaseAdmin.from("event_registrations").insert({
      event_id: data.event_id,
      user_id: data.user_id,
      full_name: data.full_name,
      social_name: data.social_name || null,
      // cpf e course são obrigatórios no banco: usamos string vazia quando não informados
      cpf: (data.cpf ?? "").trim(),
      course: (data.course ?? "").trim() || "Não informado",
      category: data.category,
      base_price: data.paid_price,
      paid_price: data.paid_price,
      status: data.status,
    } as any);
    if (error) throw new Error(friendlyDbError(error, "inscrito"));
    return { ok: true };
  });

export const adminUpdateEventRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    registration_id: z.string().uuid(),
    full_name: z.string().trim().min(2, "Informe o nome completo (mínimo 2 letras).").max(150).optional(),
    social_name: z.string().trim().max(150).optional().nullable(),
    cpf: z.string().trim().max(20).optional().nullable(),
    course: z.string().trim().max(120).optional().nullable(),
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
    if (data.social_name !== undefined) patch.social_name = data.social_name || null;
    if (data.cpf !== undefined) patch.cpf = (data.cpf ?? "").trim();
    if (data.course !== undefined) patch.course = (data.course ?? "").trim() || "Não informado";
    if (data.category !== undefined) patch.category = data.category;
    if (data.paid_price !== undefined) patch.paid_price = data.paid_price;
    if (data.status !== undefined) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("event_registrations").update(patch).eq("id", data.registration_id);
    if (error) throw new Error(friendlyDbError(error, "inscrição"));
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
    if (error) throw new Error(friendlyDbError(error, "inscrição"));
    return { ok: true };
  });

/** Lista inscritos + finanças do evento para presidentes, co-presidentes e diretores. */
export const adminListEventRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageEvent(supabase, userId, data.event_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rs } = await supabaseAdmin
      .from("event_registrations").select("*")
      .eq("event_id", data.event_id).order("created_at", { ascending: false });
    const list = rs ?? [];

    const uids = Array.from(new Set([
      ...list.map((r: any) => r.user_id),
      ...list.map((r: any) => r.referred_by).filter(Boolean),
    ])).filter(Boolean) as string[];
    const profMap: Record<string, any> = {};
    if (uids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id,username,email,phone,full_name").in("id", uids);
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
    }

    const regIds = list.map((r: any) => r.id);
    let txns: any[] = [];
    if (regIds.length > 0) {
      const { data: t } = await supabaseAdmin
        .from("payment_transactions").select("reference_id, gross_amount, fee_amount, raw")
        .eq("category", "event").eq("status", "approved").in("reference_id", regIds);
      txns = t ?? [];
    }

    const { data: mcs } = await supabaseAdmin
      .from("league_minicourses").select("id").eq("event_id", data.event_id);
    const mcIds = (mcs ?? []).map((m: any) => m.id);
    let mcRegs: any[] = [];
    let mcTxns: any[] = [];
    if (mcIds.length > 0) {
      const { data: mr } = await supabaseAdmin
        .from("minicourse_registrations").select("id,paid_price,status")
        .in("minicourse_id", mcIds).eq("status", "paid");
      mcRegs = mr ?? [];
      const paidIds = mcRegs.filter((r: any) => Number(r.paid_price) > 0).map((r: any) => r.id);
      if (paidIds.length > 0) {
        const { data: mt } = await supabaseAdmin
          .from("payment_transactions").select("reference_id, gross_amount, fee_amount, raw")
          .eq("category", "minicourse").eq("status", "approved").in("reference_id", paidIds);
        mcTxns = mt ?? [];
      }
    }

    return {
      registrations: list.map((r: any) => ({
        ...r,
        profiles: profMap[r.user_id] ?? null,
        referrer_name: r.referred_by
          ? (profMap[r.referred_by]?.full_name || profMap[r.referred_by]?.username || "Ligante")
          : null,
      })),
      transactions: txns,
      minicourse_registrations: mcRegs,
      minicourse_transactions: mcTxns,
    };
  });
