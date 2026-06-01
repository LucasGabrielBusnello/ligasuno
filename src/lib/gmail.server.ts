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

/** Template base com identidade visual da liga (cor). */
export function emailLayout(opts: {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  brandColor?: string;
  leagueName?: string;
  city?: string;
  signature?: string;
  signatureEmail?: string;
}): string {
  const brand = (opts.brandColor || "#1f5132").trim();
  const darkBg = "#0b1410";
  const panelBg = "#101c17";
  const subtleBg = "#0e1a14";
  const chip = opts.leagueName
    ? `<div style="display:inline-block;padding:8px 14px;border:1px solid ${brand}55;background:${brand}26;color:#cfe9da;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${opts.leagueName}${opts.city ? ` · ${opts.city}` : ""}</div>`
    : `<div style="font-size:12px;letter-spacing:2px;color:${brand};font-weight:700;">LIGASUNO</div>`;
  const cta = opts.ctaUrl && opts.ctaLabel
    ? `<p style="margin:28px 0 8px;"><a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 26px;background:${brand};color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:14px;">${opts.ctaLabel}</a></p>`
    : "";
  const sig = opts.signature
    ? `<p style="margin:28px 0 4px;color:#8aa399;font-size:13px;">${opts.signature}</p>${opts.signatureEmail ? `<p style="margin:0;"><a href="mailto:${opts.signatureEmail}" style="color:${brand};text-decoration:none;font-size:13px;">${opts.signatureEmail}</a></p>` : ""}`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${darkBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6efe9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;background:${darkBg};">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:${panelBg};border-radius:14px;overflow:hidden;border:1px solid ${brand}40;">
        <tr><td style="padding:32px 36px 8px;">
          ${chip}
          <h1 style="font-size:26px;font-weight:800;margin:18px 0 0;color:#ffffff;line-height:1.25;">${opts.title}</h1>
        </td></tr>
        <tr><td style="padding:8px 36px 28px;font-size:15px;line-height:1.65;color:#cfd9d3;">
          ${opts.bodyHtml}
          ${cta}
          ${sig}
        </td></tr>
        <tr><td style="padding:16px 36px;background:${subtleBg};border-top:1px solid ${brand}33;font-size:11px;color:#6b7e75;text-align:center;letter-spacing:0.3px;">
          Este é um e-mail automático da Ligasuno. Em caso de dúvidas, procure a presidência da sua liga.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Card destacado para usar dentro do bodyHtml — adota a cor da liga. */
export function emailInfoCard(opts: { title: string; rows: Array<{ label: string; value: string }>; brandColor?: string }): string {
  const brand = (opts.brandColor || "#1f5132").trim();
  const rows = opts.rows
    .map((r) => `<p style="margin:6px 0;color:#cfd9d3;"><strong style="color:#ffffff;">${r.label}:</strong> ${r.value}</p>`)
    .join("");
  return `<div style="margin:18px 0;padding:18px 20px;border:1px solid ${brand}40;background:#0c1a14;border-radius:12px;">
    <div style="font-size:11px;letter-spacing:2px;color:${brand};font-weight:700;text-transform:uppercase;margin-bottom:10px;">${opts.title}</div>
    ${rows}
  </div>`;
}
