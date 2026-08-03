/** Extração de texto de PDFs do cronograma (roda no navegador). */

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const it of content.items as any[]) {
      const str = String(it.str ?? "");
      const y = Array.isArray(it.transform) ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += (line && !line.endsWith(" ") ? " " : "") + str;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
