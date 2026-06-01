import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWelcomeEmail } from "@/lib/gmail.server";

// Disparado pelo client logo após signup bem-sucedido. Idempotente: só envia uma vez por e-mail.
export const sendWelcomeEmailForUser = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: prof } = await (supabaseAdmin as any)
      .from("profiles").select("email, full_name, username").eq("id", data.user_id).maybeSingle();
    if (!prof?.email) return { skipped: true };
    try {
      await sendWelcomeEmail(prof.email, prof.full_name || prof.username);
      return { ok: true };
    } catch (e: any) {
      console.error("sendWelcomeEmailForUser failed", e);
      return { ok: false, error: e?.message };
    }
  });

// Verifica se um CPF já está cadastrado em algum lugar (profiles / inscrições).
export const checkCpfTaken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ cpf: z.string().min(11).max(20), ignore_user_id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data }) => {
    const cpf = data.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return { taken: false };

    const checks = await Promise.all([
      (supabaseAdmin as any).from("profiles").select("id").eq("cpf", cpf).maybeSingle(),
      (supabaseAdmin as any).from("league_selection_registrations").select("user_id").eq("cpf", cpf).limit(1),
      (supabaseAdmin as any).from("event_registrations").select("user_id").eq("cpf", cpf).limit(1),
    ]);
    const ignore = data.ignore_user_id;
    const fromProfile = checks[0].data && (!ignore || checks[0].data.id !== ignore);
    const fromSel = (checks[1].data ?? []).some((r: any) => !ignore || r.user_id !== ignore);
    const fromEv = (checks[2].data ?? []).some((r: any) => !ignore || r.user_id !== ignore);
    return { taken: !!(fromProfile || fromSel || fromEv) };
  });
