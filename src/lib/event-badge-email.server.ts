// Envia o e-mail de confirmação de inscrição em evento COM o crachá (QR + código),
// usando a identidade visual (cor e logo) da liga organizadora.
import QRCode from "qrcode";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendGmailWithAttachment } from "@/lib/gmail.server";

const PUBLISHED_URL = "https://ligasuno.com.br";
const HUB_GREEN = "#1f5132";

function fmtDateBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function esc(s: string) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

function badgeHtml(o: {
  brand: string;
  leagueName: string;
  leagueLogo?: string | null;
  fullName: string;
  eventTitle: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  code: string;
  paidPrice: number;
  slug: string;
}) {
  const brand = o.brand || HUB_GREEN;
  const rows: Array<[string, string]> = [["Evento", o.eventTitle]];
  if (o.eventDate) rows.push(["Data", fmtDateBR(o.eventDate)]);
  if (o.eventTime) rows.push(["Horário", String(o.eventTime).slice(0, 5)]);
  if (o.eventLocation) rows.push(["Local", o.eventLocation]);
  rows.push(["Valor pago", Number(o.paidPrice || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]);
  const rowsHtml = rows
    .map(([l, v]) => `<p style="margin:6px 0;color:#33413a;"><strong style="color:#0d1b14;">${esc(l)}:</strong> ${esc(v)}</p>`)
    .join("");
  const logo = o.leagueLogo
    ? `<img src="${o.leagueLogo}" alt="${esc(o.leagueName)}" width="64" height="64" style="width:64px;height:64px;border-radius:16px;object-fit:cover;border:2px solid #ffffff55;display:block;margin:0 auto 12px;" />`
    : "";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f2f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0d1b14;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#f2f5f3;">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${brand}33;">
        <tr><td align="center" style="padding:28px 32px;background:${brand};">
          ${logo}
          <div style="font-size:12px;letter-spacing:2px;color:#ffffffcc;font-weight:700;text-transform:uppercase;">${esc(o.leagueName)}</div>
          <h1 style="font-size:23px;font-weight:800;margin:8px 0 0;color:#ffffff;line-height:1.3;">Inscrição confirmada</h1>
        </td></tr>
        <tr><td style="padding:26px 32px 6px;font-size:15px;line-height:1.6;color:#33413a;">
          <p style="margin:0 0 14px;">Olá <strong>${esc(o.fullName)}</strong>, sua inscrição em <strong>${esc(o.eventTitle)}</strong> está confirmada. Abaixo está o seu <strong>crachá de credenciamento</strong> — apresente o QR code na entrada do evento.</p>
        </td></tr>
        <tr><td align="center" style="padding:6px 32px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:2px dashed ${brand}66;border-radius:16px;background:${brand}0d;">
            <tr><td align="center" style="padding:22px 18px;">
              <div style="font-size:11px;letter-spacing:2px;color:${brand};font-weight:800;text-transform:uppercase;">Crachá de credenciamento</div>
              <div style="font-size:18px;font-weight:800;color:#0d1b14;margin:10px 0 14px;">${esc(o.fullName)}</div>
              <img src="cid:cracha-qr" alt="QR code do crachá" width="220" height="220" style="width:220px;height:220px;display:block;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid ${brand}33;" />
              <div style="margin-top:14px;font-size:12px;color:#5b6a63;">Código de check-in</div>
              <div style="font-size:30px;letter-spacing:8px;font-weight:800;color:${brand};font-family:'Courier New',monospace;">${esc(o.code)}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 32px 4px;">
          <div style="padding:16px 18px;border:1px solid ${brand}33;background:#f7faf8;border-radius:12px;">
            <div style="font-size:11px;letter-spacing:2px;color:${brand};font-weight:800;text-transform:uppercase;margin-bottom:8px;">Detalhes do evento</div>
            ${rowsHtml}
          </div>
        </td></tr>
        <tr><td style="padding:18px 32px 28px;">
          <p style="margin:0 0 18px;font-size:13px;color:#5b6a63;">O QR code também está anexado a este e-mail em PNG, caso prefira salvar na galeria.</p>
          <p style="margin:0;"><a href="${PUBLISHED_URL}/${o.slug}" style="display:inline-block;padding:13px 26px;background:${brand};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:14px;">Ver na página da liga</a></p>
          <p style="margin:22px 0 0;color:#5b6a63;font-size:13px;">— Presidência da ${esc(o.leagueName)}</p>
        </td></tr>
        <tr><td style="padding:14px 32px;background:#f2f5f3;border-top:1px solid ${brand}22;font-size:11px;color:#7b8a83;text-align:center;">
          E-mail automático · ${esc(o.leagueName)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Envia (uma única vez por inscrição) o e-mail com o crachá do inscrito. */
export async function sendEventBadgeEmail(registrationId: string): Promise<{ sent: boolean; reason?: string }> {
  const { data: reg } = await (supabaseAdmin as any)
    .from("event_registrations")
    .select(
      "id, full_name, social_name, paid_price, checkin_code, status, event_id, " +
        "league_events!inner(id, title, event_date, schedule, location, league_id, leagues:league_id(name, slug, theme_color, icon_url)), " +
        "profiles!event_registrations_user_id_fkey(email, full_name)",
    )
    .eq("id", registrationId)
    .maybeSingle();

  if (!reg) return { sent: false, reason: "registration_not_found" };
  const ev: any = reg.league_events;
  const lg: any = ev?.leagues;
  const email: string | undefined = reg.profiles?.email;
  const code: string | undefined = reg.checkin_code;
  if (!email) return { sent: false, reason: "no_email" };
  if (!code) return { sent: false, reason: "no_checkin_code" };

  // Idempotência
  const { data: already } = await (supabaseAdmin as any)
    .from("event_email_log")
    .select("id")
    .eq("kind", "badge")
    .eq("reference_id", registrationId)
    .maybeSingle();
  if (already) return { sent: false, reason: "already_sent" };

  const dataUrl = await QRCode.toDataURL(code, { width: 440, margin: 1 });
  const qrBase64 = dataUrl.split(",")[1];

  const html = badgeHtml({
    brand: lg?.theme_color || HUB_GREEN,
    leagueName: lg?.name || "Liga",
    leagueLogo: lg?.icon_url,
    fullName: reg.social_name || reg.full_name || reg.profiles?.full_name || "Participante",
    eventTitle: ev?.title || "Evento",
    eventDate: ev?.event_date,
    eventTime: ev?.schedule,
    eventLocation: ev?.location,
    code,
    paidPrice: Number(reg.paid_price) || 0,
    slug: lg?.slug || "",
  });

  await sendGmailWithAttachment({
    to: email,
    subject: `Crachá e confirmação — ${ev?.title ?? "Evento"}`,
    html,
    attachment: {
      filename: `cracha-${code}.png`,
      mimeType: "image/png",
      contentBase64: qrBase64,
      contentId: "cracha-qr",
      inline: true,
    },
  });

  await (supabaseAdmin as any)
    .from("event_email_log")
    .insert({ event_id: ev?.id ?? reg.event_id, kind: "badge", reference_id: registrationId, recipient: email })
    .then(
      () => {},
      () => {},
    );

  return { sent: true };
}
