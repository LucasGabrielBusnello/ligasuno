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
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4 paisagem
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const { r, g, b } = hexToRgb(opts.themeColor || "#1f5132");
  const themeRgb = rgb(r, g, b);
  const ink = rgb(0.08, 0.08, 0.08);
  const muted = rgb(0.35, 0.35, 0.35);

  // Borda decorativa
  page.drawRectangle({ x: 18, y: 18, width: 806, height: 559, borderColor: themeRgb, borderWidth: 3 });
  page.drawRectangle({ x: 26, y: 26, width: 790, height: 543, borderColor: themeRgb, borderWidth: 0.5, opacity: 0.5 });
  page.drawRectangle({ x: 0, y: 540, width: 842, height: 55, color: themeRgb });

  page.drawText("CERTIFICADO", { x: 42, y: 558, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(opts.leagueName.toUpperCase(), { x: 42, y: 545, size: 10, font, color: rgb(1, 1, 1) });

  // Título central
  page.drawText("Certificamos que", { x: 421 - font.widthOfTextAtSize("Certificamos que", 14) / 2, y: 470, size: 14, font, color: muted });
  const nameSize = 28;
  const nameW = bold.widthOfTextAtSize(opts.fullName, nameSize);
  page.drawText(opts.fullName, { x: 421 - nameW / 2, y: 425, size: nameSize, font: bold, color: ink });

  const cpfLine = `CPF ${opts.cpf || "—"}`;
  page.drawText(cpfLine, { x: 421 - font.widthOfTextAtSize(cpfLine, 11) / 2, y: 405, size: 11, font, color: muted });

  // Texto principal
  const body = `participou da ${opts.leagueName} durante ${opts.cycleName}, completando carga horária total de ${opts.totalHours.toFixed(1).replace(".", ",")} horas em atividades acadêmicas.`;
  drawWrappedCentered(page, body, { x: 60, y: 370, width: 722, size: 13, font, color: ink, lineHeight: 18 });

  // Lista de atividades (apenas com horas > 0 e status presente)
  const present = opts.activities.filter((a) => a.status === "presente" && a.hours > 0);
  let listY = 290;
  if (present.length > 0) {
    page.drawText("Atividades realizadas", { x: 60, y: listY, size: 10, font: bold, color: themeRgb });
    listY -= 14;
    const cols = 2;
    const colW = 360;
    const perCol = Math.ceil(present.length / cols);
    present.forEach((a, idx) => {
      const col = Math.floor(idx / perCol);
      const row = idx % perCol;
      const x = 60 + col * colW;
      const y = listY - row * 12;
      if (y < 130) return;
      const date = (() => { const [Y, M, D] = a.date.split("T")[0].split("-"); return `${D}/${M}/${Y.slice(2)}`; })();
      const txt = `• ${date} — ${a.activity}  (${a.hours.toFixed(1).replace(".", ",")}h)`;
      const trimmed = txt.length > 60 ? txt.slice(0, 57) + "..." : txt;
      page.drawText(trimmed, { x, y, size: 8.5, font, color: ink });
    });
  }

  // Assinatura
  const sigCx = 421;
  const sigBaseY = 95;
  if (opts.signaturePngBytes) {
    try {
      const img = await pdf.embedPng(opts.signaturePngBytes);
      const maxW = 220, maxH = 70;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      page.drawImage(img, { x: sigCx - w / 2, y: sigBaseY + 8, width: w, height: h });
    } catch (e) {
      console.warn("falha ao embutir assinatura", e);
    }
  }
  page.drawLine({ start: { x: sigCx - 130, y: sigBaseY }, end: { x: sigCx + 130, y: sigBaseY }, thickness: 0.8, color: ink });
  const presLine = opts.presidentName || "Presidência";
  page.drawText(presLine, { x: sigCx - font.widthOfTextAtSize(presLine, 11) / 2, y: sigBaseY - 14, size: 11, font: bold, color: ink });
  const presSub = `Presidente da ${opts.leagueName}`;
  page.drawText(presSub, { x: sigCx - font.widthOfTextAtSize(presSub, 9) / 2, y: sigBaseY - 26, size: 9, font, color: muted });

  // Rodapé
  const issued = `Emitido em ${new Date().toLocaleDateString("pt-BR")} via LIGASUNO`;
  page.drawText(issued, { x: 421 - italic.widthOfTextAtSize(issued, 8) / 2, y: 38, size: 8, font: italic, color: muted });

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
    const { data: cycle } = await admin.from("semester_cycles").select("name, label").eq("league_id", data.league_id).eq("is_current", true).maybeSingle();
    const cycleName = (cycle?.label || cycle?.name || `semestre de ${new Date().getFullYear()}`) as string;

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
