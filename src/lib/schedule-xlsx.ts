/** Parser do cronograma em Excel (formato Coordenação de Medicina). Roda no navegador. */

export type ParsedShift = "morning" | "afternoon" | "night";

export type ParsedEntry = {
  date: string;
  shift: ParsedShift;
  start_time: string;
  end_time: string;
  kind: "class" | "practice" | "exam" | "green_zone" | "abex";
  is_abex: boolean;
  subject_name: string | null;
  notes: string;
};

export type ParsedSubject = { name: string; professor: string | null };

export type ParsedSchedule = {
  subjects: ParsedSubject[];
  entries: ParsedEntry[];
  startDate: string | null;
  endDate: string | null;
  title: string | null;
};

const SHIFT_TIMES: Record<ParsedShift, { start: string; end: string }> = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "13:30", end: "17:30" },
  night: { start: "19:00", end: "22:00" },
};

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function toISODate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (br) {
      const y = br[3].length === 2 ? `20${br[3]}` : br[3];
      return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
  }
  return null;
}

function shiftOf(cell: unknown): ParsedShift | null {
  const n = norm(cell);
  if (n.startsWith("manha")) return "morning";
  if (n.startsWith("tarde")) return "afternoon";
  if (n.startsWith("noite")) return "night";
  return null;
}

function classify(text: string): { kind: ParsedEntry["kind"]; is_abex: boolean } {
  const n = norm(text);
  const isAbex = n.includes("abex");
  if (!isAbex && /^janela verde/.test(n)) return { kind: "green_zone", is_abex: false };
  if (/prova|avaliacao|exame|substitutiva/.test(n)) return { kind: "exam", is_abex: isAbex };
  if (/pratica|prática/.test(n)) return { kind: "practice", is_abex: isAbex };
  if (isAbex) return { kind: "abex", is_abex: true };
  return { kind: "class", is_abex: false };
}

/** Casa o texto da célula com um componente curricular do cabeçalho da planilha. */
function matchSubject(text: string, catalog: ParsedSubject[]): string | null {
  const n = norm(text);
  let best: { name: string; score: number } | null = null;
  for (const s of catalog) {
    const sn = norm(s.name);
    const tokens = sn.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
    let score = 0;
    for (const t of tokens) if (n.includes(t)) score += t.length;
    // abreviações comuns
    if (sn.startsWith("medicina de familia") && /\bmfc\b/.test(n)) score += 10;
    if (score > 0 && (!best || score > best.score)) best = { name: s.name, score };
  }
  return best?.name ?? null;
}

export async function parseScheduleWorkbook(file: File): Promise<ParsedSchedule> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });

  const title = rows[0]?.[0] ? String(rows[0][0]).trim() : null;

  // 1) catálogo de componentes (antes da primeira grade semanal)
  const subjects: ParsedSubject[] = [];
  let startDate: string | null = null;
  let endDate: string | null = null;
  let firstGrid = rows.findIndex((r) => norm(r?.[0]).startsWith("turno"));
  if (firstGrid < 0) firstGrid = rows.length;

  for (let i = 0; i < firstGrid; i++) {
    const r = rows[i] ?? [];
    const label = String(r[0] ?? "").trim();
    const n = norm(label);
    if (n.includes("inicio semestre")) startDate = toISODate(r[2]) ?? startDate;
    if (norm(r[4]).includes("termino semestre")) endDate = toISODate(r[6]) ?? endDate;
    if (!label || n.startsWith("codigo") || n.startsWith("cronograma") || n.startsWith("horario das aulas")) continue;
    if (n === "janela verde") continue;
    const prof = r[4] ? String(r[4]).trim() : null;
    if (label.length > 3 && label === label.toUpperCase()) {
      subjects.push({ name: label.replace(/\s+/g, " "), professor: prof });
    }
  }

  // 2) blocos semanais
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();
  for (let i = firstGrid; i < rows.length; i++) {
    if (!norm(rows[i]?.[0]).startsWith("turno")) continue;
    const dateRow = rows[i + 1] ?? [];
    const dates: (string | null)[] = [];
    for (let c = 1; c <= 6; c++) dates[c] = toISODate(dateRow[c]);
    if (!dates.some(Boolean)) continue;
    // preenche datas faltantes a partir da primeira válida
    const baseIdx = dates.findIndex((d) => !!d);
    if (baseIdx > 0) {
      const base = new Date(`${dates[baseIdx]}T00:00:00`);
      for (let c = 1; c <= 6; c++) {
        if (dates[c]) continue;
        const d = new Date(base);
        d.setDate(d.getDate() + (c - baseIdx));
        dates[c] = d.toISOString().slice(0, 10);
      }
    }

    for (let r = i + 2; r < rows.length; r++) {
      if (norm(rows[r]?.[0]).startsWith("turno")) break;
      const sh = shiftOf(rows[r]?.[0]);
      if (!sh) continue;
      for (let c = 1; c <= 6; c++) {
        const raw = rows[r]?.[c];
        const text = String(raw ?? "").replace(/\s+/g, " ").trim();
        const date = dates[c];
        if (!text || !date) continue;
        const key = `${date}|${sh}|${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { kind, is_abex } = classify(text);
        entries.push({
          date,
          shift: sh,
          start_time: SHIFT_TIMES[sh].start,
          end_time: SHIFT_TIMES[sh].end,
          kind,
          is_abex,
          subject_name: matchSubject(text, subjects),
          notes: text,
        });
      }
    }
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { subjects, entries, startDate, endDate, title };
}
