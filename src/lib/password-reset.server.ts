import { createHash } from "crypto";

export function hashResetCode(email: string, code: string) {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "meduno";
  return createHash("sha256").update(`${email.toLowerCase()}:${code}:${pepper}`).digest("hex");
}

export function resetCodeEmailHtml(code: string, name?: string | null) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%);border-radius:24px 24px 0 0;padding:34px 32px;color:#ecfdf5;">
      <div style="display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 14px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;">Redefinição de senha</div>
      <h1 style="margin:16px 0 6px;font-size:26px;font-weight:900;">MEDUNO</h1>
      <p style="margin:0;color:rgba(236,253,245,.85);font-size:15px;">${name ? `Olá, ${name}! ` : ""}Use o código abaixo para criar uma nova senha.</p>
    </div>
    <div style="background:#fff;border:1px solid #d1fae5;border-top:none;border-radius:0 0 24px 24px;padding:30px 32px;text-align:center;">
      <div style="font-size:40px;letter-spacing:.35em;font-weight:900;color:#047857;padding:18px 0;background:#ecfdf5;border-radius:16px;">${code}</div>
      <p style="margin:18px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
        O código expira em <strong>15 minutos</strong>. Se você não solicitou a redefinição, ignore este e-mail — sua senha continua a mesma.
      </p>
    </div>
  </div></body></html>`;
}
