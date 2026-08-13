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
