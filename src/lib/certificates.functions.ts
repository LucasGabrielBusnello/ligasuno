import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const previewSchema = z.object({ league_id: z.string().uuid() });

const recipientSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2),
  cpf: z.string().trim().min(11),
});
const sendSchema = z.object({
  league_id: z.string().uuid(),
  recipients: z.array(recipientSchema).min(1),
  president_name: z.string().trim().min(2).optional(),
});

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.02).max(1),
  height: z.number().min(0.02).max(1),
});

const templateSchema = z.object({
  league_id: z.string().uuid(),
  image_base64: z.string().optional(),
  name_box: boxSchema,
  signature_box: boxSchema,
  font_family: z.enum(["TimesRoman", "TimesRomanBold", "Helvetica", "HelveticaBold", "Courier", "CourierBold"]),
});

export type CertificateBox = z.infer<typeof boxSchema>;
export type CertificateTemplatePayload = {
  imageBytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  nameBox: CertificateBox;
  signatureBox: CertificateBox;
  fontFamily: string;
};

async function adminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function ensurePresidentOrAdmin(supabaseUser: any, leagueId: string, userId: string) {
  const { data: l } = await supabaseUser.from("leagues").select("president_id").eq("id", leagueId).maybeSingle();
  if (!l) throw new Error("Liga não encontrada");
  const { data: roles } = await supabaseUser.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin_master");
  if (l.president_id !== userId && !isAdmin) throw new Error("Acesso negado");
}

/** Devolve membros (ligante/diretor/presidente) com nome/cpf/email pré-preenchidos e horas totais (status=presente). */
export const previewCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => previewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePresidentOrAdmin(context.supabase, data.league_id, context.userId);
    const admin = await adminClient();

    const { data: league } = await admin.from("leagues").select("id,name,slug,theme_color,president_id").eq("id", data.league_id).maybeSingle();
    if (!league) throw new Error("Liga não encontrada");

    const { data: members } = await admin
      .from("league_memberships")
      .select("user_id, role")
      .eq("league_id", data.league_id);

    const userIds = [...new Set((members ?? []).map((m: any) => m.user_id))];
    if (league.president_id && !userIds.includes(league.president_id)) userIds.push(league.president_id);

    const [{ data: profiles }, { data: attendance }] = await Promise.all([
      admin.from("profiles").select("id, username, email, full_name, cpf").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("league_attendance").select("user_id, activity, activity_date, status, hours").eq("league_id", data.league_id),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const byUser = new Map<string, { total: number; items: Array<{ activity: string; date: string; hours: number; status: string }> }>();
    (attendance ?? []).forEach((r: any) => {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, { total: 0, items: [] });
      const bucket = byUser.get(r.user_id)!;
      const h = Number(r.hours) || 0;
      bucket.items.push({ activity: r.activity, date: r.activity_date, hours: h, status: r.status });
      if (r.status === "presente") bucket.total += h;
    });

    const list = userIds.map((uid) => {
      const p: any = profileMap.get(uid) ?? {};
      const role = uid === league.president_id ? "presidente" : (members ?? []).find((m: any) => m.user_id === uid)?.role ?? "ligante";
      const att = byUser.get(uid) ?? { total: 0, items: [] };
      return {
        user_id: uid,
        full_name: p.full_name ?? p.username ?? "",
        cpf: p.cpf ?? "",
        email: p.email ?? "",
        role,
        total_hours: Number(att.total.toFixed(2)),
        activities: att.items.sort((a, b) => a.date.localeCompare(b.date)),
      };
    }).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

    // assinatura salva
    const { data: sig } = await admin.from("league_president_signatures").select("signature_url, president_name").eq("league_id", data.league_id).maybeSingle();

    return { league, members: list, signature: sig ?? null };
  });

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v.slice(0, 6) || "1f5132", 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function clampBox(box: any): CertificateBox {
  const x = Math.max(0, Math.min(0.98, Number(box?.x ?? 0)));
  const y = Math.max(0, Math.min(0.98, Number(box?.y ?? 0)));
  const width = Math.max(0.02, Math.min(1 - x, Number(box?.width ?? 0.2)));
  const height = Math.max(0.02, Math.min(1 - y, Number(box?.height ?? 0.08)));
  return { x, y, width, height };
}

function fontName(fontFamily: string) {
  return ["TimesRoman", "TimesRomanBold", "Helvetica", "HelveticaBold", "Courier", "CourierBold"].includes(fontFamily) ? fontFamily : "TimesRomanBold";
}

export async function loadCertificateTemplate(admin: any, leagueId: string): Promise<CertificateTemplatePayload | null> {
  const { data: row } = await admin.from("league_certificate_templates").select("*").eq("league_id", leagueId).maybeSingle();
  if (!row?.template_url) return null;
  const { data: blob } = await admin.storage.from("league-signatures").download(row.template_url);
  if (!blob) return null;
  const type = blob.type === "image/jpeg" || String(row.template_url).toLowerCase().endsWith(".jpg") ? "image/jpeg" : "image/png";
  return {
    imageBytes: new Uint8Array(await blob.arrayBuffer()),
    mimeType: type,
    nameBox: clampBox(row.name_box),
    signatureBox: clampBox(row.signature_box),
    fontFamily: fontName(row.font_family),
  };
}

export async function buildTemplateCertificatePdf(opts: {
  fullName: string;
  template: CertificateTemplatePayload;
  signaturePngBytes: Uint8Array | null;
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const bg = opts.template.mimeType === "image/jpeg"
    ? await pdf.embedJpg(opts.template.imageBytes)
    : await pdf.embedPng(opts.template.imageBytes);
  const page = pdf.addPage([842, 595]);
  const W = 842, H = 595;
  page.drawImage(bg, { x: 0, y: 0, width: W, height: H });

  const font = await pdf.embedFont((StandardFonts as any)[opts.template.fontFamily] ?? StandardFonts.TimesRomanBold);
  const box = opts.template.nameBox;
  const x = box.x * W, yTop = box.y * H, w = box.width * W, h = box.height * H;
  let size = Math.min(44, h * 0.62);
  while (size > 7 && font.widthOfTextAtSize(opts.fullName, size) > w * 0.96) size -= 1;
  const textW = font.widthOfTextAtSize(opts.fullName, size);
  page.drawText(opts.fullName, { x: x + (w - textW) / 2, y: H - yTop - h / 2 - size / 3, size, font, color: rgb(0.1, 0.1, 0.1) });

  if (opts.signaturePngBytes) {
    try {
      const img = await pdf.embedPng(opts.signaturePngBytes);
      const sbox = opts.template.signatureBox;
      const sx = sbox.x * W, syTop = sbox.y * H, sw = sbox.width * W, sh = sbox.height * H;
      const ratio = Math.min(sw / img.width, sh / img.height);
      const iw = img.width * ratio, ih = img.height * ratio;
      page.drawImage(img, { x: sx + (sw - iw) / 2, y: H - syTop - sh + (sh - ih) / 2, width: iw, height: ih });
    } catch (e) { console.warn("falha ao embutir assinatura no modelo", e); }
  }

  return pdf.save();
}

async function buildCertificatePdf(opts: {
  fullName: string;
  cpf: string;
  leagueName: string;
  cycleName: string;
  totalHours: number;
  activities: Array<{ activity: string; date: string; hours: number; status: string }>;
  themeColor: string;
  signaturePngBytes: Uint8Array | null;
  presidentName: string;
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4 paisagem
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { r, g, b } = hexToRgb(opts.themeColor || "#1f5132");
  const theme = rgb(r, g, b);
  const themeDark = rgb(Math.max(0, r * 0.5), Math.max(0, g * 0.5), Math.max(0, b * 0.5));
  const ink = rgb(0.14, 0.16, 0.15);
  const muted = rgb(0.45, 0.48, 0.46);
  const hairline = rgb(0.82, 0.86, 0.83);
  const paper = rgb(1, 1, 1);

  const W = 842, H = 595;

  // Fundo branco limpo
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });

  // Barra lateral esquerda (tema da liga) — estilo cartão ligasuno
  const sideW = 14;
  page.drawRectangle({ x: 0, y: 0, width: sideW, height: H, color: theme });

  // Moldura sutil
  page.drawRectangle({
    x: 28, y: 28, width: W - 56, height: H - 56,
    borderColor: hairline, borderWidth: 0.8,
  });

  // Cabeçalho — marca
  const brand = "LIGASUNO";
  const brandSize = 9;
  page.drawText(brand, { x: 56, y: H - 56, size: brandSize, font: sansBold, color: themeDark });
  // ponto separador
  page.drawCircle({ x: 56 + sansBold.widthOfTextAtSize(brand, brandSize) + 8, y: H - 53, size: 1.6, color: theme });
  const leagueTag = opts.leagueName.toUpperCase();
  page.drawText(leagueTag, { x: 56 + sansBold.widthOfTextAtSize(brand, brandSize) + 16, y: H - 56, size: brandSize, font: sans, color: muted });

  // Ciclo no canto direito
  const cycle = opts.cycleName.toUpperCase();
  const cycleW = sans.widthOfTextAtSize(cycle, 9);
  page.drawText(cycle, { x: W - 56 - cycleW, y: H - 56, size: 9, font: sans, color: muted });

  // Linha fina sob o header
  page.drawLine({ start: { x: 56, y: H - 70 }, end: { x: W - 56, y: H - 70 }, thickness: 0.5, color: hairline });

  // Etiqueta
  const eyebrow = "CERTIFICADO DE PARTICIPAÇÃO";
  const eyebrowSize = 10;
  const eyebrowW = sansBold.widthOfTextAtSize(eyebrow, eyebrowSize);
  page.drawText(eyebrow, { x: W / 2 - eyebrowW / 2, y: H - 120, size: eyebrowSize, font: sansBold, color: theme });

  // Título principal — serifa elegante
  const title = "Participação acadêmica";
  const titleSize = 36;
  const titleW = serif.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: W / 2 - titleW / 2, y: H - 168, size: titleSize, font: serif, color: ink });

  // Filete curto
  page.drawLine({ start: { x: W / 2 - 24, y: H - 188 }, end: { x: W / 2 + 24, y: H - 188 }, thickness: 1, color: theme });

  // "Certificamos que"
  const intro = "Certificamos que";
  const introSize = 12;
  const introW = serifItalic.widthOfTextAtSize(intro, introSize);
  page.drawText(intro, { x: W / 2 - introW / 2, y: H - 220, size: introSize, font: serifItalic, color: muted });

  // Nome — destaque
  const nameSize = 32;
  const nameW = serifBold.widthOfTextAtSize(opts.fullName, nameSize);
  page.drawText(opts.fullName, { x: W / 2 - nameW / 2, y: H - 258, size: nameSize, font: serifBold, color: ink });

  // CPF discreto
  const cpfLine = `CPF ${opts.cpf || "—"}`;
  const cpfW = sans.widthOfTextAtSize(cpfLine, 9);
  page.drawText(cpfLine, { x: W / 2 - cpfW / 2, y: H - 276, size: 9, font: sans, color: muted });

  // Texto principal
  const body = `participou da ${opts.leagueName} durante ${opts.cycleName}, completando carga horária total de ${opts.totalHours.toFixed(1).replace(".", ",")} horas em atividades acadêmico-científicas, conforme registro oficial da liga.`;
  drawWrappedCentered(page, body, { x: 120, y: H - 310, width: W - 240, size: 12, font: serif, color: ink, lineHeight: 18 });

  // Bloco de carga horária — cartão minimal
  const cardW = 170, cardH = 78;
  const cardX = 60, cardY = 130;
  page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: theme });
  const hoursTxt = opts.totalHours.toFixed(1).replace(".", ",");
  const hoursSize = hoursTxt.length > 4 ? 32 : 40;
  const hoursW = serifBold.widthOfTextAtSize(hoursTxt, hoursSize);
  const hLabel = "horas certificadas";
  const hLabelW = sans.widthOfTextAtSize(hLabel, 9);
  page.drawText(hoursTxt, { x: cardX + cardW / 2 - hoursW / 2, y: cardY + cardH / 2 - 4, size: hoursSize, font: serifBold, color: rgb(1, 1, 1) });
  page.drawText(hLabel, { x: cardX + cardW / 2 - hLabelW / 2, y: cardY + 14, size: 9, font: sans, color: rgb(1, 1, 1) });

  // Lista de atividades à direita
  const present = opts.activities.filter((a) => a.status === "presente" && a.hours > 0);
  const listX = cardX + cardW + 30;
  const listTop = cardY + cardH - 4;
  page.drawText("ATIVIDADES REALIZADAS", { x: listX, y: listTop, size: 8, font: sansBold, color: themeDark });
  page.drawLine({ start: { x: listX, y: listTop - 4 }, end: { x: listX + 110, y: listTop - 4 }, thickness: 0.6, color: theme });

  let listY = listTop - 18;
  if (present.length === 0) {
    page.drawText("Sem atividades registradas no período.", { x: listX, y: listY, size: 9, font: serifItalic, color: muted });
  } else {
    const cols = 2;
    const colW = 250;
    const perCol = Math.ceil(present.length / cols);
    const lineH = 12;
    present.forEach((a, idx) => {
      const col = Math.floor(idx / perCol);
      const row = idx % perCol;
      const x = listX + col * colW;
      const y = listY - row * lineH;
      if (y < cardY - 6) return;
      const date = (() => { const [Y, M, D] = a.date.split("T")[0].split("-"); return `${D}/${M}/${Y.slice(2)}`; })();
      const hoursStr = `${a.hours.toFixed(1).replace(".", ",")}h`;
      const hoursStrW = sans.widthOfTextAtSize(hoursStr, 8.5);
      // marcador
      page.drawRectangle({ x: x, y: y + 3, width: 3, height: 3, color: theme });
      const left = `${date}  ${a.activity}`;
      const maxLeftW = colW - hoursStrW - 24;
      let leftTrim = left;
      while (serif.widthOfTextAtSize(leftTrim, 9) > maxLeftW && leftTrim.length > 4) leftTrim = leftTrim.slice(0, -1);
      if (leftTrim !== left) leftTrim = leftTrim.slice(0, -1) + "…";
      page.drawText(leftTrim, { x: x + 8, y, size: 9, font: serif, color: ink });
      page.drawText(hoursStr, { x: x + colW - hoursStrW - 10, y, size: 8.5, font: sansBold, color: themeDark });
    });
  }

  // Assinatura — direita, minimalista
  const sigRight = W - 60;
  const sigLineY = 130;
  const sigLineW = 220;
  if (opts.signaturePngBytes) {
    try {
      const img = await pdf.embedPng(opts.signaturePngBytes);
      const maxW = 180, maxH = 56;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      page.drawImage(img, { x: sigRight - sigLineW / 2 - w / 2, y: sigLineY + 6, width: w, height: h });
    } catch (e) {
      console.warn("falha ao embutir assinatura", e);
    }
  }
  page.drawLine({ start: { x: sigRight - sigLineW, y: sigLineY }, end: { x: sigRight, y: sigLineY }, thickness: 0.6, color: ink });
  const presLine = opts.presidentName || "Presidência";
  const presW = serifBold.widthOfTextAtSize(presLine, 11);
  page.drawText(presLine, { x: sigRight - sigLineW / 2 - presW / 2, y: sigLineY - 14, size: 11, font: serifBold, color: ink });
  const presSub = `Presidente · ${opts.leagueName}`;
  const presSubW = sans.widthOfTextAtSize(presSub, 8.5);
  page.drawText(presSub, { x: sigRight - sigLineW / 2 - presSubW / 2, y: sigLineY - 26, size: 8.5, font: sans, color: muted });

  // Rodapé
  const issued = `Emitido em ${new Date().toLocaleDateString("pt-BR")}`;
  page.drawText(issued, { x: 56, y: 46, size: 8, font: sans, color: muted });
  const foot = "Documento gerado por LIGASUNO · ligasuno.com.br";
  const footW = sans.widthOfTextAtSize(foot, 8);
  page.drawText(foot, { x: W - 56 - footW, y: 46, size: 8, font: sans, color: muted });

  return pdf.save();
}


function drawWrappedCentered(page: any, text: string, opts: { x: number; y: number; width: number; size: number; font: any; color: any; lineHeight: number }) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const tentative = cur ? cur + " " + w : w;
    if (opts.font.widthOfTextAtSize(tentative, opts.size) > opts.width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = tentative;
  }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => {
    const lw = opts.font.widthOfTextAtSize(ln, opts.size);
    page.drawText(ln, { x: opts.x + (opts.width - lw) / 2, y: opts.y - i * opts.lineHeight, size: opts.size, font: opts.font, color: opts.color });
  });
}

export const sendSemesterCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePresidentOrAdmin(context.supabase, data.league_id, context.userId);
    const admin = await adminClient();

    const { data: league } = await admin.from("leagues").select("id, name, slug, theme_color, president_id").eq("id", data.league_id).maybeSingle();
    if (!league) throw new Error("Liga não encontrada");

    const { data: sigRow } = await admin.from("league_president_signatures").select("signature_url, president_name").eq("league_id", data.league_id).maybeSingle();
    let presidentName = data.president_name || sigRow?.president_name || "";
    if (!presidentName) {
      const { data: presProf } = await admin.from("profiles").select("full_name, username").eq("id", league.president_id).maybeSingle();
      presidentName = (presProf?.full_name ?? presProf?.username ?? "Presidência") as string;
    }

    let signatureBytes: Uint8Array | null = null;
    if (sigRow?.signature_url) {
      try {
        const path = String(sigRow.signature_url);
        const { data: blob } = await admin.storage.from("league-signatures").download(path);
        if (blob) signatureBytes = new Uint8Array(await blob.arrayBuffer());
      } catch (e) { console.warn("falha ao baixar assinatura", e); }
    }

    const certificateTemplate = await loadCertificateTemplate(admin, data.league_id);

    // Ciclo atual (se houver) para nome do semestre
    const { data: cycle } = await admin.from("semester_cycles").select("semester, year").eq("league_id", data.league_id).eq("is_current", true).maybeSingle();
    const cycleName = cycle ? `${cycle.semester}º semestre de ${cycle.year}` : `semestre de ${new Date().getFullYear()}`;

    const { data: attendance } = await admin.from("league_attendance").select("user_id, activity, activity_date, status, hours").eq("league_id", data.league_id);
    const byUser = new Map<string, Array<any>>();
    (attendance ?? []).forEach((r: any) => {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id)!.push(r);
    });

    let sent = 0; const failures: Array<{ user_id: string; full_name: string; error: string }> = [];

    for (const rec of data.recipients) {
      const acts = (byUser.get(rec.user_id) ?? []).map((r) => ({ activity: r.activity, date: r.activity_date, hours: Number(r.hours) || 0, status: r.status }));
      const total = acts.filter((a) => a.status === "presente").reduce((s, a) => s + a.hours, 0);

      try {
        const { data: prof } = await admin.from("profiles").select("email").eq("id", rec.user_id).maybeSingle();
        const to = prof?.email as string | undefined;
        if (!to) throw new Error("E-mail não encontrado");

        const pdfBytes = certificateTemplate
          ? await buildTemplateCertificatePdf({ fullName: rec.full_name, template: certificateTemplate, signaturePngBytes: signatureBytes })
          : await buildCertificatePdf({
              fullName: rec.full_name,
              cpf: rec.cpf,
              leagueName: league.name,
              cycleName,
              totalHours: total,
              activities: acts,
              themeColor: league.theme_color || "#1f5132",
              signaturePngBytes: signatureBytes,
              presidentName,
            });

        const base64 = Buffer.from(pdfBytes).toString("base64");
        const { sendGmailWithAttachment, emailLayout } = await import("./gmail.server");
        const html = emailLayout({
          title: `Seu certificado da ${league.name}`,
          brandColor: league.theme_color || "#1f5132",
          leagueName: league.name,
          bodyHtml: `<p>Olá, <strong>${rec.full_name}</strong>!</p>
            <p>Segue em anexo seu certificado de participação na <strong>${league.name}</strong> referente a ${cycleName}, com carga horária total de <strong>${total.toFixed(1).replace(".", ",")}h</strong>.</p>
            <p>Guarde este documento — ele é seu comprovante oficial junto à liga.</p>`,
          signature: `— ${presidentName}, Presidente da ${league.name}`,
        });

        await sendGmailWithAttachment({
          to,
          subject: `Certificado — ${league.name} — ${cycleName}`,
          html,
          attachment: {
            filename: `certificado-${slugify(rec.full_name)}.pdf`,
            mimeType: "application/pdf",
            contentBase64: base64,
          },
        });

        await admin.from("certificate_email_log").insert({
          league_id: league.id, user_id: rec.user_id, email: to,
          full_name: rec.full_name, cpf: rec.cpf, total_hours: total, status: "sent",
        });
        sent++;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        failures.push({ user_id: rec.user_id, full_name: rec.full_name, error: msg });
        await admin.from("certificate_email_log").insert({
          league_id: league.id, user_id: rec.user_id, email: "",
          full_name: rec.full_name, cpf: rec.cpf, total_hours: 0, status: "error", error: msg,
        });
      }
    }

    return { sent, failed: failures.length, failures };
  });

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "certificado";
}

// ============== Assinatura ==============
const sigSchema = z.object({
  league_id: z.string().uuid(),
  png_base64: z.string().min(20),
  president_name: z.string().trim().min(2).max(120).optional(),
});

export const saveSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sigSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePresidentOrAdmin(context.supabase, data.league_id, context.userId);
    const admin = await adminClient();

    const cleanB64 = data.png_base64.replace(/^data:image\/png;base64,/, "");
    const bytes = Buffer.from(cleanB64, "base64");
    if (bytes.length === 0) throw new Error("Arquivo vazio");
    if (bytes.length > 1_000_000) throw new Error("Imagem muito grande (máx 1MB)");

    const path = `${data.league_id}/signature.png`;
    const { error: upErr } = await admin.storage.from("league-signatures").upload(path, bytes, { upsert: true, contentType: "image/png" });
    if (upErr) throw new Error(upErr.message);

    await admin.from("league_president_signatures").upsert({
      league_id: data.league_id, user_id: context.userId, signature_url: path,
      president_name: data.president_name ?? null,
    }, { onConflict: "league_id" });

    return { ok: true };
  });

export const getSignaturePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ league_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePresidentOrAdmin(context.supabase, data.league_id, context.userId);
    const admin = await adminClient();
    const { data: row } = await admin.from("league_president_signatures").select("signature_url, president_name").eq("league_id", data.league_id).maybeSingle();
    if (!row?.signature_url) return { png_base64: null, president_name: null };
    const { data: blob } = await admin.storage.from("league-signatures").download(row.signature_url);
    if (!blob) return { png_base64: null, president_name: row.president_name };
    const buf = Buffer.from(await blob.arrayBuffer()).toString("base64");
    return { png_base64: `data:image/png;base64,${buf}`, president_name: row.president_name };
  });

export const saveCertificateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePresidentOrAdmin(context.supabase, data.league_id, context.userId);
    const admin = await adminClient();
    let templateUrl: string | null = null;
    if (data.image_base64) {
      const match = data.image_base64.match(/^data:(image\/(png|jpeg));base64,(.+)$/);
      if (!match) throw new Error("Envie uma imagem PNG ou JPG do certificado.");
      const bytes = Buffer.from(match[3], "base64");
      if (bytes.length === 0) throw new Error("Imagem vazia");
      if (bytes.length > 4_000_000) throw new Error("Imagem muito grande (máx 4MB)");
      const ext = match[1] === "image/jpeg" ? "jpg" : "png";
      templateUrl = `${data.league_id}/certificate-template.${ext}`;
      const { error } = await admin.storage.from("league-signatures").upload(templateUrl, bytes, { upsert: true, contentType: match[1] });
      if (error) throw new Error(error.message);
    } else {
      const { data: existing } = await admin.from("league_certificate_templates").select("template_url").eq("league_id", data.league_id).maybeSingle();
      templateUrl = existing?.template_url ?? null;
    }
    if (!templateUrl) throw new Error("Envie a imagem do modelo de certificado.");
    await admin.from("league_certificate_templates").upsert({
      league_id: data.league_id,
      template_url: templateUrl,
      name_box: data.name_box,
      signature_box: data.signature_box,
      font_family: data.font_family,
    }, { onConflict: "league_id" });
    return { ok: true };
  });

export const getCertificateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ league_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePresidentOrAdmin(context.supabase, data.league_id, context.userId);
    const admin = await adminClient();
    const { data: row } = await admin.from("league_certificate_templates").select("*").eq("league_id", data.league_id).maybeSingle();
    if (!row?.template_url) return { template: null };
    const { data: blob } = await admin.storage.from("league-signatures").download(row.template_url);
    const mime = blob?.type || (String(row.template_url).toLowerCase().endsWith(".jpg") ? "image/jpeg" : "image/png");
    const base64 = blob ? `data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}` : null;
    return { template: { image_base64: base64, name_box: clampBox(row.name_box), signature_box: clampBox(row.signature_box), font_family: fontName(row.font_family) } };
  });
