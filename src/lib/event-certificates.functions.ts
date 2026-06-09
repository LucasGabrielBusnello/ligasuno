import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function ensureEventOwner(adminCli: any, eventId: string, userId: string) {
  const { data: ev } = await adminCli.from("league_events").select("*, leagues!inner(id,name,slug,theme_color,president_id)").eq("id", eventId).maybeSingle();
  if (!ev) throw new Error("Evento não encontrado");
  if ((ev as any).leagues.president_id !== userId) {
    const { data: r } = await adminCli.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();
    if (!r) throw new Error("Sem permissão");
  }
  return ev;
}
async function ensureMcOwner(adminCli: any, mcId: string, userId: string) {
  const { data: mc } = await adminCli.from("league_minicourses").select("*, league_events!inner(id, title, event_date, leagues!inner(id,name,slug,theme_color,president_id))").eq("id", mcId).maybeSingle();
  if (!mc) throw new Error("Minicurso não encontrado");
  if ((mc as any).league_events.leagues.president_id !== userId) {
    const { data: r } = await adminCli.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();
    if (!r) throw new Error("Sem permissão");
  }
  return mc;
}

// ===== Preview: event =====
export const previewEventCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const ev: any = await ensureEventOwner(admin, data.event_id, context.userId);
    const checkinCount = Math.max(1, Number(ev.checkin_count) || 1);
    const totalHours = Number(ev.total_hours) || 0;

    const { data: regs } = await admin.from("event_registrations")
      .select("id,user_id,full_name,cpf,status")
      .eq("event_id", data.event_id).eq("status", "paid").order("full_name");
    const list = regs ?? [];
    const uids = Array.from(new Set(list.map((r: any) => r.user_id)));
    const pmap: Record<string, any> = {};
    if (uids.length) {
      const { data: profs } = await admin.from("profiles").select("id,email,full_name").in("id", uids);
      (profs ?? []).forEach((p: any) => { pmap[p.id] = p; });
    }
    const { data: chks } = await admin.from("event_checkins").select("registration_id,checkin_index").eq("event_id", data.event_id);
    const cmap: Record<string, Set<number>> = {};
    (chks ?? []).forEach((c: any) => { (cmap[c.registration_id] ||= new Set()).add(c.checkin_index); });

    const members = list.map((r: any) => {
      const present = cmap[r.id]?.size || 0;
      const hours = totalHours * (present / checkinCount);
      return {
        registration_id: r.id, user_id: r.user_id,
        full_name: r.full_name || pmap[r.user_id]?.full_name || "",
        cpf: r.cpf || "", email: pmap[r.user_id]?.email || "",
        present_checkins: present, checkin_count: checkinCount, hours,
      };
    });

    const { data: sig } = await admin.from("league_president_signatures")
      .select("signature_url, president_name").eq("league_id", ev.leagues.id).maybeSingle();

    return {
      event: { id: ev.id, title: ev.title, event_date: ev.event_date, total_hours: totalHours, checkin_count: checkinCount },
      league: { id: ev.leagues.id, name: ev.leagues.name, theme_color: ev.leagues.theme_color },
      members, signature: sig ?? null,
    };
  });

// ===== Preview: minicourse =====
export const previewMinicourseCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ minicourse_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const mc: any = await ensureMcOwner(admin, data.minicourse_id, context.userId);
    const totalHours = Number(mc.total_hours) || 0;

    const { data: regs } = await admin.from("minicourse_registrations")
      .select("id,user_id,full_name,cpf,status").eq("minicourse_id", data.minicourse_id).eq("status", "paid");
    const list = regs ?? [];
    const uids = Array.from(new Set(list.map((r: any) => r.user_id)));
    const pmap: Record<string, any> = {};
    if (uids.length) {
      const { data: profs } = await admin.from("profiles").select("id,email,full_name").in("id", uids);
      (profs ?? []).forEach((p: any) => { pmap[p.id] = p; });
    }
    const { data: chks } = await admin.from("minicourse_checkins").select("registration_id").eq("minicourse_id", data.minicourse_id);
    const present = new Set((chks ?? []).map((c: any) => c.registration_id));

    const members = list.map((r: any) => ({
      registration_id: r.id, user_id: r.user_id,
      full_name: r.full_name || pmap[r.user_id]?.full_name || "",
      cpf: r.cpf || "", email: pmap[r.user_id]?.email || "",
      present: present.has(r.id), hours: present.has(r.id) ? totalHours : 0,
    }));

    const { data: sig } = await admin.from("league_president_signatures")
      .select("signature_url, president_name").eq("league_id", mc.league_events.leagues.id).maybeSingle();

    return {
      minicourse: { id: mc.id, title: mc.title, total_hours: totalHours, instructor: mc.instructor, starts_at: mc.starts_at },
      event: { id: mc.league_events.id, title: mc.league_events.title, event_date: mc.league_events.event_date },
      league: { id: mc.league_events.leagues.id, name: mc.league_events.leagues.name, theme_color: mc.league_events.leagues.theme_color },
      members, signature: sig ?? null,
    };
  });

// ===== PDF builder =====
function hexToRgb(hex: string) {
  const m = (hex || "#1f5132").replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v.slice(0, 6) || "1f5132", 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

async function buildEventCertPdf(opts: {
  fullName: string; cpf: string; leagueName: string;
  contextLabel: string; // e.g. "Evento: XPTO – 12/05/2026" or "Minicurso: XPTO – Evento"
  detailLines: string[]; // extra info shown small
  totalHours: number;
  themeColor: string;
  signaturePngBytes: Uint8Array | null;
  presidentName: string;
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { r, g, b } = hexToRgb(opts.themeColor);
  const theme = rgb(r, g, b);
  const themeDark = rgb(r * 0.5, g * 0.5, b * 0.5);
  const ink = rgb(0.14, 0.16, 0.15);
  const muted = rgb(0.45, 0.48, 0.46);
  const hairline = rgb(0.82, 0.86, 0.83);
  const W = 842, H = 595;

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 0, width: 14, height: H, color: theme });
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: hairline, borderWidth: 0.8 });

  page.drawText("LIGASUNO", { x: 56, y: H - 56, size: 9, font: sansBold, color: themeDark });
  page.drawText(opts.leagueName.toUpperCase(), { x: 140, y: H - 56, size: 9, font: sans, color: muted });
  page.drawLine({ start: { x: 56, y: H - 70 }, end: { x: W - 56, y: H - 70 }, thickness: 0.5, color: hairline });

  const eyebrow = "CERTIFICADO DE PARTICIPAÇÃO";
  page.drawText(eyebrow, { x: W / 2 - sansBold.widthOfTextAtSize(eyebrow, 10) / 2, y: H - 120, size: 10, font: sansBold, color: theme });

  const title = "Participação acadêmica";
  page.drawText(title, { x: W / 2 - serif.widthOfTextAtSize(title, 36) / 2, y: H - 168, size: 36, font: serif, color: ink });
  page.drawLine({ start: { x: W / 2 - 24, y: H - 188 }, end: { x: W / 2 + 24, y: H - 188 }, thickness: 1, color: theme });

  const intro = "Certificamos que";
  page.drawText(intro, { x: W / 2 - serifItalic.widthOfTextAtSize(intro, 12) / 2, y: H - 220, size: 12, font: serifItalic, color: muted });

  page.drawText(opts.fullName, { x: W / 2 - serifBold.widthOfTextAtSize(opts.fullName, 32) / 2, y: H - 258, size: 32, font: serifBold, color: ink });
  const cpfLine = `CPF ${opts.cpf || "—"}`;
  page.drawText(cpfLine, { x: W / 2 - sans.widthOfTextAtSize(cpfLine, 9) / 2, y: H - 276, size: 9, font: sans, color: muted });

  const body = `participou de "${opts.contextLabel}", promovido pela ${opts.leagueName}, com carga horária total de ${opts.totalHours.toFixed(1).replace(".", ",")} horas, conforme registro oficial de credenciamento.`;
  drawWrappedCentered(page, body, { x: 120, y: H - 310, width: W - 240, size: 12, font: serif, color: ink, lineHeight: 18 });

  // Hours card
  const cardX = 60, cardY = 130, cardW = 170, cardH = 78;
  page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: theme });
  const hoursTxt = opts.totalHours.toFixed(1).replace(".", ",");
  const hoursSize = hoursTxt.length > 4 ? 32 : 40;
  page.drawText(hoursTxt, { x: cardX + cardW / 2 - serifBold.widthOfTextAtSize(hoursTxt, hoursSize) / 2, y: cardY + cardH / 2 - 4, size: hoursSize, font: serifBold, color: rgb(1, 1, 1) });
  const hLabel = "horas certificadas";
  page.drawText(hLabel, { x: cardX + cardW / 2 - sans.widthOfTextAtSize(hLabel, 9) / 2, y: cardY + 14, size: 9, font: sans, color: rgb(1, 1, 1) });

  // Details list (right side)
  const listX = cardX + cardW + 30;
  let listY = cardY + cardH - 4;
  page.drawText("DETALHES", { x: listX, y: listY, size: 8, font: sansBold, color: themeDark });
  page.drawLine({ start: { x: listX, y: listY - 4 }, end: { x: listX + 110, y: listY - 4 }, thickness: 0.6, color: theme });
  listY -= 18;
  opts.detailLines.slice(0, 5).forEach((ln) => {
    page.drawText(ln, { x: listX, y: listY, size: 10, font: serif, color: ink });
    listY -= 14;
  });

  // Signature
  const sigRight = W - 60, sigLineY = 130, sigLineW = 220;
  if (opts.signaturePngBytes) {
    try {
      const img = await pdf.embedPng(opts.signaturePngBytes);
      const ratio = Math.min(180 / img.width, 56 / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      page.drawImage(img, { x: sigRight - sigLineW / 2 - w / 2, y: sigLineY + 6, width: w, height: h });
    } catch {}
  }
  page.drawLine({ start: { x: sigRight - sigLineW, y: sigLineY }, end: { x: sigRight, y: sigLineY }, thickness: 0.6, color: ink });
  const presLine = opts.presidentName || "Presidência";
  page.drawText(presLine, { x: sigRight - sigLineW / 2 - serifBold.widthOfTextAtSize(presLine, 11) / 2, y: sigLineY - 14, size: 11, font: serifBold, color: ink });
  const presSub = `Presidente · ${opts.leagueName}`;
  page.drawText(presSub, { x: sigRight - sigLineW / 2 - sans.widthOfTextAtSize(presSub, 8.5) / 2, y: sigLineY - 26, size: 8.5, font: sans, color: muted });

  page.drawText(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, { x: 56, y: 46, size: 8, font: sans, color: muted });
  const foot = "Documento gerado por LIGASUNO · ligasuno.lovable.app";
  page.drawText(foot, { x: W - 56 - sans.widthOfTextAtSize(foot, 8), y: 46, size: 8, font: sans, color: muted });
  return pdf.save();
}

function drawWrappedCentered(page: any, text: string, o: any) {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (o.font.widthOfTextAtSize(t, o.size) > o.width) { if (cur) lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => {
    const lw = o.font.widthOfTextAtSize(ln, o.size);
    page.drawText(ln, { x: o.x + (o.width - lw) / 2, y: o.y - i * o.lineHeight, size: o.size, font: o.font, color: o.color });
  });
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "certificado";
}

async function loadSignatureBytes(admin: any, leagueId: string): Promise<{ bytes: Uint8Array | null; presidentName: string }> {
  const { data: sig } = await admin.from("league_president_signatures").select("signature_url, president_name").eq("league_id", leagueId).maybeSingle();
  let bytes: Uint8Array | null = null;
  if (sig?.signature_url) {
    try {
      const { data: blob } = await admin.storage.from("league-signatures").download(sig.signature_url);
      if (blob) bytes = new Uint8Array(await blob.arrayBuffer());
    } catch {}
  }
  let presidentName = sig?.president_name || "";
  if (!presidentName) {
    const { data: lg } = await admin.from("leagues").select("president_id").eq("id", leagueId).maybeSingle();
    if (lg) {
      const { data: prof } = await admin.from("profiles").select("full_name,username").eq("id", lg.president_id).maybeSingle();
      presidentName = prof?.full_name || prof?.username || "Presidência";
    }
  }
  return { bytes, presidentName };
}

const recipientSchema = z.object({
  registration_id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2),
  cpf: z.string().trim().min(11),
  hours: z.number().min(0),
});

// ===== Send event certificates =====
export const sendEventCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    event_id: z.string().uuid(),
    recipients: z.array(recipientSchema).min(1),
    president_name: z.string().trim().min(2).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const ev: any = await ensureEventOwner(admin, data.event_id, context.userId);
    const league = ev.leagues;
    const { bytes: signatureBytes, presidentName: defaultPres } = await loadSignatureBytes(admin, league.id);
    const presidentName = data.president_name || defaultPres;
    const dateLabel = ev.event_date ? new Date(ev.event_date).toLocaleDateString("pt-BR") : "";

    let sent = 0; const failures: any[] = [];
    for (const rec of data.recipients) {
      try {
        const { data: prof } = await admin.from("profiles").select("email").eq("id", rec.user_id).maybeSingle();
        const to = prof?.email;
        if (!to) throw new Error("E-mail não encontrado");

        const pdfBytes = await buildEventCertPdf({
          fullName: rec.full_name, cpf: rec.cpf, leagueName: league.name,
          contextLabel: `${ev.title}${dateLabel ? " – " + dateLabel : ""}`,
          detailLines: [
            `Evento: ${ev.title}`,
            ...(dateLabel ? [`Data: ${dateLabel}`] : []),
            `Carga horária: ${rec.hours.toFixed(1).replace(".", ",")}h`,
          ],
          totalHours: rec.hours, themeColor: league.theme_color || "#1f5132",
          signaturePngBytes: signatureBytes, presidentName,
        });

        const base64 = Buffer.from(pdfBytes).toString("base64");
        const { sendGmailWithAttachment, emailLayout } = await import("./gmail.server");
        const html = emailLayout({
          title: `Seu certificado — ${ev.title}`,
          brandColor: league.theme_color || "#1f5132",
          leagueName: league.name,
          bodyHtml: `<p>Olá, <strong>${rec.full_name}</strong>!</p><p>Segue em anexo seu certificado de participação no evento <strong>${ev.title}</strong>${dateLabel ? ` (${dateLabel})` : ""}, promovido pela <strong>${league.name}</strong>, com carga horária de <strong>${rec.hours.toFixed(1).replace(".", ",")}h</strong>.</p>`,
          signature: `— ${presidentName}, Presidente da ${league.name}`,
        });
        await sendGmailWithAttachment({
          to, subject: `Certificado — ${ev.title}`, html,
          attachment: { filename: `certificado-${slugify(rec.full_name)}.pdf`, mimeType: "application/pdf", contentBase64: base64 },
        });
        await admin.from("certificate_email_log").insert({
          league_id: league.id, user_id: rec.user_id, email: to,
          full_name: rec.full_name, cpf: rec.cpf, total_hours: rec.hours, status: "sent",
        });
        sent++;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        failures.push({ user_id: rec.user_id, full_name: rec.full_name, error: msg });
      }
    }
    return { sent, failed: failures.length, failures };
  });

// ===== Send minicourse certificates =====
export const sendMinicourseCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    minicourse_id: z.string().uuid(),
    recipients: z.array(recipientSchema).min(1),
    president_name: z.string().trim().min(2).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const mc: any = await ensureMcOwner(admin, data.minicourse_id, context.userId);
    const ev = mc.league_events; const league = ev.leagues;
    const { bytes: signatureBytes, presidentName: defaultPres } = await loadSignatureBytes(admin, league.id);
    const presidentName = data.president_name || defaultPres;
    const dateLabel = mc.starts_at ? new Date(mc.starts_at).toLocaleDateString("pt-BR") : "";

    let sent = 0; const failures: any[] = [];
    for (const rec of data.recipients) {
      try {
        const { data: prof } = await admin.from("profiles").select("email").eq("id", rec.user_id).maybeSingle();
        const to = prof?.email;
        if (!to) throw new Error("E-mail não encontrado");

        const pdfBytes = await buildEventCertPdf({
          fullName: rec.full_name, cpf: rec.cpf, leagueName: league.name,
          contextLabel: `Minicurso "${mc.title}" — ${ev.title}`,
          detailLines: [
            `Minicurso: ${mc.title}`,
            `Evento: ${ev.title}`,
            ...(dateLabel ? [`Data: ${dateLabel}`] : []),
            ...(mc.instructor ? [`Lecionado por: ${mc.instructor}`] : []),
            `Carga horária: ${rec.hours.toFixed(1).replace(".", ",")}h`,
          ],
          totalHours: rec.hours, themeColor: league.theme_color || "#1f5132",
          signaturePngBytes: signatureBytes, presidentName,
        });

        const base64 = Buffer.from(pdfBytes).toString("base64");
        const { sendGmailWithAttachment, emailLayout } = await import("./gmail.server");
        const html = emailLayout({
          title: `Seu certificado — ${mc.title}`,
          brandColor: league.theme_color || "#1f5132",
          leagueName: league.name,
          bodyHtml: `<p>Olá, <strong>${rec.full_name}</strong>!</p><p>Segue em anexo seu certificado de participação no minicurso <strong>${mc.title}</strong> (do evento ${ev.title}), com carga horária de <strong>${rec.hours.toFixed(1).replace(".", ",")}h</strong>.</p>`,
          signature: `— ${presidentName}, Presidente da ${league.name}`,
        });
        await sendGmailWithAttachment({
          to, subject: `Certificado — ${mc.title}`, html,
          attachment: { filename: `certificado-${slugify(rec.full_name)}.pdf`, mimeType: "application/pdf", contentBase64: base64 },
        });
        await admin.from("certificate_email_log").insert({
          league_id: league.id, user_id: rec.user_id, email: to,
          full_name: rec.full_name, cpf: rec.cpf, total_hours: rec.hours, status: "sent",
        });
        sent++;
      } catch (e: any) {
        failures.push({ user_id: rec.user_id, full_name: rec.full_name, error: e?.message ?? String(e) });
      }
    }
    return { sent, failed: failures.length, failures };
  });
