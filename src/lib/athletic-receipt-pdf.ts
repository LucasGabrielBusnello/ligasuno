// Gera um recibo simples (A4) para pedidos/ingressos/associações da atlética.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReceiptItem = { description: string; quantity?: number; unit_price?: number; total: number };

export type ReceiptInput = {
  athleticName: string;
  primaryColor?: string;
  logoUrl?: string | null;
  title: string; // "Recibo de compra" / "Recibo de ingresso" / "Recibo de associação"
  receiptNumber: string;
  issuedAt: string; // ISO
  paymentMethod?: string | null;
  buyer: { name?: string | null; email?: string | null; cpf?: string | null; phone?: string | null };
  items: ReceiptItem[];
  total: number;
  footerNote?: string;
};

function hexToRgb01(hex: string): [number, number, number] {
  const h = (hex ?? "#1f5132").replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(s.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function generateReceiptPdf(input: ReceiptInput): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const [pr, pg, pb] = hexToRgb01(input.primaryColor ?? "#1f5132");

  // Header band
  page.drawRectangle({ x: 0, y: 781, width: 595.28, height: 60, color: rgb(pr, pg, pb) });
  let logoImg: any = null;
  if (input.logoUrl) {
    const bytes = await fetchBytes(input.logoUrl);
    if (bytes) {
      try {
        logoImg = await pdf.embedPng(bytes);
      } catch {
        try { logoImg = await pdf.embedJpg(bytes); } catch {}
      }
    }
  }
  if (logoImg) {
    const s = 40;
    page.drawImage(logoImg, { x: 30, y: 791, width: s, height: s });
    page.drawText(input.athleticName, { x: 80, y: 810, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText(input.title, { x: 80, y: 794, size: 10, font: reg, color: rgb(1, 1, 1) });
  } else {
    page.drawText(input.athleticName, { x: 30, y: 812, size: 18, font: bold, color: rgb(1, 1, 1) });
    page.drawText(input.title, { x: 30, y: 794, size: 11, font: reg, color: rgb(1, 1, 1) });
  }
  page.drawText(`Nº ${input.receiptNumber}`, { x: 430, y: 812, size: 10, font: bold, color: rgb(1, 1, 1) });
  page.drawText(new Date(input.issuedAt).toLocaleString("pt-BR"), { x: 430, y: 796, size: 9, font: reg, color: rgb(1, 1, 1) });

  let y = 750;
  page.drawText("Comprador", { x: 30, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 16;
  const buyerLines = [
    input.buyer.name ? `Nome: ${input.buyer.name}` : null,
    input.buyer.email ? `E-mail: ${input.buyer.email}` : null,
    input.buyer.cpf ? `CPF: ${input.buyer.cpf}` : null,
    input.buyer.phone ? `Telefone: ${input.buyer.phone}` : null,
  ].filter(Boolean) as string[];
  for (const l of buyerLines) {
    page.drawText(l, { x: 30, y, size: 10, font: reg, color: rgb(0.15, 0.15, 0.15) });
    y -= 14;
  }
  y -= 8;
  if (input.paymentMethod) {
    page.drawText(`Forma de pagamento: ${input.paymentMethod}`, { x: 30, y, size: 10, font: bold, color: rgb(pr, pg, pb) });
    y -= 20;
  }

  // Table
  page.drawRectangle({ x: 30, y: y - 4, width: 535, height: 22, color: rgb(0.94, 0.94, 0.94) });
  page.drawText("Descrição", { x: 40, y: y + 3, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Qtd", { x: 380, y: y + 3, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Unit.", { x: 430, y: y + 3, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Total", { x: 500, y: y + 3, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 22;

  for (const it of input.items) {
    const desc = it.description.length > 55 ? it.description.slice(0, 54) + "…" : it.description;
    page.drawText(desc, { x: 40, y: y + 3, size: 10, font: reg, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(String(it.quantity ?? 1), { x: 380, y: y + 3, size: 10, font: reg, color: rgb(0.15, 0.15, 0.15) });
    if (typeof it.unit_price === "number")
      page.drawText(`R$ ${it.unit_price.toFixed(2)}`, { x: 430, y: y + 3, size: 10, font: reg, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`R$ ${it.total.toFixed(2)}`, { x: 500, y: y + 3, size: 10, font: reg, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
    if (y < 120) break;
  }

  y -= 10;
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(pr, pg, pb) });
  y -= 22;
  page.drawText("Total pago", { x: 380, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`R$ ${input.total.toFixed(2)}`, { x: 490, y, size: 14, font: bold, color: rgb(pr, pg, pb) });

  const note = input.footerNote ?? "Documento não fiscal — comprovante interno emitido pela atlética.";
  page.drawText(note, { x: 30, y: 50, size: 9, font: reg, color: rgb(0.4, 0.4, 0.4) });

  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
