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
  /** Turmas (A, B, C…) identificadas no texto. null = não foi possível identificar. */
  practice_groups: string[] | null;
};

export type ParsedSubject = { name: string; professor: string | null };

export type ParsedSchedule = {
  subjects: ParsedSubject[];
  entries: ParsedEntry[];
  /** Letras de turma identificadas na planilha inteira. */
  groups: string[];
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

/** Remove menções a professores do texto exibido no cronograma. */
export function stripProfessor(text: string): string {
  return String(text)
    .replace(/\s*[-–—]?\s*\bprofa?\.?\b[^,;–—-]*/gi, " ")
    .replace(/\s*[-–—]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "medicina", "medica", "medicas", "medico", "saude", "curso", "ciencias", "atencao", "promocao",
  "desenvolvimento", "lideranca", "inovacao", "digital", "primaria", "geral", "clinica",
]);

/** Nomes de professores citados na célula (ex.: "Abex - prof Liziane"). */
function professorsIn(text: string): string[] {
  const out: string[] = [];
  const re = /\bprofa?\.?\s+([a-zà-ú]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(norm(m[1]));
  return out;
}

/** Escolhe entre os dois componentes ABEX por regras explícitas de padrão de texto. */
function pickAbex(n: string, catalog: ParsedSubject[], profs: string[]): string | null {
  const abexSubjects = catalog.filter((s) => norm(s.name).startsWith("abex"));
  if (!abexSubjects.length) return null;
  const digital = abexSubjects.find((s) => /digital|lideranca|inovacao/.test(norm(s.name)));
  const primary = abexSubjects.find((s) => s !== digital) ?? abexSubjects[0];

  // 1) professor citado na célula bate com a lista de professores do componente
  for (const s of abexSubjects) {
    const sp = norm(s.professor ?? "");
    if (sp && profs.some((p) => p.length >= 4 && sp.includes(p))) return s.name;
  }
  // 2) padrões de campo (prática/grupos/duplas/Coronel/relatório) → Atenção Primária
  if (/pratica|grupo|dupla|coronel|campo|ubs|relatorio|visita/.test(n)) return primary.name;
  // 3) "Abex" sozinho, teórico/sala → Saúde Digital
  return (digital ?? primary).name;
}

/** Casa o texto da célula com um componente curricular do cabeçalho da planilha. */
function matchSubject(text: string, catalog: ParsedSubject[]): string | null {
  const n = norm(text);
  const profs = professorsIn(text);

  // pontuação genérica (ignorando ABEX, tratado à parte)
  let best: { name: string; score: number; first: number } | null = null;
  for (const s of catalog) {
    const sn = norm(s.name);
    if (sn.startsWith("abex")) continue;
    const tokens = sn.split(/[^a-z0-9]+/).filter((t) => t.length >= 5 && !STOPWORDS.has(t));
    let score = 0;
    for (const t of tokens) if (n.includes(t)) score += t.length;
    // abreviações e nomes compostos comuns
    if (sn.startsWith("medicina de familia") && /\bmfc\b/.test(n)) score += 26;
    if (sn.startsWith("clinica cirurgica") && n.includes("cirurgica")) score += 12;
    let first = 99;
    if (score > 0) {
      first = tokens.map((t) => n.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 99;
      score += Math.max(0, 10 - first / 4);
    }
    if (score >= 6 && (!best || score > best.score)) best = { name: s.name, score, first };
  }

  // ABEX: dois componentes distintos. Vence quem é citado primeiro na célula.
  const abexIdx = n.indexOf("abex");
  if (abexIdx >= 0 && (!best || abexIdx < best.first)) {
    const picked = pickAbex(n, catalog, profs);
    if (picked) return picked;
  }

  // desempate direto por professor quando a pontuação não decidiu
  if (!best && profs.length) {
    for (const s of catalog) {
      const sp = norm(s.professor ?? "");
      if (!sp) continue;
      const nameToken = norm(s.name).split(/[^a-z0-9]+/).find((t) => t.length >= 5 && !STOPWORDS.has(t));
      if (nameToken && n.includes(nameToken) && profs.some((p) => p.length >= 4 && sp.includes(p))) return s.name;
    }
  }

  return best?.name ?? null;
}

/**
 * Identifica quais turmas (A, B, C…) têm aula naquela célula.
 * Retorna:
 *  - lista de letras quando o texto cita turmas/grupos específicos;
 *  - `[]` (todas) quando o texto indica que todos os grupos participam;
 *  - `null` quando é prática/ABEX e não foi possível identificar.
 */
export function detectGroups(text: string, kind: ParsedEntry["kind"], isAbex: boolean): string[] | null {
  const n = norm(text);
  const needsGroups = kind === "practice" || kind === "abex" || isAbex;

  const letters = new Set<string>();
  // "GRUPO A", "GRUPOS A E B", "TURMAS A, B e C", "SUBTURMA C"
  const re = /\b(?:grupos?|turmas?|subturmas?)\s*:?\s*((?:[a-h]\d?)(?:\s*(?:,|e|\/|-|\+)\s*[a-h]\d?)*)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n))) {
    for (const part of m[1].split(/[,e\/\-+\s]+/)) {
      const l = part.trim().toUpperCase();
      if (/^[A-H]\d?$/.test(l)) letters.add(l);
    }
  }
  if (letters.size) return [...letters].sort();

  // "6 GRUPOS", "TODOS OS GRUPOS", "TODAS AS TURMAS" → todas
  if (/\b\d+\s*(grupos|turmas)\b|\btodos os grupos\b|\btodas as turmas\b|\bduplas\b/.test(n)) return [];

  return needsGroups ? null : [];
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
    // datas do semestre podem estar em qualquer coluna
    for (let c = 0; c < (r.length ?? 0); c++) {
      const cn = norm(r[c]);
      if (cn.includes("inicio semestre")) {
        for (let k = c + 1; k <= c + 3; k++) { const d = toISODate(r[k]); if (d) { startDate = d; break; } }
      }
      if (cn.includes("termino semestre") || cn.includes("fim semestre")) {
        for (let k = c + 1; k <= c + 3; k++) { const d = toISODate(r[k]); if (d) { endDate = d; break; } }
      }
    }
    const label = String(r[0] ?? "").trim();
    const n = norm(label);
    if (!label || n.startsWith("codigo") || n.startsWith("cronograma") || n.startsWith("horario das aulas")) continue;
    if (n === "janela verde" || n.includes("inicio semestre")) continue;
    // a coluna de professores varia entre planilhas: pega a 1ª célula preenchida à direita
    let prof: string | null = null;
    for (let c = 1; c <= 5; c++) {
      const v = String(r[c] ?? "").trim();
      if (v && !toISODate(r[c])) { prof = v; break; }
    }

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
          notes: stripProfessor(text),
        });
      }
    }
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { subjects, entries, startDate, endDate, title };
}
