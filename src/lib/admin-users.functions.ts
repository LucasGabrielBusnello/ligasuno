import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listSchema = z.object({ q: z.string().optional() });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().max(120).nullable().optional(),
  username: z.string().min(2).max(30),
  email: z.string().email(),
  phone: z.string().max(20).nullable().optional(),
  cpf: z.string().max(14).nullable().optional(),
  course: z.string().max(80).nullable().optional(),
  matricula: z.string().max(30).nullable().optional(),
  registration_number: z.string().max(30).nullable().optional(),
  current_semester: z.number().int().min(1).max(20).nullable().optional(),
  class_code: z.string().nullable().optional(),
  is_unochapeco_student: z.boolean().optional(),
});

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await (supabaseAdmin as any)
    .from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: any) => r.role === "admin_master")) {
    throw new Error("Apenas admin master pode gerenciar usuários");
  }
  return supabaseAdmin;
}

export const listUsersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    let query = (supabaseAdmin as any)
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    const q = (data.q ?? "").trim();
    if (q) {
      query = query.or(
        `username.ilike.%${q}%,email.ilike.%${q}%,full_name.ilike.%${q}%,cpf.ilike.%${q}%,matricula.ilike.%${q}%`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { user_id, email, ...rest } = data;

    const payload: any = {
      ...rest,
      email,
      full_name: rest.full_name || null,
      phone: rest.phone || null,
      cpf: rest.cpf || null,
      course: rest.course || null,
      matricula: rest.matricula || null,
      registration_number: rest.registration_number || null,
      class_code: rest.class_code || null,
      current_semester: rest.current_semester ?? null,
    };

    const { error } = await (supabaseAdmin as any).from("profiles").update(payload).eq("id", user_id);
    if (error) {
      if (error.code === "23505") throw new Error("Usuário, e-mail ou CPF já cadastrado em outra conta");
      throw new Error(error.message);
    }

    const { error: authErr } = await (supabaseAdmin as any).auth.admin.updateUserById(user_id, { email });
    if (authErr && !/same|already/i.test(authErr.message ?? "")) {
      throw new Error(`Perfil salvo, mas não foi possível alterar o e-mail de login: ${authErr.message}`);
    }

    return { ok: true };
  });

/* ============ EXCLUSÃO DE USUÁRIO ============ */
export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a sua própria conta");

    const { data: targetRoles } = await (supabaseAdmin as any)
      .from("user_roles").select("role").eq("user_id", data.user_id);
    if ((targetRoles ?? []).some((r: any) => r.role === "admin_master")) {
      throw new Error("Não é possível excluir outro admin master");
    }

    const { error: authErr } = await (supabaseAdmin as any).auth.admin.deleteUser(data.user_id);
    if (authErr && !/not found/i.test(authErr.message ?? "")) {
      if (/foreign key|violates/i.test(authErr.message ?? "")) {
        throw new Error("Este usuário possui registros vinculados (inscrições, pagamentos ou cargos) que impedem a exclusão. Remova esses vínculos antes.");
      }
      throw new Error(`Não foi possível excluir: ${authErr.message}`);
    }

    await (supabaseAdmin as any).from("profiles").delete().eq("id", data.user_id);
    return { ok: true };
  });

/* ============ TERMOS ============ */
export const listTermsAcceptancesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ q: z.string().optional(), version: z.string().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    let query = (supabaseAdmin as any)
      .from("terms_acceptances")
      .select("*")
      .order("accepted_at", { ascending: false })
      .limit(1000);
    if (data.version) query = query.eq("version", data.version);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let profiles: any[] = [];
    if (ids.length) {
      const { data: p } = await (supabaseAdmin as any)
        .from("profiles").select("id, full_name, username, email, cpf").in("id", ids);
      profiles = p ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const q = (data.q ?? "").trim().toLowerCase();
    const merged = (rows ?? []).map((r: any) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    return q
      ? merged.filter((r: any) => {
          const p = r.profile ?? {};
          return [p.full_name, p.username, p.email, p.cpf].some((v: any) =>
            (v ?? "").toLowerCase().includes(q),
          );
        })
      : merged;
  });

export const getTermsCoverageAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ current_version: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: acc } = await (supabaseAdmin as any)
      .from("terms_acceptances").select("user_id, version").limit(5000);
    const { data: profiles } = await (supabaseAdmin as any)
      .from("profiles").select("id, full_name, username, email").limit(5000);

    const byVersion: Record<string, number> = {};
    const acceptedCurrent = new Set<string>();
    for (const a of acc ?? []) {
      byVersion[a.version] = (byVersion[a.version] ?? 0) + 1;
      if (a.version === data.current_version) acceptedCurrent.add(a.user_id);
    }
    const pending = (profiles ?? []).filter((p: any) => !acceptedCurrent.has(p.id));
    return {
      total_users: (profiles ?? []).length,
      accepted_current: acceptedCurrent.size,
      pending_count: pending.length,
      by_version: byVersion,
      pending,
    };
  });

export const getUserTermsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("terms_acceptances")
      .select("*")
      .eq("user_id", data.user_id)
      .order("accepted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
