// Generates a yearly cash report PDF for a league's Caixa.
import type { PDFFont, PDFPage, RGB } from "pdf-lib";

export type ReportTxn = {
  id: string;
  kind: "entrada" | "saida";
  amount_cents: number;
  category: string;
  description: string;
  occurred_at: string;
  source: "manual" | "site";
  detail?: any;
  groupKey?: string;
  groupLabel?: string;
};

const BRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function hexToRgb(hex: string, rgb: (r: number, g: number, b: number) => RGB): RGB {
  const h = (hex || "#1f5132").replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v.slice(0, 6) || "1f5132", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function truncate(font: PDFFont, text: string, size: number, maxWidth: number) {
  let t = text;
  while (font.widthOfTextAtSize(t, size) > maxWidth && t.length > 3) t = t.slice(0, -1);
  return t === text ? t : t + "…";
}

export async function generateCashReportPdf(opts: {
  leagueName: string;
  presidentName: string;
  themeColor?: string;
  year: number;
  txns: ReportTxn[];
}): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const theme = hexToRgb(opts.themeColor || "#1f5132", rgb);
  const gray = rgb(0.45, 0.45, 0.45);
  const dark = rgb(0.12, 0.12, 0.12);
  const green = rgb(0.09, 0.55, 0.28);
  const red = rgb(0.78, 0.15, 0.15);
  const lightBg = rgb(0.97, 0.97, 0.97);

  const PW = 595, PH = 842;
  const margin = 40;
  let page: PDFPage = pdf.addPage([PW, PH]);
  let y = PH - margin;

  const ensure = (need: number) => {
    if (y - need < margin) {
      page = pdf.addPage([PW, PH]);
      y = PH - margin;
    }
  };

  // ===== Header
  page.drawRectangle({ x: 0, y: PH - 110, width: PW, height: 110, color: theme });
  page.drawText("Relatório Financeiro Anual", { x: margin, y: PH - 50, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(opts.leagueName, { x: margin, y: PH - 72, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Presidente: ${opts.presidentName || "—"}`, { x: margin, y: PH - 90, size: 10, font: helv, color: rgb(1, 1, 1) });
  page.drawText(`Ano de referência: ${opts.year}`, { x: PW - margin - 160, y: PH - 90, size: 10, font: helv, color: rgb(1, 1, 1) });
  y = PH - 130;

  // ===== Summary cards
  const totalIn = opts.txns.filter((t) => t.kind === "entrada").reduce((s, t) => s + t.amount_cents, 0);
  const totalOut = opts.txns.filter((t) => t.kind === "saida").reduce((s, t) => s + t.amount_cents, 0);
  const balance = totalIn - totalOut;

  const cardW = (PW - margin * 2 - 20) / 3;
  const cardH = 60;
  const drawCard = (i: number, label: string, value: string, color: RGB) => {
    const x = margin + i * (cardW + 10);
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: lightBg, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });
    page.drawText(label, { x: x + 10, y: y - 18, size: 9, font: helv, color: gray });
    page.drawText(value, { x: x + 10, y: y - 42, size: 16, font: bold, color });
  };
  drawCard(0, "Entradas", BRL(totalIn), green);
  drawCard(1, "Saídas", BRL(totalOut), red);
  drawCard(2, "Saldo", BRL(balance), balance < 0 ? red : theme);
  y -= cardH + 20;

  const genDate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  page.drawText(`Gerado em ${genDate}`, { x: margin, y: y, size: 9, font: helv, color: gray });
  y -= 20;

  // ===== Grouping
  const groups = new Map<string, { label: string; kind: "entrada" | "saida"; count: number; total: number }>();
  for (const t of opts.txns) {
    const key = t.groupKey || `${t.kind}:${t.description}`;
    const label = t.groupLabel || t.description;
    const g = groups.get(key);
    if (g) { g.count += 1; g.total += t.amount_cents; }
    else groups.set(key, { label, kind: t.kind, count: 1, total: t.amount_cents });
  }
  const groupArr = Array.from(groups.values()).sort((a, b) => b.total - a.total);

  ensure(30);
  page.drawText("Resumo por categoria", { x: margin, y, size: 13, font: bold, color: dark });
  y -= 6;
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: PW - margin, y: y - 2 }, color: theme, thickness: 1.2 });
  y -= 18;

  // Table header
  const col1 = margin;
  const col2 = PW - margin - 180;
  const col3 = PW - margin - 90;
  const col4 = PW - margin;
  ensure(20);
  page.drawText("Descrição", { x: col1, y, size: 9, font: bold, color: gray });
  page.drawText("Qtd.", { x: col2, y, size: 9, font: bold, color: gray });
  page.drawText("Total", { x: col4 - 60, y, size: 9, font: bold, color: gray });
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, color: rgb(0.85, 0.85, 0.85), thickness: 0.5 });
  y -= 12;

  for (const g of groupArr) {
    ensure(18);
    const label = truncate(helv, g.label, 10, col2 - col1 - 8);
    page.drawText(label, { x: col1, y, size: 10, font: helv, color: dark });
    page.drawText(String(g.count), { x: col2, y, size: 10, font: helv, color: dark });
    const amt = (g.kind === "entrada" ? "+ " : "− ") + BRL(g.total);
    const w = bold.widthOfTextAtSize(amt, 10);
    page.drawText(amt, { x: col4 - w, y, size: 10, font: bold, color: g.kind === "entrada" ? green : red });
    y -= 16;
  }

  y -= 10;
  ensure(24);
  page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, color: theme, thickness: 0.8 });
  y -= 16;
  const balTxt = `Saldo líquido do ano: ${BRL(balance)}`;
  const balW = bold.widthOfTextAtSize(balTxt, 12);
  page.drawText(balTxt, { x: PW - margin - balW, y, size: 12, font: bold, color: balance < 0 ? red : theme });
  y -= 30;

  // ===== Full history
  ensure(30);
  page.drawText("Histórico completo de transações", { x: margin, y, size: 13, font: bold, color: dark });
  y -= 6;
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: PW - margin, y: y - 2 }, color: theme, thickness: 1.2 });
  y -= 18;

  ensure(16);
  page.drawText("Data", { x: margin, y, size: 9, font: bold, color: gray });
  page.drawText("Descrição", { x: margin + 70, y, size: 9, font: bold, color: gray });
  page.drawText("Valor", { x: PW - margin - 70, y, size: 9, font: bold, color: gray });
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, color: rgb(0.85, 0.85, 0.85), thickness: 0.5 });
  y -= 12;

  const sorted = [...opts.txns].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  for (const t of sorted) {
    ensure(16);
    const d = new Date(t.occurred_at + "T12:00").toLocaleDateString("pt-BR");
    page.drawText(d, { x: margin, y, size: 9, font: helv, color: dark });
    const desc = truncate(helv, t.description, 9, PW - margin - 70 - (margin + 70) - 8);
    page.drawText(desc, { x: margin + 70, y, size: 9, font: helv, color: dark });
    const amt = (t.kind === "entrada" ? "+ " : "− ") + BRL(t.amount_cents);
    const w = bold.widthOfTextAtSize(amt, 9);
    page.drawText(amt, { x: PW - margin - w, y, size: 9, font: bold, color: t.kind === "entrada" ? green : red });
    y -= 14;
  }

  // ===== Footer page numbers
  const pages = pdf.getPages();
  pages.forEach((p, idx) => {
    const txt = `Página ${idx + 1} de ${pages.length}`;
    const w = helv.widthOfTextAtSize(txt, 8);
    p.drawText(txt, { x: (PW - w) / 2, y: 20, size: 8, font: helv, color: gray });
  });

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
