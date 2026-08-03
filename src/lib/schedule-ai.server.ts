/** Interpretação do cronograma com IA (Lovable AI Gateway). */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export type AiSubject = { name: string; professor?: string | null };
export type AiCell = { text: string; kind: string; is_abex: boolean; shift: string };
export type AiResult = {
  text: string;
  subject_name: string | null;
  kind: "class" | "practice" | "exam" | "green_zone" | "abex";
  is_abex: boolean;
  groups: string[] | null;
};

const SYSTEM = `Você organiza cronogramas do curso de Medicina (Unochapecó).
Recebe o catálogo de componentes curriculares (com professores) e uma lista de textos de células do cronograma.
Para CADA texto devolva:
- subject_name: o nome EXATO de um componente do catálogo, ou null se nenhum servir.
- kind: "class" (teórica), "practice" (prática/laboratório/campo), "exam" (prova/avaliação/substitutiva), "green_zone" (janela verde livre) ou "abex".
- is_abex: true quando o texto trata de ABEX.
- groups: letras das turmas que participam (["A","B"]). Use [] quando TODAS as turmas participam. Use null só se for impossível deduzir.

Regras importantes:
- Existem DOIS componentes ABEX distintos. Diferencie pelo professor citado na célula e pelo contexto: atividades de campo/prática/UBS/visitas/grupos/duplas/relatório pertencem ao ABEX de Atenção Primária; atividades teóricas em sala sobre inovação/liderança/saúde digital pertencem ao ABEX de Saúde Digital. Se o professor citado bater com o professor de um dos ABEX no catálogo, essa é a resposta correta.
- Ignore nomes de professores ao decidir o nome do componente, exceto para desempate.
- Nunca invente nomes: subject_name precisa ser idêntico a um item do catálogo.
Responda SOMENTE com JSON: {"items":[{"text":"...","subject_name":...,"kind":"...","is_abex":false,"groups":[...]}]}`;

async function askBatch(apiKey: string, subjects: AiSubject[], cells: AiCell[]): Promise<AiResult[]> {
  const prompt = JSON.stringify({
    catalogo: subjects.map((s) => ({ nome: s.name, professor: s.professor ?? null })),
    celulas: cells.map((c) => ({ texto: c.text, turno: c.shift })),
  });

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
  if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
  if (!resp.ok) throw new Error(`Falha na IA (${resp.status}): ${(await resp.text()).slice(0, 200)}`);

  const json: any = await resp.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = String(content).match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { items: [] };
  }
  const names = new Set(subjects.map((s) => s.name));
  return (parsed.items ?? []).map((it: any) => ({
    text: String(it.text ?? ""),
    subject_name: it.subject_name && names.has(it.subject_name) ? it.subject_name : null,
    kind: ["class", "practice", "exam", "green_zone", "abex"].includes(it.kind) ? it.kind : "class",
    is_abex: !!it.is_abex,
    groups: Array.isArray(it.groups)
      ? it.groups.map((g: any) => String(g).trim().toUpperCase()).filter(Boolean)
      : it.groups === null
        ? null
        : [],
  }));
}

export async function refineCells(subjects: AiSubject[], cells: AiCell[]): Promise<AiResult[]> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("IA indisponível (chave não configurada).");

  const out: AiResult[] = [];
  const SIZE = 40;
  for (let i = 0; i < cells.length; i += SIZE) {
    const part = await askBatch(apiKey, subjects, cells.slice(i, i + SIZE));
    out.push(...part);
  }
  return out;
}
