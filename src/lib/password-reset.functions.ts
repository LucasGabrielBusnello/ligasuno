import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendGmail } from "@/lib/gmail.server";
import { hashResetCode, resetCodeEmailHtml } from "@/lib/password-reset.server";

export const requestPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: z.string().email().max(255) }).parse(i))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    const { data: prof, error: profileError } = await (supabaseAdmin as any)
      .from("profiles").select("id, email, full_name, username").ilike("email", email).maybeSingle();
    if (profileError) {
      console.error("password reset profile lookup failed", profileError);
      throw new Error("Não foi possível enviar o código agora. Tente novamente.");
    }

    // Resposta sempre neutra (não revela se o e-mail existe)
    if (!prof?.id) return { ok: true };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await (supabaseAdmin as any).from("password_reset_codes").insert({
      email,
      code_hash: hashResetCode(email, code),
      expires_at: expires,
    });
    if (insertError) {
      console.error("password reset code insert failed", insertError);
      throw new Error("Não foi possível gerar o código agora. Tente novamente.");
    }

    try {
      const delivery = await sendGmail({
        to: email,
        subject: "Seu código de redefinição de senha — MEDUNO",
        html: resetCodeEmailHtml(code, prof.full_name || prof.username || null),
      });
      console.info("password reset email accepted", { messageId: delivery.id });
    } catch (e) {
      console.error("reset code email failed", e);
      throw new Error("Não foi possível enviar o e-mail. Tente novamente em instantes.");
    }
    return { ok: true };
  });

export const confirmPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    email: z.string().email().max(255),
    code: z.string().trim().regex(/^\d{6}$/, "Código inválido"),
    password: z.string().min(6).max(72),
  }).parse(i))
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
