import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendGmail } from "@/lib/gmail.server";
import { hashResetCode, resetCodeEmailHtml } from "@/lib/password-reset.server";

const emailSchema = z.object({ email: z.string().email().max(255) });

export const requestPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => emailSchema.parse(i))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    const { data: prof } = await (supabaseAdmin as any)
      .from("profiles").select("id, email, full_name, username").ilike("email", email).maybeSingle();

    // Resposta sempre neutra (não revela se o e-mail existe)
    if (!prof?.id) return { ok: true };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await (supabaseAdmin as any).from("password_reset_codes").insert({
      email,
      code_hash: hashResetCode(email, code),
      expires_at: expires,
    });

    try {
      await sendGmail({
        to: prof.email,
        subject: `🔑 Seu código de redefinição de senha — MEDUNO`,
        html: resetCodeEmailHtml(code, prof.full_name || prof.username || null),
      });
    } catch (e) {
      console.error("reset code email failed", e);
    }
    return { ok: true };
  });

const confirmSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().trim().regex(/^\d{6}$/, "Código inválido"),
  password: z.string().min(6).max(72),
});

export const confirmPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => confirmSchema.parse(i))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { data: rows } = await (supabaseAdmin as any)
      .from("password_reset_codes")
      .select("*")
      .ilike("email", email)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (rows ?? [])[0];
    if (!row) throw new Error("Código inválido ou expirado. Solicite um novo código.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Código expirado. Solicite um novo código.");
    if ((row.attempts ?? 0) >= 5) throw new Error("Muitas tentativas. Solicite um novo código.");

    if (row.code_hash !== hashResetCode(email, data.code)) {
      await (supabaseAdmin as any)
        .from("password_reset_codes").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
      throw new Error("Código incorreto.");
    }

    const { data: prof } = await (supabaseAdmin as any)
      .from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!prof?.id) throw new Error("Conta não encontrada.");

    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(prof.id, { password: data.password });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any)
      .from("password_reset_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    return { ok: true };
  });
