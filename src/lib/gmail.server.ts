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
  // Codifica o HTML em base64 para evitar problemas com UTF-8 multibyte (—, é, ã)
  // que quebram o corpo quando enviado como 7bit. Quebra em linhas de 76 chars (RFC).
  const htmlB64 = Buffer.from(args.html, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const subjectB64 = Buffer.from(args.subject, "utf-8").toString("base64");
  const headers = [
    args.from ? `From: ${args.from}` : null,
    `To: ${args.to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean) as string[];
  const mime = headers.join("\r\n") + "\r\n\r\n" + htmlB64;
  return base64UrlEncode(mime);
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

// ============== Helpers compartilhados ==============
const PUBLISHED_URL = "https://ligasuno.lovable.app";
const HUB_GREEN = "#1f5132";

function fmtDateBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
function fmtTimeBR(t?: string | null) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

// ============== E-mail de boas-vindas (hub) ==============
export async function sendWelcomeEmail(to: string, fullName?: string | null) {
  const name = fullName?.trim() || "futuro(a) ligante";
  return sendGmail({
    to,
    subject: "Bem-vindo(a) ao Ligasuno!",
    html: emailLayout({
      title: `Bem-vindo(a), ${name}!`,
      brandColor: HUB_GREEN,
      leagueName: "LIGASUNO",
      bodyHtml: `<p>Obrigado(a) por criar sua conta no <strong>Ligasuno</strong>, o hub das ligas acadêmicas da UNOCHAPECÓ. Aqui você concentra tudo o que precisa para viver a experiência acadêmica completa.</p>
        ${emailInfoCard({
          title: "O que você já pode fazer",
          brandColor: HUB_GREEN,
          rows: [
            { label: "Ligas", value: "Conheça as ligas e se inscreva nas provas de seleção" },
            { label: "Eventos", value: "Inscreva-se em simpósios com desconto para ligantes" },
            { label: "Minicursos", value: "Vagas exclusivas dentro dos eventos das ligas" },
            { label: "Painel do ligante", value: "Quizzes, agenda, frequência e semestralidade num só lugar" },
          ],
        })}
        <p>Boas-vindas e bons estudos. Quando precisar, é só voltar ao hub.</p>`,
      ctaLabel: "Acessar o Ligasuno",
      ctaUrl: PUBLISHED_URL,
      signature: "— Equipe Ligasuno",
    }),
  });
}

// ============== E-mail: classificado como Ligante ==============
export async function sendClassifiedAsLiganteEmail(args: {
  to: string;
  fullName: string;
  leagueName: string;
  leagueSlug: string;
  brandColor?: string;
}) {
  const brand = args.brandColor || HUB_GREEN;
  return sendGmail({
    to: args.to,
    subject: `Parabéns! Você é agora ligante da ${args.leagueName}`,
    html: emailLayout({
      title: `${args.fullName}, você foi aprovado(a)!`,
      brandColor: brand,
      leagueName: args.leagueName,
      bodyHtml: `<p>É com grande satisfação que confirmamos: você foi <strong>classificado(a) como ligante da ${args.leagueName}</strong>. Bem-vindo(a) ao time!</p>
        <p>A partir de agora, você tem acesso ao painel de ligante com agenda, quizzes, frequência, desempenho e semestralidade da liga.</p>
        <p>Fique atento(a) à comunicação da diretoria para os próximos passos.</p>`,
      ctaLabel: "Acessar painel do ligante",
      ctaUrl: `${PUBLISHED_URL}/ligante/${args.leagueSlug}`,
      signature: `— Presidência da ${args.leagueName}`,
    }),
  });
}

// ============== E-mail: confirmação de inscrição em evento ==============
export async function sendEventRegistrationEmail(args: {
  to: string;
  fullName: string;
  leagueName: string;
  leagueSlug: string;
  brandColor?: string;
  eventTitle: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  eventDescription?: string | null;
  paidPrice?: number;
}) {
  const brand = args.brandColor || HUB_GREEN;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Evento", value: args.eventTitle },
  ];
  if (args.eventDate) rows.push({ label: "Data", value: fmtDateBR(args.eventDate) });
  if (args.eventTime) rows.push({ label: "Horário", value: fmtTimeBR(args.eventTime) });
  if (args.eventLocation) rows.push({ label: "Local", value: args.eventLocation });
  rows.push({
    label: "Valor pago",
    value: Number(args.paidPrice ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  });
  return sendGmail({
    to: args.to,
    subject: `Inscrição confirmada — ${args.eventTitle}`,
    html: emailLayout({
      title: `${args.fullName}, sua inscrição está confirmada!`,
      brandColor: brand,
      leagueName: args.leagueName,
      bodyHtml: `<p>Recebemos sua inscrição no evento <strong>${args.eventTitle}</strong> da <strong>${args.leagueName}</strong>.</p>
        ${emailInfoCard({ title: "Detalhes do evento", brandColor: brand, rows })}
        ${args.eventDescription ? `<p style="white-space:pre-line;">${args.eventDescription}</p>` : ""}
        <p>Você receberá lembretes automáticos uma semana antes, um dia antes e no dia do evento.</p>`,
      ctaLabel: "Ver na página da liga",
      ctaUrl: `${PUBLISHED_URL}/${args.leagueSlug}`,
      signature: `— Presidência da ${args.leagueName}`,
    }),
  });
}

// ============== E-mail: confirmação de inscrição em minicurso ==============
export async function sendMinicourseRegistrationEmail(args: {
  to: string;
  fullName: string;
  leagueName: string;
  leagueSlug: string;
  brandColor?: string;
  minicourseTitle: string;
  instructor?: string | null;
  startsAt?: string | null;
  location?: string | null;
  description?: string | null;
  paidPrice?: number;
}) {
  const brand = args.brandColor || HUB_GREEN;
  const startDate = args.startsAt ? new Date(args.startsAt) : null;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Minicurso", value: args.minicourseTitle },
  ];
  if (args.instructor) rows.push({ label: "Ministrante", value: args.instructor });
  if (startDate) {
    rows.push({ label: "Data", value: startDate.toLocaleDateString("pt-BR") });
    rows.push({ label: "Horário", value: startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
  }
  if (args.location) rows.push({ label: "Local", value: args.location });
  rows.push({
    label: "Valor pago",
    value: Number(args.paidPrice ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  });
  return sendGmail({
    to: args.to,
    subject: `Inscrição confirmada — Minicurso ${args.minicourseTitle}`,
    html: emailLayout({
      title: `${args.fullName}, sua vaga no minicurso está garantida!`,
      brandColor: brand,
      leagueName: args.leagueName,
      bodyHtml: `<p>Sua inscrição no minicurso <strong>${args.minicourseTitle}</strong> foi confirmada.</p>
        ${emailInfoCard({ title: "Detalhes do minicurso", brandColor: brand, rows })}
        ${args.description ? `<p style="white-space:pre-line;">${args.description}</p>` : ""}`,
      ctaLabel: "Ver na página da liga",
      ctaUrl: `${PUBLISHED_URL}/${args.leagueSlug}`,
      signature: `— Presidência da ${args.leagueName}`,
    }),
  });
}

// ============== E-mail: lembrete de evento ==============
export async function sendEventReminderEmail(args: {
  to: string;
  fullName: string;
  leagueName: string;
  leagueSlug: string;
  brandColor?: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string | null;
  eventLocation?: string | null;
  kind: "7d" | "1d" | "0d";
}) {
  const brand = args.brandColor || HUB_GREEN;
  const subjects: Record<string, string> = {
    "7d": `Falta 1 semana — ${args.eventTitle}`,
    "1d": `Amanhã — ${args.eventTitle}`,
    "0d": `É hoje — ${args.eventTitle}`,
  };
  const intros: Record<string, string> = {
    "7d": `Falta exatamente <strong>1 semana</strong> para o evento <strong>${args.eventTitle}</strong>. Vai dar tempo de se preparar!`,
    "1d": `É <strong>amanhã</strong>! O evento <strong>${args.eventTitle}</strong> está chegando — confira os detalhes abaixo.`,
    "0d": `<strong>Hoje é o dia!</strong> O evento <strong>${args.eventTitle}</strong> acontece em algumas horas. Não se esqueça!`,
  };
  const rows: Array<{ label: string; value: string }> = [
    { label: "Data", value: fmtDateBR(args.eventDate) },
  ];
  if (args.eventTime) rows.push({ label: "Horário", value: fmtTimeBR(args.eventTime) });
  if (args.eventLocation) rows.push({ label: "Local", value: args.eventLocation });

  return sendGmail({
    to: args.to,
    subject: subjects[args.kind],
    html: emailLayout({
      title: `${args.fullName}, lembrete do evento`,
      brandColor: brand,
      leagueName: args.leagueName,
      bodyHtml: `<p>${intros[args.kind]}</p>
        ${emailInfoCard({ title: args.eventTitle, brandColor: brand, rows })}`,
      ctaLabel: "Abrir página da liga",
      ctaUrl: `${PUBLISHED_URL}/${args.leagueSlug}`,
      signature: `— Presidência da ${args.leagueName}`,
    }),
  });
}

// ============== E-mail: minicurso no dia ==============
export async function sendMinicourseDayEmail(args: {
  to: string;
  fullName: string;
  leagueName: string;
  leagueSlug: string;
  brandColor?: string;
  minicourseTitle: string;
  instructor?: string | null;
  startsAt: string;
  location?: string | null;
}) {
  const brand = args.brandColor || HUB_GREEN;
  const d = new Date(args.startsAt);
  const rows: Array<{ label: string; value: string }> = [
    { label: "Minicurso", value: args.minicourseTitle },
    { label: "Horário", value: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) },
  ];
  if (args.instructor) rows.push({ label: "Ministrante", value: args.instructor });
  if (args.location) rows.push({ label: "Local", value: args.location });

  return sendGmail({
    to: args.to,
    subject: `Hoje — Minicurso ${args.minicourseTitle}`,
    html: emailLayout({
      title: `${args.fullName}, é hoje seu minicurso!`,
      brandColor: brand,
      leagueName: args.leagueName,
      bodyHtml: `<p>Seu minicurso <strong>${args.minicourseTitle}</strong> acontece hoje. Boa atividade!</p>
        ${emailInfoCard({ title: "Detalhes", brandColor: brand, rows })}`,
      ctaLabel: "Abrir página da liga",
      ctaUrl: `${PUBLISHED_URL}/${args.leagueSlug}`,
      signature: `— Presidência da ${args.leagueName}`,
    }),
  });
}

// ============== E-mail: pedido de desistência (para o presidente) ==============
export async function sendLeaveRequestEmail(args: {
  to: string;
  leagueName: string;
  leagueSlug: string;
  brandColor?: string;
  ligante: { fullName: string; cpf?: string | null; registration?: string | null; email?: string | null };
  reason?: string | null;
}) {
  const brand = args.brandColor || HUB_GREEN;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Nome", value: args.ligante.fullName },
    { label: "CPF", value: args.ligante.cpf || "—" },
    { label: "Matrícula", value: args.ligante.registration || "—" },
  ];
  if (args.ligante.email) rows.push({ label: "E-mail", value: args.ligante.email });
  return sendGmail({
    to: args.to,
    subject: `Pedido de desistência — ${args.leagueName}`,
    html: emailLayout({
      title: "Novo pedido de desistência da liga",
      brandColor: brand,
      leagueName: args.leagueName,
      bodyHtml: `<p>O usuário <strong>${args.ligante.fullName}</strong> (CPF ${args.ligante.cpf || "—"}, matrícula ${args.ligante.registration || "—"}) realizou pedido para desinscrição na liga.</p>
        ${emailInfoCard({ title: "Solicitante", brandColor: brand, rows })}
        ${args.reason ? `<p><strong>Motivo informado:</strong><br><span style="white-space:pre-line;">${args.reason}</span></p>` : ""}
        <p>Acesse o painel do presidente para aprovar ou recusar o pedido.</p>`,
      ctaLabel: "Abrir painel do presidente",
      ctaUrl: `${PUBLISHED_URL}/presidente/${args.leagueSlug}`,
      signature: `— Sistema Ligasuno`,
    }),
  });
}

// ============== Envio com anexo (PDF) ==============
export async function sendGmailWithAttachment(args: {
  to: string;
  subject: string;
  html: string;
  attachment: { filename: string; mimeType: string; contentBase64: string };
}): Promise<{ id?: string; skipped?: boolean }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) {
    console.warn("sendGmailWithAttachment: chaves ausentes — pulando");
    return { skipped: true };
  }
  if (!args.to || !args.to.includes("@")) return { skipped: true };

  const boundary = `=_lvb_${Math.random().toString(36).slice(2)}`;
  const subjectB64 = Buffer.from(args.subject, "utf-8").toString("base64");
  const htmlB64 = Buffer.from(args.html, "utf-8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const attB64 = args.attachment.contentBase64.replace(/(.{76})/g, "$1\r\n");

  const mime = [
    `To: ${args.to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    htmlB64,
    "",
    `--${boundary}`,
    `Content-Type: ${args.attachment.mimeType}; name="${args.attachment.filename}"`,
    `Content-Disposition: attachment; filename="${args.attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    attB64,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const raw = Buffer.from(mime, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

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
    console.error(`Gmail attach send failed [${res.status}]: ${text}`);
    throw new Error(`Falha ao enviar e-mail com anexo (${res.status})`);
  }
  let json: any = {};
  try { json = JSON.parse(text); } catch {}
  return { id: json?.id };
}

