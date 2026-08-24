/**
 * Simulador clínico — chamadas de IA. Server-only.
 * Roteamento por provedor a partir do nome do modelo:
 *  - "google/..."     → API própria do Google Gemini (GEMINI_API_KEY), com fallback no gateway
 *  - "anthropic/..."  → API própria da Anthropic (ANTHROPIC_API_KEY)
 *  - qualquer outro   → Lovable AI Gateway
 */

import { loadSimSettings, type Tier, type Usage } from "./sim-billing.server";
import { imageForExam } from "./sim-exam-images";
import { catalogItem, detectExamKeys } from "./sim-exam-catalog";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type AiResult<T> = T & { usage: Usage | null; model: string };

function readUsage(data: any): Usage | null {
  const u = data?.usage;
  if (!u) return null;
  const pt = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const ct = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  return { prompt_tokens: pt, completion_tokens: ct, total_tokens: Number(u.total_tokens ?? pt + ct) };
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("IA não configurada no projeto (LOVABLE_API_KEY ausente).");
  return key;
}

type Msg = { role: "system" | "user" | "assistant"; content: any };

function httpError(resp: Response, body: string): Error {
  let e: Error;
  if (resp.status === 429) e = new Error("Muitas requisições à IA agora. Aguarde alguns segundos e tente de novo.");
  else if (resp.status === 401 || resp.status === 403) e = new Error("Chave de API inválida ou sem permissão para este modelo.");
  else if (resp.status === 402) e = new Error("Os créditos de IA acabaram. Adicione créditos para continuar o treino.");
  else e = new Error(`Falha na IA (${resp.status}): ${body.slice(0, 200)}`);
  (e as any).status = resp.status;
  return e;
}

export type CallOpts = { json?: boolean; maxTokens?: number; cacheSystem?: boolean };

/** Chamada bruta ao modelo, escolhendo o provedor pelo prefixo do nome. */
export async function callModel(
  model: string,
  messages: Msg[],
  json: boolean | CallOpts = true,
): Promise<{ text: string; usage: Usage | null; model: string }> {
  const opts: CallOpts = typeof json === "boolean" ? { json } : json;
  const wantJson = opts.json !== false;

  const geminiKey = process.env["GEMINI_API_KEY"];
  const anthropicKey = process.env["ANTHROPIC_API_KEY"];

  // Anthropic (Claude/Sonnet) com chave própria
  if (model.startsWith("anthropic/") || model.startsWith("claude")) {
    if (!anthropicKey) {
      const e = new Error("ANTHROPIC_API_KEY não configurada.");
      (e as any).status = 401;
      throw e;
    }
    const id = model.replace(/^anthropic\//, "");
    const systemText = messages.filter((m) => m.role === "system").map((m) => String(m.content)).join("\n\n");
    const finalSystem = systemText && wantJson
      ? `${systemText}\n\nResponda SOMENTE com um JSON válido, sem texto fora do JSON.`
      : systemText;
    const rest = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) }));
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: id,
        max_tokens: opts.maxTokens ?? 8000,
        ...(finalSystem
          ? {
              // Prompt caching efêmero: o prompt de sistema é estável entre alunos.
              system: opts.cacheSystem
                ? [{ type: "text", text: finalSystem, cache_control: { type: "ephemeral" } }]
                : finalSystem,
            }
          : {}),
        messages: rest.length ? rest : [{ role: "user", content: "..." }],
      }),
    });
    if (!resp.ok) throw httpError(resp, await resp.text());
    const data: any = await resp.json();
    const text = (Array.isArray(data?.content) ? data.content : [])
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c.text)
      .join("");
    return { text, usage: readUsage(data), model };
  }

  // Google Gemini com chave própria (endpoint compatível com OpenAI)
  const useGemini = geminiKey && (model.startsWith("google/") || model.startsWith("gemini"));
  const url = useGemini ? GEMINI_URL : AI_URL;
  const id = useGemini ? model.replace(/^google\//, "") : model;
  const extra = {
    ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${useGemini ? geminiKey : apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: id, messages, ...extra }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    // Se a chave própria falhar por modelo inexistente, tenta o gateway como reserva.
    if (useGemini && [400, 404, 429, 500, 503].includes(resp.status)) {
      const fb = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, ...extra }),
      });
      if (!fb.ok) throw httpError(fb, await fb.text());
      const d: any = await fb.json();
      return { text: d?.choices?.[0]?.message?.content ?? "", usage: readUsage(d), model };
    }
    throw httpError(resp, body);
  }
  const data: any = await resp.json();
  return { text: data?.choices?.[0]?.message?.content ?? "", usage: readUsage(data), model };

}

async function chat(messages: Msg[], json = true, tier: Tier = "chat") {
  const s = await loadSimSettings();
  // Roteamento híbrido: conversa no modelo rápido/barato, correção no modelo avançado.
  const model = tier === "grade" ? s.grade_model : s.chat_model;
  return callModel(model, messages, json);
}


function parseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const m = String(raw).match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* ignore */ }
    }
    return {};
  }
}

export type SimCase = {
  id: string;
  title: string;
  area: string;
  level: number;
  summary: string | null;
  patient: any;
  triage: any;
  hidden_history: string | null;
  findings: any;
  exams: any;
  diagnosis: string;
  expected_conduct: string | null;
};

function patientSystem(c: SimCase) {
  const p = c.patient ?? {};
  const lay = Number(p.lay_level ?? 3);
  const findings = (Array.isArray(c.findings) ? c.findings : []) as any[];
  return `Você INTERPRETA UM PACIENTE em uma consulta simulada de Medicina, em português do Brasil. Nunca saia do personagem e nunca revele que é uma IA.

FICHA SECRETA DO PACIENTE (nunca leia isso em voz alta, use como memória):
Nome: ${p.name ?? "Paciente"} | Idade: ${p.age ?? "?"} | Sexo: ${p.gender ?? "?"} | Ocupação: ${p.occupation ?? "-"}
Personalidade: ${p.personality ?? "comum"} | Jeito de falar: ${p.speech_style ?? "informal"}
História completa: ${c.hidden_history ?? c.summary ?? ""}
Diagnóstico verdadeiro (NUNCA revele nem confirme): ${c.diagnosis}

NÍVEL DE CONHECIMENTO ("leiguice") = ${lay} de 10.
- 0 a 2: totalmente leigo. Nada de termos técnicos. Descreve sintomas com palavras do dia a dia ("um aperto aqui no peito", "cansaço"), confunde tempo e detalhes, não relaciona sintomas.
- 3 a 6: leigo comum. Alguns termos ouvidos na TV/internet, respostas vagas até ser bem perguntado.
- 7 a 10: usa termos técnicos e arrisca palpites de diagnóstico. Alguns palpites CERTOS e outros ERRADOS de propósito, sempre coerentes com o que ele mesmo já falou, criando pegadinhas. Nunca é uma fonte confiável.

REGRAS:
- Responda só o que foi perguntado. Não entregue a história inteira de uma vez, não faça a anamnese pelo estudante.
- Se o estudante perguntar algo que não está na ficha, invente algo coerente, banal e consistente com o que já disse.
- Frases curtas e naturais, como uma pessoa falando. No máximo 3 frases por resposta.
- Se o estudante disser que vai EXAMINAR algo (auscultar, palpar, percutir, medir pressão, olhar a garganta, examinar reflexos...), reaja como paciente ("pode olhar, doutor") e informe as chaves do exame correspondente em exam_keys.

CHAVES DE EXAME FÍSICO DISPONÍVEIS: ${findings.map((f) => `${f.key} (${f.label})`).join("; ") || "nenhuma"}

Responda SEMPRE em JSON: {"reply":"fala do paciente","exam_keys":["chave1"]}. exam_keys vazio quando não houve manobra de exame físico.`;
}

/**
 * Gera achados coerentes para manobras que o caso não descreve
 * (ex.: aluno percutiu o tórax e o caso só trazia ausculta).
 */
export async function generatedFindings(c: SimCase, keys: string[]) {
  const wanted = keys.map((k) => catalogItem(k)).filter(Boolean) as NonNullable<ReturnType<typeof catalogItem>>[];
  if (!wanted.length) return { findings: [] as any[], usage: null as Usage | null, model: "local" };
  const res = await chat([
    {
      role: "system",
      content: `Você descreve achados de EXAME FÍSICO em uma simulação clínica, em português do Brasil.
Caso (confidencial): ${c.title} — diagnóstico verdadeiro: ${c.diagnosis}. História: ${c.hidden_history ?? c.summary ?? ""}.
Para cada manobra pedida, escreva o achado REAL e coerente com esse diagnóstico (a maioria será normal; altere só o que a doença justifica). Uma a duas frases objetivas, com dados semiológicos.
sound_category deve ser exatamente uma de: cardiaca, pulmonar, abdominal, carotida, percussao, nenhum (use a sugerida).
sound_finding em snake_case (ex.: normal, macicez, submacicez, timpanico, estertores_crepitantes, sibilos, sopro_sistolico).
Responda em JSON: {"findings":[{"key":"","label":"","text":"","sound_category":"","sound_finding":""}]}`,
    },
    {
      role: "user",
      content: wanted.map((w) => `${w.key} | ${w.label} | categoria sugerida: ${w.sound_category}`).join("\n"),
    },
  ]);
  const out = parseJson(res.text);
  const list = (Array.isArray(out.findings) ? out.findings : [])
    .map((f: any) => {
      const item = catalogItem(String(f.key ?? ""));
      if (!item) return null;
      return {
        key: item.key,
        label: item.label,
        text: String(f.text ?? "Sem alterações."),
        sound_category: String(f.sound_category ?? item.sound_category),
        sound_finding: String(f.sound_finding ?? "normal"),
      };
    })
    .filter(Boolean);
  return { findings: list as any[], usage: res.usage, model: res.model };
}

/** Resolve manobras: usa o achado do caso quando existe, senão gera um coerente. */
export async function resolveFindings(c: SimCase, keys: string[]) {
  const caseFindings = (Array.isArray(c.findings) ? c.findings : []) as any[];
  const known = keys.map((k) => caseFindings.find((f) => f.key === k)).filter(Boolean);
  const missing = keys.filter((k) => !caseFindings.some((f) => f.key === k) && catalogItem(k));
  const gen = await generatedFindings(c, missing);
  return { findings: [...known, ...gen.findings], usage: gen.usage, model: gen.model };
}

export async function patientTurn(c: SimCase, transcript: any[], userMessage: string) {
  const history: Msg[] = (transcript ?? [])
    .filter((m: any) => m.role === "user" || m.role === "patient")
    .slice(-24)
    .map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content ?? "") }));

  const res = await chat([
    { role: "system", content: patientSystem(c) },
    ...history,
    { role: "user", content: userMessage },
  ]);
  const out = parseJson(res.text);
  const aiKeys: string[] = Array.isArray(out.exam_keys) ? out.exam_keys.map(String) : [];
  // Detecção local garante que percussão/palpação ditas pelo aluno sempre aconteçam.
  const keys = [...new Set([...aiKeys, ...detectExamKeys(userMessage)])];
  const resolved = await resolveFindings(c, keys);
  return { reply: String(out.reply ?? "..."), findings: resolved.findings, usage: res.usage, model: res.model };
}

export async function examResult(c: SimCase, examName: string) {
  const exams = (Array.isArray(c.exams) ? c.exams : []) as any[];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hit = exams.find((e) => norm(e.name).includes(norm(examName)) || norm(examName).includes(norm(e.name)));
  if (hit) {
    const img = hit.image_url ? null : imageForExam(String(hit.name ?? examName), `${c.diagnosis} ${hit.report ?? ""} ${hit.result_text ?? ""}`);
    return {
      name: hit.name,
      justified: !!hit.justified,
      result_text: String(hit.result_text ?? ""),
      report: String(hit.report ?? ""),
      is_image: !!hit.is_image || !!img,
      image_url: hit.image_url ?? img?.url ?? null,
      usage: null as Usage | null,
      model: "local",
    };
  }
  const res = await chat([
    {
      role: "system",
      content: `Você gera o resultado de um exame complementar em uma simulação clínica.
Caso (confidencial): ${c.title} — diagnóstico verdadeiro: ${c.diagnosis}. História: ${c.hidden_history ?? c.summary ?? ""}.
Gere um resultado REALISTA e coerente com esse diagnóstico, com valores/medidas. Se for exame de imagem, escreva também um laudo.
Marque justified=false quando o exame não contribui para confirmar nem afastar hipóteses razoáveis nesse caso.
Responda em JSON: {"name":"...","justified":true,"result_text":"...","report":"","is_image":false}`,
    },
    { role: "user", content: `Exame solicitado: ${examName}` },
  ]);
  const out = parseJson(res.text);
  const name = String(out.name ?? examName);
  const img = imageForExam(name, `${c.diagnosis} ${out.report ?? ""} ${out.result_text ?? ""}`);
  return {
    name,
    justified: !!out.justified,
    result_text: String(out.result_text ?? "Resultado indisponível."),
    report: String(out.report ?? ""),
    is_image: !!out.is_image || !!img,
    image_url: img?.url ?? null,
    usage: res.usage,
    model: res.model,
  };
}

/**
 * Data pruning: transforma o histórico bruto do chat em texto limpo
 * "Aluno: ... / Paciente: ...", sem metadados, timestamps ou instruções de sistema.
 */
export function cleanTranscript(transcript: any[]): string {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((m: any) => m?.role === "user" || m?.role === "patient" || m?.role === "assistant")
    .map((m: any) => {
      const who = m.role === "user" ? "Aluno" : "Paciente";
      const text = String(m.content ?? "").replace(/\s+/g, " ").trim();
      return text ? `${who}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

const PRECEPTOR_MODEL = "anthropic/claude-3-5-sonnet-20240620";
const FLASH_MODEL = "google/gemini-2.5-flash";

function isProviderBlocked(e: any) {
  const s = Number(e?.status ?? 0);
  return s === 401 || s === 402 || s === 403 || /credit balance|api key|não configurada/i.test(String(e?.message ?? ""));
}

/**
 * CHAMADA A — Preceptor clínico (Anthropic Messages API).
 * Implementação estrita conforme documentação oficial da Anthropic:
 * endpoint /v1/messages, headers x-api-key + anthropic-version,
 * body com model, max_tokens, system (string) e messages [{role,user,content}].
 */
async function callAnthropicPreceptor(system: string, userContent: string): Promise<{ text: string; usage: Usage | null; model: string }> {
  const anthropicKey = process.env["ANTHROPIC_API_KEY"];
  if (!anthropicKey) {
    const e = new Error("ANTHROPIC_API_KEY não configurada.");
    (e as any).status = 401;
    throw e;
  }

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!resp.ok) throw httpError(resp, await resp.text());
  const data: any = await resp.json();
  const text = (Array.isArray(data?.content) ? data.content : [])
    .filter((c: any) => c?.type === "text")
    .map((c: any) => c.text)
    .join("");
  return { text, usage: readUsage(data), model: PRECEPTOR_MODEL };
}

/**
 * CHAMADA A — Preceptor clínico (Anthropic, com fallback automático no Gemini Flash).
 * Só avalia a atuação do aluno; a teoria da doença é da CHAMADA B.
 */
export async function gradeSession(opts: {
  c: SimCase;
  transcript: any[];
  exams: any[];
  findings: any[];
  anamnese: string;
  hypothesis: string;
  rules: string[];
}) {
  const { c, transcript, exams, findings, anamnese, hypothesis, rules } = opts;
  const system = `Você é um avaliador acadêmico sênior, brilhante e empático, avaliando um aluno em um estudo de caso simulado. Avalie a transcrição da entrevista e a tomada de decisão do aluno. REGRA: NÃO explique a teoria do caso (outro sistema fará isso). Foque 100% no feedback de desempenho.

FORMATO OBRIGATÓRIO (Markdown didático, fácil de bater o olho e entender):
- Use exatamente os títulos abaixo como headings de nível 2 ("## TÍTULO"), sempre em linha própria.
- Cada item de lista começa com "- " em uma linha própria (nunca cole vários itens na mesma linha).
- Comece cada item com uma palavra-chave em negrito seguida de dois-pontos, depois a explicação curta (1 a 2 frases).
- Não use colchetes, não repita o enunciado do formato, não escreva parágrafos com mais de 4 linhas.

## PARECER DO AVALIADOR
Análise crítica, discursiva e humana do atendimento, como um mentor conversando com o aluno (2 a 4 parágrafos curtos).

## ACERTOS NA CONDUTA
- **Palavra-chave:** o que o aluno fez bem.

## PONTOS DE ATENÇÃO
- **Palavra-chave:** o que faltou ou saiu errado, e por que importa.

## AÇÕES DESNECESSÁRIAS
- **Palavra-chave:** o que foi pedido sem necessidade. Se não houve, escreva apenas: Nenhuma ação desnecessária solicitada.

## DICA DE OURO
- **Palavra-chave:** uma dica prática de raciocínio para levar à vida real.`;


  const payload = [
    `CASO: ${c.title} | área ${c.area} | nível ${c.level}º ano`,
    `Diagnóstico correto (uso interno do avaliador): ${c.diagnosis}`,
    `Conduta esperada: ${c.expected_conduct ?? "-"}`,
    `Ações pertinentes: ${(Array.isArray(c.exams) ? c.exams : []).filter((e: any) => e.justified).map((e: any) => e.name).join(", ")}`,
    `TRANSCRIÇÃO:\n${cleanTranscript(transcript)}`,
    `EXAME FÍSICO REALIZADO: ${(findings ?? []).map((f: any) => f.label).join(", ") || "nenhum"}`,
    `EXAMES SOLICITADOS: ${(exams ?? []).map((e: any) => `${e.name}${e.justified ? "" : " (supérfluo)"}`).join(", ") || "nenhum"}`,
    `ANAMNESE ESCRITA: ${anamnese || "-"}`,
    `HIPÓTESE DIAGNÓSTICA DO ALUNO: ${hypothesis}`,
  ].join("\n\n");

  const fallbackMessages: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: payload },
  ];

  let res: { text: string; usage: Usage | null; model: string };
  try {
    res = await callAnthropicPreceptor(system, payload);
  } catch (e: any) {
    if (!isProviderBlocked(e)) throw e;
    res = await callModel(FLASH_MODEL, fallbackMessages, { json: false, maxTokens: 4096 });
  }

  const raw = String(res.text ?? "").trim();
  const out = parseJson(raw);

  // O novo prompt retorna Markdown livre. Se não houver campos estruturados,
  // guardamos o texto completo em parecer_md e mantemos os demais campos vazios.
  const hasStructured = out.score != null || out.veredito || out.comentario || out.parecer_md;
  const arr = (v: any) => (Array.isArray(v) ? v.map(String) : []);
  return {
    score: hasStructured ? Math.max(0, Math.min(100, Number(out.score ?? 0))) : 0,
    veredito: String(out.veredito ?? ""),
    acertos: arr(out.acertos),
    faltou: arr(out.faltou),
    exames_desnecessarios: arr(out.exames_desnecessarios),
    melhorias: arr(out.melhorias),
    diagnostico_correto: String(out.diagnostico_correto ?? c.diagnosis),
    comentario: String(out.comentario ?? ""),
    parecer_md: hasStructured ? String(out.parecer_md ?? "") : raw,
    usage: res.usage,
    model: res.model,
  };
}

/** CHAMADA B — Livro-texto (Gemini Flash): aula completa em Markdown sobre a patologia. */
export async function theoryLesson(c: { diagnosis: string; area: string; level: number }) {
  const res = await callModel(
    FLASH_MODEL,
    [
      {
        role: "system",
        content: `Aja como um livro-texto de medicina resumindo a patologia para um aluno do ${c.level}º ano da graduação. Português do Brasil, objetivo e didático.

FORMATO OBRIGATÓRIO em Markdown, com estes headings de nível 2 em linha própria, nesta ordem:
## RESUMO RÁPIDO
3 a 5 bullets com o essencial da doença (o que é, a quem acomete, sinal-chave, exame-chave, tratamento-chave).
## DEFINIÇÃO E FISIOPATOLOGIA
Parágrafos curtos explicando o mecanismo de forma simples.
## EPIDEMIOLOGIA E INCIDÊNCIA
Bullets com incidência/prevalência, faixa etária, sexo predominante e fatores de risco (use números aproximados quando existirem).
## QUADRO CLÍNICO
Bullets de sintomas e sinais, separando típicos de atípicos e sinais de gravidade.
## DIAGNÓSTICO E EXAMES
Bullets: exame padrão-ouro, exames iniciais, achados esperados e critérios diagnósticos.
## DIAGNÓSTICOS DIFERENCIAIS
Bullets curtos: nome do diferencial em negrito + como diferenciar.
## TRATAMENTO
Bullets separando medidas iniciais/suporte, tratamento específico (com classes de fármacos e doses usuais quando pertinente) e seguimento.
## PONTOS DE PROVA
3 a 5 bullets com pegadinhas e fatos mais cobrados.

REGRAS: cada bullet começa com "- " em linha própria e inicia com uma palavra-chave em **negrito** seguida de dois-pontos. Frases curtas. Sem colchetes, sem repetir o enunciado do formato.`,
      },
      { role: "user", content: `Patologia: ${c.diagnosis} (área: ${c.area}).` },
    ],
    { json: false, maxTokens: 3000 },
  );

  return { aula: String(res.text ?? "").trim(), usage: res.usage, model: res.model };
}



export async function transcribeAudio(base64: string, format: string) {
  const settings = await loadSimSettings();
  // Áudio só é suportado pelos modelos Gemini; se o chat estiver em Claude, usa o Gemini padrão.
  const model = /claude|anthropic/i.test(settings.chat_model) ? "google/gemini-2.5-flash" : settings.chat_model;
  const res = await callModel(
    model,
    [
      {
        role: "user",
        content: [
          { type: "text", text: "Transcreva exatamente a fala deste áudio em português do Brasil. Responda somente com a transcrição, sem comentários." },
          { type: "input_audio", input_audio: { data: base64, format } },
        ],
      },
    ],
    false,
  );
  return { text: String(res.text ?? "").trim(), usage: res.usage, model: res.model };
}


export function levelGuidance(level: number): string {
  switch (Number(level)) {
    case 1:
      return `1º ANO — semiologia inicial. SOMENTE quadros simples e muito prevalentes, com sinais clínicos clássicos e diretos (resfriado/IVAS, faringoamigdalite, gastroenterite aguda, cefaleia tensional, lombalgia mecânica, ITU não complicada, celulite/ferida simples, asma leve, anemia ferropriva, dor abdominal inespecífica, hipertensão recém-descoberta assintomática, entorse). PROIBIDO: doenças raras, síndromes complexas, terapia intensiva, casos com múltiplas comorbidades ou diagnóstico por exclusão. Exames complementares básicos (hemograma, EAS, glicemia, radiografia simples). Foco em anamnese bem feita e exame físico básico.`;
    case 2:
      return `2º ANO — mesmos casos simples do 1º ano, podendo incluir quadros que exijam algum raciocínio clínico e exame físico um pouco mais específico: HAS e suas repercussões, diabetes mellitus e descompensações simples, IAM, AVC, insuficiência cardíaca, DPOC, pneumonia, TEP/TEV, hipertensão pulmonar, síndromes genéticas simples (Down, Turner, Marfan), lesões corporais/traumas não complexos, dislipidemia, hipo/hipertireoidismo. Ainda sem casos raros ou de alta complexidade em UTI.`;
    case 3:
      return `3º ANO — clínica médica intermediária: doenças prevalentes com diagnóstico diferencial real, interpretação de exames laboratoriais e de imagem, comorbidades associadas. Sem raridades.`;
    case 4:
      return `4º ANO — casos de complexidade moderada a alta, incluindo emergências, doenças sistêmicas (reumatológicas, hematológicas, infecciosas), interpretação avançada de exames e decisões de conduta.`;
    case 5:
      return `5º ANO — internato: casos complexos, pacientes com múltiplas comorbidades, apresentações atípicas, urgência/emergência e definição completa de conduta e seguimento.`;
    default:
      return `6º ANO — nível de internato final/prova de residência: casos complexos e atípicos, diagnóstico diferencial exigente, manejo completo incluindo terapia intensiva, critérios diagnósticos formais e condutas baseadas em diretrizes.`;
  }
}

export async function generateCases(area: string, level: number, count: number) {
  const system = `Você é professor de semiologia que escreve casos clínicos ORIGINAIS em português do Brasil, no estilo e dificuldade das provas ENAMED/Revalida (nunca copie enunciados existentes).

DIFICULDADE OBRIGATÓRIA PARA ESTE LOTE (respeite à risca, a complexidade deve ser proporcional ao ano):
${levelGuidance(level)}

Responda em JSON: {"casos":[{"title":"","level":${level},"summary":"","patient":{"name":"","age":0,"gender":"masculino|feminino","occupation":"","personality":"","lay_level":0,"speech_style":""},"triage":{"chief_complaint":"","pa":"","fc":"","fr":"","temp":"","spo2":"","dor":"","peso":"","alergias":"","medicacoes":"","observacoes":""},"hidden_history":"","findings":[{"key":"ausculta_cardiaca","label":"Ausculta cardíaca","text":"","sound_category":"cardiaca|pulmonar|abdominal|carotida|percussao|nenhum","sound_finding":""}],"exams":[{"name":"","category":"","justified":true,"result_text":"","report":"","is_image":false}],"diagnosis":"","expected_conduct":""}]}
Regras: 8 a 14 findings (sempre incluindo ausculta_cardiaca, ausculta_pulmonar, palpacao_abdome e inspecao_geral); 6 a 10 exames, alguns com justified=false (supérfluos); hidden_history detalhada (HDA, antecedentes, hábitos, familiares); triagem coerente com o diagnóstico; lay_level entre 0 e 10 variando entre os casos.`;

  const res = await chat([
    { role: "system", content: system },
    { role: "user", content: `Gere ${count} caso(s) da área "${area}" para o ${level}º ano da graduação em Medicina.` },
  ]);
  const out = parseJson(res.text);
  const casos = Array.isArray(out.casos) ? out.casos : [];
  return casos.map((c: any) => ({ ...c, area, level }));
}

/** Dica do Preceptor — só para 1º e 2º ano, guia sem entregar o diagnóstico. */
export async function preceptorHint(opts: {
  c: SimCase;
  transcript: any[];
  exams: any[];
  findings: any[];
  previousHints: string[];
}) {
  const { c, transcript, exams, findings, previousHints } = opts;
  const system = `Você é um preceptor observando um estudante do ${c.level}º ano em uma estação simulada de semiologia, em português do Brasil.

GABARITO (NUNCA revele): diagnóstico ${c.diagnosis}. História real: ${c.hidden_history ?? c.summary ?? ""}.
Exames pertinentes: ${(Array.isArray(c.exams) ? c.exams : []).filter((e: any) => e.justified).map((e: any) => e.name).join(", ") || "-"}

Sua tarefa: avaliar se o estudante está indo por um caminho razoável.
- Se ele está no caminho certo, ou o desvio é pequeno/normal para o nível, responda off_track=false e hint="".
- Se ele está claramente perdido (perguntas repetidas, sem caracterizar a queixa principal, ignorando um sinal vital alterado, pedindo exames sem sentido, insistindo em uma linha errada), responda off_track=true e escreva UMA dica curta (máx. 2 frases) que oriente o PRÓXIMO passo (o que perguntar ou examinar) SEM citar o diagnóstico, sem nomear a doença e sem entregar a resposta.
- Nunca repita dicas já dadas: ${previousHints.length ? previousHints.join(" | ") : "nenhuma"}
- Tom acolhedor de preceptor, tratando o aluno por "você".

Responda em JSON: {"off_track":true|false,"hint":"..."}`;

  const payload = {
    triagem: c.triage ?? {},
    conversa: (transcript ?? []).map((m: any) => `${m.role === "user" ? "Estudante" : "Paciente"}: ${m.content}`).join("\n").slice(0, 6000),
    exame_fisico_realizado: (findings ?? []).map((f: any) => f.label),
    exames_solicitados: (exams ?? []).map((e: any) => e.name),
  };
  const res = await chat([
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(payload) },
  ]);
  const out = parseJson(res.text);
  const hint = String(out.hint ?? "").trim();
  return { off_track: !!out.off_track && hint.length > 0, hint, usage: res.usage, model: res.model };
}
