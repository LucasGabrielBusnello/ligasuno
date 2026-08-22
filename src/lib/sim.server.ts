/** Simulador clínico — chamadas de IA (Lovable AI Gateway). Server-only. */

import { loadSimSettings, type Tier, type Usage } from "./sim-billing.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

async function chat(messages: Msg[], json = true, tier: Tier = "chat"): Promise<{ text: string; usage: Usage | null; model: string }> {
  const s = await loadSimSettings();
  // Roteamento híbrido: conversa no modelo rápido/barato, correção no modelo avançado.
  const model = tier === "grade" ? s.grade_model : s.chat_model;
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (resp.status === 429) throw new Error("Muitas requisições à IA agora. Aguarde alguns segundos e tente de novo.");
  if (resp.status === 402) throw new Error("Os créditos de IA do workspace acabaram. Adicione créditos para continuar o treino.");
  if (!resp.ok) throw new Error(`Falha na IA (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  const data: any = await resp.json();
  return { text: data?.choices?.[0]?.message?.content ?? "", usage: readUsage(data), model };
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
  const keys: string[] = Array.isArray(out.exam_keys) ? out.exam_keys.map(String) : [];
  const findings = (Array.isArray(c.findings) ? c.findings : []) as any[];
  const revealed = keys
    .map((k) => findings.find((f) => f.key === k))
    .filter(Boolean);
  return { reply: String(out.reply ?? "..."), findings: revealed, usage: res.usage, model: res.model };
}

export async function examResult(c: SimCase, examName: string) {
  const exams = (Array.isArray(c.exams) ? c.exams : []) as any[];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hit = exams.find((e) => norm(e.name).includes(norm(examName)) || norm(examName).includes(norm(e.name)));
  if (hit) {
    return {
      name: hit.name,
      justified: !!hit.justified,
      result_text: String(hit.result_text ?? ""),
      report: String(hit.report ?? ""),
      is_image: !!hit.is_image,
      image_url: hit.image_url ?? null,
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
  return {
    name: String(out.name ?? examName),
    justified: !!out.justified,
    result_text: String(out.result_text ?? "Resultado indisponível."),
    report: String(out.report ?? ""),
    is_image: !!out.is_image,
    image_url: null as string | null,
    usage: res.usage,
    model: res.model,
  };
}

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
  const system = `Você é professor de semiologia e clínica médica corrigindo uma estação simulada, em português do Brasil.

CASO (gabarito): ${c.title} | área ${c.area} | nível ${c.level}º ano
Diagnóstico correto: ${c.diagnosis}
Conduta esperada: ${c.expected_conduct ?? "-"}
História real: ${c.hidden_history ?? c.summary ?? ""}
Exames pertinentes do caso: ${(Array.isArray(c.exams) ? c.exams : []).filter((e: any) => e.justified).map((e: any) => e.name).join(", ")}

COMO PONTUAR (0 a 100):
- 100: chegou ao diagnóstico, colheu a anamnese de forma completa e organizada, examinou o que era necessário e pediu SOMENTE os exames necessários — resolutivo, sem desgastar o paciente.
- ~70: chegou ao diagnóstico, mas pediu exames desnecessários ou deixou lacunas na anamnese.
- Cada exame pedido sem sentido para o caso (nem para confirmar nem para afastar hipótese) desconta pontos.
- Abaixo de 40: diagnóstico errado ou raciocínio clínico desorganizado.
- Ajuste a exigência ao nível do aluno (${c.level}º ano).
${rules.length ? `\nREGRAS ADICIONAIS DE CORREÇÃO DEFINIDAS PELO PROFESSOR RESPONSÁVEL (siga à risca):\n- ${rules.join("\n- ")}` : ""}

Responda em JSON:
{"score":0-100,"veredito":"frase curta","acertos":["..."],"faltou":["..."],"exames_desnecessarios":["..."],"melhorias":["..."],"diagnostico_correto":"...","comentario":"parágrafo com o parecer geral e o raciocínio clínico esperado"}`;

  const payload = {
    conversa: (transcript ?? []).map((m: any) => `${m.role === "user" ? "Estudante" : "Paciente"}: ${m.content}`).join("\n").slice(0, 12000),
    exame_fisico_realizado: (findings ?? []).map((f: any) => f.label),
    exames_solicitados: (exams ?? []).map((e: any) => ({ nome: e.name, pertinente: e.justified })),
    anamnese_escrita: anamnese,
    hipotese_diagnostica: hypothesis,
  };
  const res = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ],
    true,
    "grade",
  );
  const out = parseJson(res.text);
  const score = Math.max(0, Math.min(100, Number(out.score ?? 0)));
  return {
    score,
    veredito: String(out.veredito ?? ""),
    acertos: Array.isArray(out.acertos) ? out.acertos.map(String) : [],
    faltou: Array.isArray(out.faltou) ? out.faltou.map(String) : [],
    exames_desnecessarios: Array.isArray(out.exames_desnecessarios) ? out.exames_desnecessarios.map(String) : [],
    melhorias: Array.isArray(out.melhorias) ? out.melhorias.map(String) : [],
    diagnostico_correto: String(out.diagnostico_correto ?? c.diagnosis),
    comentario: String(out.comentario ?? ""),
    usage: res.usage,
    model: res.model,
  };
}

export async function transcribeAudio(base64: string, format: string) {
  const settings = await loadSimSettings();
  const model = settings.chat_model;
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva exatamente a fala deste áudio em português do Brasil. Responda somente com a transcrição, sem comentários." },
            { type: "input_audio", input_audio: { data: base64, format } },
          ],
        },
      ],
    }),
  });
  if (resp.status === 429) throw new Error("Muitas requisições à IA agora. Aguarde alguns segundos.");
  if (resp.status === 402) throw new Error("Os créditos de IA do workspace acabaram.");
  if (!resp.ok) throw new Error(`Falha ao transcrever (${resp.status}).`);
  const data: any = await resp.json();
  return {
    text: String(data?.choices?.[0]?.message?.content ?? "").trim(),
    usage: readUsage(data),
    model,
  };
}

export async function generateCases(area: string, level: number, count: number) {
  const system = `Você é professor de semiologia que escreve casos clínicos ORIGINAIS em português do Brasil, no estilo e dificuldade das provas ENAMED/Revalida (nunca copie enunciados existentes).
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
