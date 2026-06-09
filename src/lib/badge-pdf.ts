// Badge PDF generator — client-side.
// Generates a multi-page PDF with one badge per registrant including QR code + name + checkin_code.
import QRCode from "qrcode";

export async function generateBadgesPdf(opts: {
  eventTitle: string;
  leagueName: string;
  themeColor?: string;
  rows: Array<{ full_name: string; checkin_code: string; email?: string }>;
}): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const hex = (opts.themeColor || "#1f5132").replace("#", "");
  const v = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
  const n = parseInt(v.slice(0, 6) || "1f5132", 16);
  const theme = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);

  // A4 portrait, 2 columns × 4 rows = 8 badges per page
  const PW = 595, PH = 842;
  const cols = 2, rows = 4;
  const margin = 24;
  const cellW = (PW - margin * 2) / cols;
  const cellH = (PH - margin * 2) / rows;

  for (let i = 0; i < opts.rows.length; i += cols * rows) {
    const page = pdf.addPage([PW, PH]);
    const slice = opts.rows.slice(i, i + cols * rows);
    for (let j = 0; j < slice.length; j++) {
      const r = slice[j];
      const col = j % cols;
      const row = Math.floor(j / cols);
      const x = margin + col * cellW;
      const y = PH - margin - (row + 1) * cellH;

      // Border
      page.drawRectangle({ x: x + 4, y: y + 4, width: cellW - 8, height: cellH - 8, borderColor: theme, borderWidth: 1.2 });
      page.drawRectangle({ x: x + 4, y: y + cellH - 28, width: cellW - 8, height: 24, color: theme });
      page.drawText(opts.leagueName.toUpperCase().slice(0, 40), { x: x + 12, y: y + cellH - 22, size: 9, font: helvBold, color: rgb(1, 1, 1) });
      page.drawText(opts.eventTitle.slice(0, 50), { x: x + 12, y: y + cellH - 44, size: 11, font: helvBold });

      // QR
      const qrPng = await QRCode.toDataURL(r.checkin_code, { width: 220, margin: 0 });
      const qrBytes = Uint8Array.from(atob(qrPng.split(",")[1]), c => c.charCodeAt(0));
      const qrImg = await pdf.embedPng(qrBytes);
      const qrSize = Math.min(cellW - 24, cellH - 110);
      const qrX = x + (cellW - qrSize) / 2;
      const qrY = y + 40;
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      // Code
      const codeTxt = r.checkin_code || "------";
      const cw = helvBold.widthOfTextAtSize(codeTxt, 14);
      page.drawText(codeTxt, { x: x + (cellW - cw) / 2, y: y + 22, size: 14, font: helvBold });

      // Name (truncated)
      let nm = (r.full_name || "").trim();
      while (helv.widthOfTextAtSize(nm, 10) > cellW - 20 && nm.length > 4) nm = nm.slice(0, -1);
      if (nm !== (r.full_name || "").trim()) nm += "…";
      const nw = helv.widthOfTextAtSize(nm, 10);
      page.drawText(nm, { x: x + (cellW - nw) / 2, y: y + 8, size: 10, font: helv });
    }
  }

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
