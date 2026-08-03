/** Converte o texto bruto de um PDF de cronograma em matérias + atividades (IA). */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "13:30", end: "17:30" },
  night: { start: "19:00", end: "22:00" },
};

const SYSTEM = `Você lê cronogramas do curso de Medicina (Unochapecó) em texto extraído de PDF e devolve dados estruturados.

Devolva SOMENTE JSON no formato:
{"title": string|null,
 "subjects":[{"name":"...","professor":null|"..."}],
 "entries":[{"date":"YYYY-MM-DD","shift":"morning|afternoon|night","kind":"class|practice|exam|green_zone|abex","is_abex":false,"subject_name":null|"...","notes":"texto original da célula","groups":null|["A","B"]}]}

Regras:
- "subjects" é o catálogo de componentes curriculares citados (sem repetir). O nome não deve conter o nome do professor.
- Cada atividade do cronograma vira UMA entrada, com a data real (converta datas em formato brasileiro) e o turno correspondente (manhã/tarde/noite).
- kind: "class" teórica, "practice" prática/laboratório/campo, "exam" prova/avaliação, "green_zone" janela/horário livre, "abex".
- Existem DOIS componentes ABEX distintos: atividades de campo/UBS/visitas/relatório pertencem ao ABEX de Atenção Primária; atividades teóricas de inovação/liderança/saúde digital pertencem ao ABEX de Saúde Digital. Use os professores citados para desempatar.
- groups: letras das turmas participantes (["A","B"]); [] quando todas participam; null quando não dá para deduzir.
- notes deve conter o texto original da atividade.
- Não invente datas nem atividades que não estejam no texto.`;

export type PdfParsed = {
  title: string | null;
  subjects: { name: string; professor: string | null; groups?: string[] }[];
  entries: {
    date: string;
    shift: "morning" | "afternoon" | "night";
    start_time: string;
    end_time: string;
    kind: "class" | "practice" | "exam" | "green_zone" | "abex";
    is_abex: boolean;
    subject_name: string | null;
    notes: string;
    practice_groups: string[] | null;
  }[];
};

async function ask(apiKey: string, chunk: string): Promise<any> {
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: chunk },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
  if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
  if (!resp.ok) throw new Error(`Falha na IA (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  const json: any = await resp.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const m = String(content).match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

/** Divide o texto em blocos para não estourar o limite do modelo. */
function chunkText(text: string, size = 12000): string[] {
  if (text.length <= size) return [text];
  const parts: string[] = [];
  const lines = text.split("\n");
  let cur = "";
  for (const l of lines) {
    if (cur.length + l.length + 1 > size) {
      parts.push(cur);
      cur = "";
    }
    cur += l + "\n";
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

export async function parsePdfSchedule(text: string): Promise<PdfParsed> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("IA indisponível (chave não configurada).");

  const out: PdfParsed = { title: null, subjects: [], entries: [] };
  const seenSubj = new Set<string>();

  for (const chunk of chunkText(text)) {
    const r = await ask(apiKey, chunk);
    if (!out.title && typeof r?.title === "string" && r.title.trim()) out.title = r.title.trim();

    for (const s of Array.isArray(r?.subjects) ? r.subjects : []) {
      const name = String(s?.name ?? "").trim();
      if (!name || seenSubj.has(name.toLowerCase())) continue;
      seenSubj.add(name.toLowerCase());
      out.subjects.push({
        name,
        professor: s?.professor ? String(s.professor).trim() : null,
        groups: ["A"],
      });
    }

    for (const e of Array.isArray(r?.entries) ? r.entries : []) {
      const date = String(e?.date ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const shift = ["morning", "afternoon", "night"].includes(e?.shift) ? e.shift : "morning";
      const kind = ["class", "practice", "exam", "green_zone", "abex"].includes(e?.kind) ? e.kind : "class";
      const t = SHIFT_TIMES[shift];
      out.entries.push({
        date,
        shift,
        start_time: t.start,
        end_time: t.end,
        kind,
        is_abex: !!e?.is_abex || kind === "abex",
        subject_name: e?.subject_name ? String(e.subject_name).trim() : null,
        notes: String(e?.notes ?? "").trim(),
        practice_groups: Array.isArray(e?.groups)
          ? e.groups.map((g: any) => String(g).trim().toUpperCase()).filter(Boolean)
          : e?.groups === null || e?.groups === undefined
            ? null
            : [],
      });
    }
  }

  out.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
