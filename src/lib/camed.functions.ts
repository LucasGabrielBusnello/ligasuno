import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const msgSchema = z.object({ message: z.string().trim().min(1).max(5000) });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildAnonymousEmailHtml(message: string) {
  const safe = escapeHtml(message).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%);border-radius:24px 24px 0 0;padding:36px 32px;color:#ecfdf5;">
      <div style="display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 14px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;">Mensagem Anônima</div>
      <h1 style="margin:18px 0 8px;font-size:28px;font-weight:900;letter-spacing:-0.02em;">LIGASUNO • CAMED</h1>
      <p style="margin:0;color:rgba(236,253,245,.85);font-size:15px;line-height:1.55;">
        Uma nova mensagem anônima foi enviada pelo formulário <strong>Fale Conosco</strong> do site.
        O remetente original <strong>não foi identificado</strong> e nenhum dado pessoal é compartilhado.
      </p>
    </div>
    <div style="background:#ffffff;border:1px solid #d1fae5;border-top:none;border-radius:0 0 24px 24px;padding:28px 32px;">
      <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#047857;font-weight:800;margin-bottom:10px;">Conteúdo da mensagem</div>
      <blockquote style="margin:0;padding:20px 22px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:12px;color:#064e3b;font-size:16px;line-height:1.65;font-style:italic;">“${safe}”</blockquote>
      <div style="margin-top:24px;padding-top:20px;border-top:1px dashed #a7f3d0;font-size:12px;color:#6b7280;line-height:1.6;">
        Esta mensagem foi enviada automaticamente em nome do site <strong style="color:#047857;">LIGASUNO</strong>.
        Para denúncias, sugestões e reclamações da comunidade de medicina da Unochapecó.<br/>
        Recebida em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
      </div>
    </div>
  </div></body></html>`;
}

export const sendAnonymousMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => msgSchema.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Save message
    await supabase.from("camed_messages").insert({ message: data.message });

    // Read CAMED email
    const { data: info } = await supabase.from("camed_info").select("email").eq("id", 1).maybeSingle();
    const to = (info as any)?.email as string | undefined;
    if (!to) return { ok: true, emailed: false, reason: "Sem e-mail do CAMED configurado." };

    const { sendGmail } = await import("./gmail.server");
    try {
      await sendGmail({
        to,
        subject: "📩 Nova mensagem anônima — LIGASUNO",
        html: buildAnonymousEmailHtml(data.message),
      });
      return { ok: true, emailed: true };
    } catch (e: any) {
      return { ok: true, emailed: false, reason: e?.message ?? "Falha no envio" };
    }
  });

const bookSchema = z.object({
  slot_id: z.string().uuid(),
  modality: z.enum(["online", "presencial"]),
  reason: z.string().trim().min(1).max(1000),
  extra_participants: z.string().trim().max(1000).optional(),
  phone: z.string().trim().min(8).max(40),
});

function buildBookingEmailHtml(args: { slotAt: string; modality: string; reason: string; extras?: string; phone: string; userName: string; userEmail: string }) {
  const safe = (s: string) => escapeHtml(s).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%);border-radius:24px 24px 0 0;padding:36px 32px;color:#ecfdf5;">
      <div style="display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 14px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;">📅 Horário Agendado</div>
      <h1 style="margin:18px 0 8px;font-size:26px;font-weight:900;letter-spacing:-0.02em;">Nova marcação no CAMED</h1>
      <p style="margin:0;color:rgba(236,253,245,.85);font-size:15px;">${safe(args.slotAt)} • ${safe(args.modality)}</p>
    </div>
    <div style="background:#fff;border:1px solid #d1fae5;border-top:none;border-radius:0 0 24px 24px;padding:28px 32px;color:#064e3b;font-size:14px;line-height:1.7;">
      <p style="margin:0 0 8px;"><strong>Quem marcou:</strong> ${safe(args.userName)} (${safe(args.userEmail)})</p>
      <p style="margin:0 0 8px;"><strong>Telefone:</strong> ${safe(args.phone)}</p>
      <p style="margin:0 0 8px;"><strong>Motivo:</strong> ${safe(args.reason)}</p>
      ${args.extras ? `<p style="margin:0 0 8px;"><strong>Outros participantes:</strong> ${safe(args.extras)}</p>` : ""}
      <div style="margin-top:18px;padding-top:14px;border-top:1px dashed #a7f3d0;font-size:12px;color:#6b7280;">Enviado por LIGASUNO • ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
    </div>
  </div></body></html>`;
}

export const bookCamedSlot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bookSchema.parse(d))
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Não autenticado");
    const token = auth.slice(7);
    const { createClient } = await import("@supabase/supabase-js");
    const userClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) throw new Error("Não autenticado");

    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // load slot
    const { data: slot } = await admin.from("camed_slots").select("*").eq("id", data.slot_id).maybeSingle();
    if (!slot) throw new Error("Horário inexistente");
    if (data.modality === "online" && !(slot as any).allow_online) throw new Error("Online não disponível para este horário");
    if (data.modality === "presencial" && !(slot as any).allow_in_person) throw new Error("Presencial não disponível para este horário");

    // ensure not already booked
    const { data: existing } = await admin.from("camed_bookings").select("id").eq("slot_id", data.slot_id).maybeSingle();
    if (existing) throw new Error("Horário já agendado");

    const { error } = await admin.from("camed_bookings").insert({
      slot_id: data.slot_id,
      user_id: u.user.id,
      modality: data.modality,
      reason: data.reason,
      extra_participants: data.extra_participants ?? null,
      phone: data.phone,
    });
    if (error) throw new Error(error.message);

    // Notify CAMED email
    const { data: info } = await admin.from("camed_info").select("email").eq("id", 1).maybeSingle();
    const to = (info as any)?.email as string | undefined;
    if (to) {
      const { data: prof } = await admin.from("profiles").select("full_name,username,email").eq("id", u.user.id).maybeSingle();
      const userName = (prof as any)?.full_name || (prof as any)?.username || "Usuário";
      const userEmail = (prof as any)?.email || u.user.email || "";
      const slotAt = new Date((slot as any).slot_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" });
      try {
        const { sendGmail } = await import("./gmail.server");
        await sendGmail({
          to,
          subject: `📅 Novo horário marcado — ${slotAt}`,
          html: buildBookingEmailHtml({ slotAt, modality: data.modality, reason: data.reason, extras: data.extra_participants, phone: data.phone, userName, userEmail }),
        });
      } catch (e) { console.error(e); }
    }
    return { ok: true };
  });
