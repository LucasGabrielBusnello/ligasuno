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
  const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4 paisagem
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { r, g, b } = hexToRgb(opts.themeColor || "#1f5132");
  const theme = rgb(r, g, b);
  // Tom mais escuro para acentos profundos
  const themeDark = rgb(Math.max(0, r * 0.55), Math.max(0, g * 0.55), Math.max(0, b * 0.55));
  // Tom claro para fundos sutis
  const themeSoft = rgb(r + (1 - r) * 0.92, g + (1 - g) * 0.92, b + (1 - b) * 0.92);
  const ink = rgb(0.12, 0.12, 0.14);
  const muted = rgb(0.42, 0.42, 0.46);
  const paper = rgb(0.992, 0.988, 0.976); // creme suave

  const W = 842, H = 595;

  // Fundo creme
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper });

  // Faixa diagonal decorativa sutil no canto superior direito
  page.drawRectangle({ x: W - 220, y: H - 30, width: 260, height: 60, color: theme, rotate: degrees(-12), opacity: 0.08 });
  page.drawRectangle({ x: -40, y: 10, width: 260, height: 60, color: theme, rotate: degrees(-12), opacity: 0.08 });

  // Moldura dupla
  const margin = 24;
  page.drawRectangle({ x: margin, y: margin, width: W - margin * 2, height: H - margin * 2, borderColor: theme, borderWidth: 2 });
  page.drawRectangle({ x: margin + 6, y: margin + 6, width: W - (margin + 6) * 2, height: H - (margin + 6) * 2, borderColor: theme, borderWidth: 0.5, opacity: 0.6 });

  // Ornamentos nos cantos (pequenos quadrados rotacionados = losangos)
  const cornerDiamond = (cx: number, cy: number) => {
    page.drawRectangle({ x: cx - 4, y: cy - 4, width: 8, height: 8, color: theme, rotate: degrees(45) });
    page.drawRectangle({ x: cx - 9, y: cy - 9, width: 18, height: 18, borderColor: theme, borderWidth: 0.7, rotate: degrees(45), opacity: 0.6 });
  };
  cornerDiamond(margin + 6, H - margin - 6);
  cornerDiamond(W - margin - 6, H - margin - 6);
  cornerDiamond(margin + 6, margin + 6);
  cornerDiamond(W - margin - 6, margin + 6);

  // Cabeçalho com filete e pequenas estrelas
  const headerY = H - 80;
  const drawStar = (cx: number, cy: number, size: number, color: any) => {
    // estrela simples 4 pontas usando dois losangos
    page.drawRectangle({ x: cx - size / 2, y: cy - size / 2, width: size, height: size, color, rotate: degrees(45) });
    page.drawRectangle({ x: cx - size / 4, y: cy - size * 0.9, width: size / 2, height: size * 1.8, color, opacity: 0.0 });
  };
  // Linha ornamental ao redor do título
  const lineY = headerY + 4;
  page.drawLine({ start: { x: 110, y: lineY }, end: { x: 320, y: lineY }, thickness: 0.7, color: theme });
  page.drawLine({ start: { x: W - 320, y: lineY }, end: { x: W - 110, y: lineY }, thickness: 0.7, color: theme });
  drawStar(105, lineY, 5, theme);
  drawStar(W - 105, lineY, 5, theme);
  drawStar(325, lineY, 4, theme);
  drawStar(W - 325, lineY, 4, theme);

  // Subtítulo da liga (acima do título)
  const upper = opts.leagueName.toUpperCase();
  const upperW = sansBold.widthOfTextAtSize(upper, 10);
  page.drawText(upper, { x: W / 2 - upperW / 2, y: H - 60, size: 10, font: sansBold, color: themeDark, characterSpacing: 4 });

  // Título principal — serifa, em maiúsculas espaçadas
  const title = "CERTIFICADO";
  const titleSize = 42;
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: W / 2 - titleW / 2, y: headerY - 38, size: titleSize, font: bold, color: themeDark, characterSpacing: 6 });

  // Filete decorativo abaixo do título
  page.drawLine({ start: { x: W / 2 - 70, y: headerY - 50 }, end: { x: W / 2 + 70, y: headerY - 50 }, thickness: 1.2, color: theme });
  page.drawRectangle({ x: W / 2 - 3, y: headerY - 54, width: 6, height: 6, color: theme, rotate: degrees(45) });

  // Subtítulo "DE PARTICIPAÇÃO"
  const sub = "DE PARTICIPAÇÃO";
  const subW = sans.widthOfTextAtSize(sub, 11);
  page.drawText(sub, { x: W / 2 - subW / 2, y: headerY - 72, size: 11, font: sans, color: muted, characterSpacing: 6 });

  // "Certificamos que"
  const intro = "Certificamos que";
  const introSize = 13;
  const introW = italic.widthOfTextAtSize(intro, introSize);
  page.drawText(intro, { x: W / 2 - introW / 2, y: 400, size: introSize, font: italic, color: muted });

  // Nome — destaque
  const nameSize = 34;
  const nameW = bold.widthOfTextAtSize(opts.fullName, nameSize);
  page.drawText(opts.fullName, { x: W / 2 - nameW / 2, y: 360, size: nameSize, font: bold, color: ink });
  // Sublinhado decorativo do nome
  page.drawLine({ start: { x: W / 2 - Math.max(140, nameW / 2 + 20), y: 352 }, end: { x: W / 2 + Math.max(140, nameW / 2 + 20), y: 352 }, thickness: 0.6, color: theme, opacity: 0.6 });

  // CPF discreto
  const cpfLine = `CPF ${opts.cpf || "—"}`;
  const cpfW = sans.widthOfTextAtSize(cpfLine, 10);
  page.drawText(cpfLine, { x: W / 2 - cpfW / 2, y: 336, size: 10, font: sans, color: muted, characterSpacing: 1 });

  // Texto principal
  const body = `participou da ${opts.leagueName} durante ${opts.cycleName}, completando carga horária total de ${opts.totalHours.toFixed(1).replace(".", ",")} horas em atividades acadêmico-científicas, conforme registro oficial da liga.`;
  drawWrappedCentered(page, body, { x: 110, y: 306, width: W - 220, size: 12.5, font, color: ink, lineHeight: 18 });

  // Medalhão lateral esquerdo com horas
  const medCx = 105, medCy = 230, medR = 46;
  // círculo externo cheio
  page.drawCircle({ x: medCx, y: medCy, size: medR, color: theme });
  // círculo interno (creme)
  page.drawCircle({ x: medCx, y: medCy, size: medR - 6, color: paper });
  // anel fino
  page.drawCircle({ x: medCx, y: medCy, size: medR - 6, borderColor: theme, borderWidth: 0.8 });
  // raio de "fitas" pequenos atrás do medalhão
  page.drawRectangle({ x: medCx - 14, y: medCy - medR - 22, width: 12, height: 26, color: theme });
  page.drawRectangle({ x: medCx + 2, y: medCy - medR - 22, width: 12, height: 26, color: themeDark });
  // Conteúdo do medalhão
  const hoursTxt = opts.totalHours.toFixed(1).replace(".", ",");
  const hoursSize = hoursTxt.length > 4 ? 18 : 22;
  const hoursW = bold.widthOfTextAtSize(hoursTxt, hoursSize);
  page.drawText(hoursTxt, { x: medCx - hoursW / 2, y: medCy - 2, size: hoursSize, font: bold, color: themeDark });
  const hLabel = "HORAS";
  const hLabelW = sansBold.widthOfTextAtSize(hLabel, 8);
  page.drawText(hLabel, { x: medCx - hLabelW / 2, y: medCy - 18, size: 8, font: sansBold, color: themeDark, characterSpacing: 2 });
  const hTop = "CARGA";
  const hTopW = sansBold.widthOfTextAtSize(hTop, 7);
  page.drawText(hTop, { x: medCx - hTopW / 2, y: medCy + 20, size: 7, font: sansBold, color: themeDark, characterSpacing: 2 });

  // Lista de atividades à direita do medalhão
  const present = opts.activities.filter((a) => a.status === "presente" && a.hours > 0);
  const listX = 180;
  let listY = 270;
  const listTitle = "Atividades realizadas";
  page.drawText(listTitle, { x: listX, y: listY, size: 10, font: sansBold, color: themeDark, characterSpacing: 1 });
  page.drawLine({ start: { x: listX, y: listY - 3 }, end: { x: listX + sansBold.widthOfTextAtSize(listTitle, 10), y: listY - 3 }, thickness: 0.6, color: theme });
  listY -= 16;
  if (present.length === 0) {
    page.drawText("—", { x: listX, y: listY, size: 9, font, color: muted });
  } else {
    const cols = 2;
    const colW = 290;
    const perCol = Math.ceil(present.length / cols);
    present.forEach((a, idx) => {
      const col = Math.floor(idx / perCol);
      const row = idx % perCol;
      const x = listX + col * colW;
      const y = listY - row * 12;
      if (y < 140) return;
      const date = (() => { const [Y, M, D] = a.date.split("T")[0].split("-"); return `${D}/${M}/${Y.slice(2)}`; })();
      // bullet losango
      page.drawRectangle({ x: x - 2, y: y + 3, width: 4, height: 4, color: theme, rotate: degrees(45) });
      const hoursStr = `(${a.hours.toFixed(1).replace(".", ",")}h)`;
      const left = `${date}  ${a.activity}`;
      const maxLeftW = colW - 50;
      let leftTrim = left;
      while (font.widthOfTextAtSize(leftTrim, 8.5) > maxLeftW && leftTrim.length > 4) leftTrim = leftTrim.slice(0, -1);
      if (leftTrim !== left) leftTrim = leftTrim.slice(0, -1) + "…";
      page.drawText(leftTrim, { x: x + 8, y, size: 8.5, font, color: ink });
      page.drawText(hoursStr, { x: x + colW - 40 - font.widthOfTextAtSize(hoursStr, 8) + 38, y, size: 8, font: italic, color: themeDark });
    });
  }

  // Assinatura
  const sigCx = W / 2;
  const sigBaseY = 110;
  if (opts.signaturePngBytes) {
    try {
      const img = await pdf.embedPng(opts.signaturePngBytes);
      const maxW = 220, maxH = 70;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      page.drawImage(img, { x: sigCx - w / 2, y: sigBaseY + 6, width: w, height: h });
    } catch (e) {
      console.warn("falha ao embutir assinatura", e);
    }
  }
  // Linha de assinatura com pequenos diamantes nas pontas
  page.drawLine({ start: { x: sigCx - 140, y: sigBaseY }, end: { x: sigCx + 140, y: sigBaseY }, thickness: 0.8, color: ink });
  page.drawRectangle({ x: sigCx - 143, y: sigBaseY - 3, width: 6, height: 6, color: theme, rotate: degrees(45) });
  page.drawRectangle({ x: sigCx + 137, y: sigBaseY - 3, width: 6, height: 6, color: theme, rotate: degrees(45) });

  const presLine = opts.presidentName || "Presidência";
  const presW = bold.widthOfTextAtSize(presLine, 12);
  page.drawText(presLine, { x: sigCx - presW / 2, y: sigBaseY - 16, size: 12, font: bold, color: ink });
  const presSub = `Presidente da ${opts.leagueName}`;
  const presSubW = italic.widthOfTextAtSize(presSub, 9.5);
  page.drawText(presSub, { x: sigCx - presSubW / 2, y: sigBaseY - 30, size: 9.5, font: italic, color: muted });

  // Selo no canto inferior direito
  const sealCx = W - 110, sealCy = 120;
  page.drawCircle({ x: sealCx, y: sealCy, size: 36, borderColor: theme, borderWidth: 1.2 });
  page.drawCircle({ x: sealCx, y: sealCy, size: 30, borderColor: theme, borderWidth: 0.4, opacity: 0.6 });
  // estrelinhas ao redor
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const px = sealCx + Math.cos(ang) * 33;
    const py = sealCy + Math.sin(ang) * 33;
    page.drawRectangle({ x: px - 1.5, y: py - 1.5, width: 3, height: 3, color: theme, rotate: degrees(45) });
  }
  page.drawText("LIGA", { x: sealCx - sans.widthOfTextAtSize("LIGA", 7) / 2, y: sealCy + 6, size: 7, font: sansBold, color: themeDark, characterSpacing: 2 });
  page.drawText("OFICIAL", { x: sealCx - sans.widthOfTextAtSize("OFICIAL", 8) / 2, y: sealCy - 4, size: 8, font: sansBold, color: themeDark, characterSpacing: 1 });
  const yearStr = String(new Date().getFullYear());
  page.drawText(yearStr, { x: sealCx - sans.widthOfTextAtSize(yearStr, 7) / 2, y: sealCy - 14, size: 7, font: sans, color: muted, characterSpacing: 2 });

  // Rodapé
  const issued = `Emitido em ${new Date().toLocaleDateString("pt-BR")}  ·  Documento gerado por LIGASUNO`;
  const issuedW = italic.widthOfTextAtSize(issued, 8);
  page.drawText(issued, { x: W / 2 - issuedW / 2, y: 42, size: 8, font: italic, color: muted });

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

        const pdfBytes = await buildCertificatePdf({
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
