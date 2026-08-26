/**
 * BIBLIOTECA DE REFERÊNCIAS ABSOLUTAS do simulador clínico (RAG curado).
 *
 * Regra do produto: nada fora desta lista pode ser usado como fonte de verdade,
 * nem na geração de casos, nem na correção do preceptor. Toda afirmação clínica
 * deve ser rastreável a uma destas obras/diretrizes.
 */

export type RefEntry = { area: string; refs: string[] };

/** Núcleo básico — sempre disponível, em qualquer área. */
export const CORE_REFS: string[] = [
  "Moore — Anatomia Orientada para a Clínica",
  "Guyton & Hall — Tratado de Fisiologia Médica",
  "Robbins & Cotran — Bases Patológicas das Doenças",
  "Goodman & Gilman — As Bases Farmacológicas da Terapêutica",
  "Harrison — Medicina Interna",
  "Goldman-Cecil — Tratado de Medicina Interna",
];

/** Diretrizes e protocolos brasileiros — sempre disponíveis (conduta no SUS). */
export const BR_GUIDELINES: string[] = [
  "Ministério da Saúde — Cadernos de Atenção Básica (CAB 28 Acolhimento à Demanda Espontânea, CAB 32 Pré-natal de Baixo Risco, CAB 33 Saúde da Criança, CAB 36 Diabetes Mellitus, CAB 37 Hipertensão Arterial)",
  "Ministério da Saúde — Guia de Vigilância em Saúde (GVS)",
  "Ministério da Saúde — Programa Nacional de Imunizações (PNI) / Calendário Nacional de Vacinação",
  "Ministério da Saúde — Protocolos de Intervenção para o SAMU 192: Suporte Básico de Vida (SBV)",
  "Ministério da Saúde — Protocolos de Intervenção para o SAMU 192: Suporte Avançado de Vida (SAV)",
  "Ministério da Saúde — Acolhimento com Avaliação e Classificação de Risco",
  "Ministério da Saúde — Manual de Gestação de Alto Risco",
  "OPAS/Ministério da Saúde — AIDPI, módulo de Urgência",
  "Ministério da Saúde — Manual de Diagnóstico e Tratamento de Acidentes por Animais Peçonhentos",
];

/** Referências por especialidade. As chaves são comparadas de forma tolerante. */
export const AREA_REFS: RefEntry[] = [
  { area: "Clínica Médica", refs: ["Harrison — Medicina Interna", "Goldman-Cecil — Tratado de Medicina Interna"] },
  { area: "Cirurgia Geral", refs: ["Sabiston — Tratado de Cirurgia"] },
  { area: "Pediatria", refs: ["Nelson — Tratado de Pediatria", "OPAS/MS — AIDPI"] },
  {
    area: "Ginecologia e Obstetrícia",
    refs: ["Williams — Obstetrícia", "FEBRASGO — Tratados e Protocolos", "MS — CAB 32 Pré-natal de Baixo Risco", "MS — Manual de Gestação de Alto Risco"],
  },
  {
    area: "Medicina Preventiva e Saúde Coletiva",
    refs: ["Rouquayrol — Epidemiologia & Saúde", "MS — Cadernos de Atenção Básica", "MS — Guia de Vigilância em Saúde"],
  },
  { area: "Medicina de Família e Comunidade", refs: ["MS — Cadernos de Atenção Básica", "Rouquayrol — Epidemiologia & Saúde"] },
  { area: "Cardiologia", refs: ["Braunwald — Tratado de Doenças Cardiovasculares", "MS — CAB 37 Hipertensão Arterial"] },
  { area: "Psiquiatria", refs: ["Kaplan & Sadock — Compêndio de Psiquiatria", "DSM-5-TR"] },
  { area: "Ortopedia", refs: ["Sizínio Hebert — Ortopedia e Traumatologia: Princípios e Prática"] },
  { area: "Pneumologia", refs: ["Murray & Nadel's Textbook of Respiratory Medicine"] },
  { area: "Dermatologia", refs: ["Azulay — Dermatologia"] },
  { area: "Infectologia", refs: ["Mandell, Douglas & Bennett — Principles and Practice of Infectious Diseases", "MS — Guia de Vigilância em Saúde"] },
  { area: "Neurologia", refs: ["Adams and Victor's Principles of Neurology", "Merritt's Neurology"] },
  { area: "Gastroenterologia", refs: ["Sleisenger and Fordtran's Gastrointestinal and Liver Disease"] },
  { area: "Proctologia", refs: ["Sleisenger and Fordtran's Gastrointestinal and Liver Disease", "Sabiston — Tratado de Cirurgia"] },
  { area: "Endocrinologia", refs: ["Williams Textbook of Endocrinology", "MS — CAB 36 Diabetes Mellitus"] },
  { area: "Nefrologia", refs: ["Brenner and Rector's The Kidney"] },
  { area: "Otorrinolaringologia", refs: ["ABORL-CCF — Tratado de Otorrinolaringologia"] },
  { area: "Oftalmologia", refs: ["CBO — Manuais do Conselho Brasileiro de Oftalmologia", "Kanski's Clinical Ophthalmology"] },
  { area: "Urologia", refs: ["Campbell-Walsh Urology"] },
  { area: "Hematologia", refs: ["Harrison — Medicina Interna", "Goldman-Cecil — Tratado de Medicina Interna"] },
  { area: "Reumatologia", refs: ["Harrison — Medicina Interna", "Goldman-Cecil — Tratado de Medicina Interna"] },
  { area: "Oncologia", refs: ["Harrison — Medicina Interna", "Robbins & Cotran — Bases Patológicas das Doenças"] },
  { area: "Geriatria", refs: ["Harrison — Medicina Interna", "Goldman-Cecil — Tratado de Medicina Interna"] },
  {
    area: "Emergência",
    refs: [
      "Harrison — Medicina Interna",
      "MS — Protocolos SAMU 192 (SBV e SAV)",
      "MS — Acolhimento com Avaliação e Classificação de Risco",
      "MS — Manual de Diagnóstico e Tratamento de Acidentes por Animais Peçonhentos",
    ],
  },
  { area: "Semiologia", refs: ["Porto — Semiologia Médica", "Bickley — Bates: Propedêutica Médica"] },
];

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Referências permitidas para uma área (núcleo + específicas + diretrizes brasileiras). */
export function refsForArea(area: string): string[] {
  const a = norm(area);
  const hit = AREA_REFS.filter((r) => a.includes(norm(r.area)) || norm(r.area).includes(a));
  const specific = hit.flatMap((h) => h.refs);
  return [...new Set([...CORE_REFS, ...specific, ...BR_GUIDELINES])];
}

/**
 * Bloco de prompt que fecha a IA nesta bibliografia (RAG restritivo).
 * `cite` liga a exigência de citação explícita em cada afirmação.
 */
export function referencesPrompt(area: string, opts?: { cite?: boolean }): string {
  const list = refsForArea(area);
  return `BIBLIOGRAFIA ABSOLUTA (RAG restritivo) — estas são as ÚNICAS fontes de verdade autorizadas:
${list.map((r) => `- ${r}`).join("\n")}

REGRAS INQUEBRÁVEIS DA BIBLIOGRAFIA:
- Toda afirmação clínica (definição, critério, valor de referência, dose, conduta, epidemiologia) deve ser sustentada por uma das obras acima.
- Se algo NÃO estiver contemplado nessas fontes, NÃO use, NÃO invente e NÃO cite outra fonte. Prefira omitir ou dizer que está fora do escopo das referências adotadas.
- Nunca cite artigo, site, escore ou diretriz estrangeira que não esteja na lista. Para conduta no SUS, a referência é sempre o material do Ministério da Saúde listado.${
    opts?.cite
      ? `
- CITE a fonte ao final de cada afirmação relevante, no formato (Autor/Obra — capítulo/tema). Ex.: "(Harrison — Medicina Interna, síndromes coronarianas agudas)".
- Ao final do parecer, inclua a seção "## REFERÊNCIAS" listando apenas as obras da lista que você efetivamente usou.`
      : ""
  }`;
}
