// Gera PDF A4 com 4 ingressos por página (retrato) para recorte, contendo QR + código.
// Client-side apenas.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export type TicketPdfInput = {
  eventTitle: string;
  athleticName: string;
  location?: string | null;
  startsAt?: string | null;
  primaryColor?: string; // hex
  logoUrl?: string | null;
  tickets: { code: string }[];
};

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(s.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

async function fetchAsBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

export async function generateTicketsPdf(input: TicketPdfInput): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
  const [pR, pG, pB] = hexToRgb01(input.primaryColor ?? "#F97316");

  // Logo (opcional)
  let logo: any = null;
  if (input.logoUrl) {
    const bytes = await fetchAsBytes(input.logoUrl);
    if (bytes) {
      try {
        if (input.logoUrl.toLowerCase().includes(".png") || input.logoUrl.toLowerCase().includes("webp")) {
          logo = await pdf.embedPng(bytes).catch(async () => await pdf.embedJpg(bytes));
        } else {
          logo = await pdf.embedJpg(bytes).catch(async () => await pdf.embedPng(bytes));
        }
      } catch { logo = null; }
    }
  }

  const A4 = { w: 595.28, h: 841.89 };
  const perPage = 4;
  const ticketH = (A4.h - 40) / perPage;
  const ticketW = A4.w - 40;

  for (let i = 0; i < input.tickets.length; i += perPage) {
    const page = pdf.addPage([A4.w, A4.h]);
    const slice = input.tickets.slice(i, i + perPage);
    for (let j = 0; j < slice.length; j++) {
      const t = slice[j];
      const y = A4.h - 20 - (j + 1) * ticketH;

      // Faixa lateral com cor primária
      page.drawRectangle({
        x: 20, y, width: 100, height: ticketH - 6,
        color: rgb(pR, pG, pB),
      });
      // Fundo do ingresso
      page.drawRectangle({
        x: 120, y, width: ticketW - 100, height: ticketH - 6,
        borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 1, color: rgb(1, 1, 1),
      });

      // "INGRESSO" vertical na faixa
      page.drawText("INGRESSO", {
        x: 42, y: y + 30, size: 14, font, color: rgb(1, 1, 1),
        rotate: { type: "degrees", angle: 90 } as any,
      });
      page.drawText(input.athleticName.toUpperCase().slice(0, 24), {
        x: 68, y: y + 30, size: 8, font: fontReg, color: rgb(1, 1, 1),
        rotate: { type: "degrees", angle: 90 } as any,
      });

      // Logo na parte de cima do ingresso
      if (logo) {
        const targetH = 40;
        const scale = targetH / logo.height;
        page.drawImage(logo, {
          x: 135, y: y + ticketH - 55,
          width: logo.width * scale, height: targetH,
        });
      }

      // Título do evento
      page.drawText(input.eventTitle.slice(0, 60), {
        x: 135, y: y + ticketH - 80, size: 16, font, color: rgb(0, 0, 0),
      });
      if (input.startsAt) {
        page.drawText(new Date(input.startsAt).toLocaleString("pt-BR"), {
          x: 135, y: y + ticketH - 100, size: 9, font: fontReg, color: rgb(0.3, 0.3, 0.3),
        });
      }
      if (input.location) {
        page.drawText(input.location.slice(0, 60), {
          x: 135, y: y + ticketH - 115, size: 9, font: fontReg, color: rgb(0.3, 0.3, 0.3),
        });
      }

      // Código
      page.drawText("CÓDIGO", { x: 135, y: y + 30, size: 7, font: fontReg, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(t.code, { x: 135, y: y + 15, size: 14, font, color: rgb(0, 0, 0) });

      // QR na direita
      try {
        const qrDataUrl = await QRCode.toDataURL(t.code, { margin: 1, width: 240 });
        const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
        const qrImg = await pdf.embedPng(qrBytes);
        const size = 100;
        page.drawImage(qrImg, {
          x: A4.w - 20 - size - 15, y: y + (ticketH - 6 - size) / 2,
          width: size, height: size,
        });
      } catch { /* ignora */ }

      // Linha tracejada de recorte
      if (j < slice.length - 1) {
        const yCut = y - 3;
        for (let x = 20; x < A4.w - 20; x += 6) {
          page.drawLine({
            start: { x, y: yCut }, end: { x: x + 3, y: yCut },
            thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
          });
        }
      }
    }
  }

  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}
