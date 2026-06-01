// Gmail helper — SERVER ONLY.
// Envia e-mails através do conector Gmail (gateway Lovable).
// O remetente é a conta Gmail que o presidente conectou via OAuth.

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function base64UrlEncode(s: string): string {
  // btoa não está disponível em Worker para strings unicode; usa Buffer.
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawMime(args: { to: string; subject: string; html: string; from?: string }): string {
  const lines = [
    args.from ? `From: ${args.from}` : null,
    `To: ${args.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(args.subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    args.html,
  ].filter(Boolean) as string[];
  return base64UrlEncode(lines.join("\r\n"));
}

export type SendGmailArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendGmail(args: SendGmailArgs): Promise<{ id?: string; skipped?: boolean }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) {
    console.warn("sendGmail: GOOGLE_MAIL_API_KEY ou LOVABLE_API_KEY ausentes — pulando envio");
    return { skipped: true };
  }
  if (!args.to || !args.to.includes("@")) {
    console.warn("sendGmail: destinatário inválido", args.to);
    return { skipped: true };
  }

  const raw = buildRawMime({ to: args.to, subject: args.subject, html: args.html });

  const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Gmail send failed [${res.status}]: ${text}`);
    throw new Error(`Falha ao enviar e-mail (${res.status})`);
  }
  let json: any = {};
  try { json = JSON.parse(text); } catch {}
  return { id: json?.id };
}

/** Envia em paralelo, ignorando falhas individuais (apenas registra). */
export async function sendGmailBulk(messages: SendGmailArgs[]): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  await Promise.all(messages.map(async (m) => {
    try {
      const r = await sendGmail(m);
      if (r.skipped) failed++; else sent++;
    } catch (e) {
      failed++;
      console.error("sendGmailBulk item failed", e);
    }
  }));
  return { sent, failed };
}

/** Template base com identidade visual leve. */
export function emailLayout(opts: { title: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = opts.ctaUrl && opts.ctaLabel
    ? `<p style="margin:28px 0;"><a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 24px;background:#1f5132;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">${opts.ctaLabel}</a></p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:24px 28px;background:#1f5132;color:#fff;">
          <div style="font-size:13px;letter-spacing:2px;opacity:0.85;">LIGASUNO</div>
          <div style="font-size:22px;font-weight:800;margin-top:4px;">${opts.title}</div>
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;color:#0f172a;">
          ${opts.bodyHtml}
          ${cta}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;text-align:center;">
          Este é um e-mail automático da Ligasuno. Em caso de dúvidas, procure a presidência da sua liga.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
