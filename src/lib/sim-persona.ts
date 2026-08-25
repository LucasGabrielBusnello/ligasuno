/**
 * Variáveis comportamentais do Paciente IA.
 * Sorteadas localmente (custo zero) no início de cada caso e guardadas na sessão.
 */

export type SimPersona = {
  scenario: "UBS" | "Emergência" | "Ambulatório";
  age: number | null;
  occupation: string;
  hard: boolean;
  poliqueixoso: boolean;
  anxiety: number;
  omission: number;
  verbosity: number;
  lay_level: number;
  hostility: number;
  waited_long: boolean;
};

const SCENARIOS: SimPersona["scenario"][] = ["UBS", "Emergência", "Ambulatório"];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(n: number, min = 0, max = 10) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Prolixidade em curva de sino forçada: 70% 4-6, 15% 7-10, 15% 0-3. */
function bellVerbosity() {
  const r = Math.random();
  if (r < 0.7) return rnd(4, 6);
  if (r < 0.85) return rnd(7, 10);
  return rnd(0, 3);
}

/**
 * Regra de balanceamento: 70% dos casos são fáceis/normais,
 * só 30% concentram as variáveis difíceis.
 */
export function buildPersona(input: {
  age?: number | null;
  occupation?: string | null;
  area?: string | null;
  level?: number | null;
  baseAnxiety?: number | null;
  sensitiveTopic?: boolean;
}): SimPersona {
  const hard = Math.random() < 0.3;
  const scenario = SCENARIOS[rnd(0, SCENARIOS.length - 1)]!;
  const age = input.age ?? null;

  // Poliqueixoso: bem mais provável na UBS.
  const poliChance = scenario === "UBS" ? (hard ? 0.75 : 0.35) : hard ? 0.3 : 0.08;
  const poliqueixoso = Math.random() < poliChance;

  // Matriz de ansiedade = base da patologia + variância (-2 a +2); 10% quebram o estereótipo.
  const base = Number(input.baseAnxiety ?? (scenario === "Emergência" ? 7 : 4));
  let anxiety = clamp(base + rnd(-2, 2));
  if (Math.random() < 0.1) anxiety = clamp(10 - anxiety);

  // Omissão/vergonha só faz sentido em temas sensíveis.
  const omission = input.sensitiveTopic ? (hard ? rnd(45, 90) : rnd(10, 40)) : 0;

  // Hostilidade: 80% dos pacientes entre 3 e 6; extremos são minoria.
  const waited_long = Math.random() < (scenario === "Emergência" ? 0.5 : 0.2);
  const elderly = (age ?? 0) >= 65;
  const juniorStudent = Number(input.level ?? 3) <= 2;
  const hr = Math.random();
  let hostility = hr < 0.8 ? rnd(3, 6) : hr < 0.9 ? rnd(0, 2) : rnd(7, 10);
  if (waited_long) hostility += 2;
  if (elderly && juniorStudent) hostility += 2;

  return {
    scenario,
    age,
    occupation: input.occupation ?? "não informada",
    hard,
    poliqueixoso,
    anxiety,
    omission,
    verbosity: bellVerbosity(),
    lay_level: hard ? rnd(0, 4) : rnd(3, 7),
    hostility: clamp(hostility),
    waited_long,
  };
}

/** Bloco de instruções que entra no system prompt do paciente. */
export function personaPrompt(p: SimPersona): string {
  return `CENÁRIO DO ATENDIMENTO: ${p.scenario}${p.waited_long ? " (o paciente esperou muito tempo na triagem)" : ""}.
Profissão: ${p.occupation}${p.age ? ` | Idade: ${p.age} anos` : ""}.

VARIÁVEIS COMPORTAMENTAIS (interprete, nunca as cite):
- POLIQUEIXOSO: ${p.poliqueixoso ? "SIM — traga várias queixas misturadas e desorganizadas; a queixa principal precisa ser garimpada pelo estudante." : "não — mantenha o foco na queixa principal."}
- ANSIEDADE ${p.anxiety}/10: ${p.anxiety >= 7 ? "fala acelerada, medo de doença grave, repete perguntas." : p.anxiety >= 4 ? "preocupação normal." : "calmo, até despreocupado demais."}
- OMISSÃO/VERGONHA ${p.omission}%: aplica-se SOMENTE a temas sensíveis (ISTs, uso de drogas/álcool, saúde mental, sexualidade). Nesses temas, minimize ou negue no primeiro momento e só admita se o estudante perguntar de forma acolhedora e direta. NUNCA omita medicações de uso contínuo, doenças crônicas comuns ou cirurgias prévias por vergonha.
- PROLIXIDADE ${p.verbosity}/10: ${p.verbosity >= 7 ? "conta histórias paralelas antes de responder." : p.verbosity >= 4 ? "responde no tamanho certo, com um detalhe extra às vezes." : "respostas secas, monossilábicas; precisa ser puxado."}
- LEIGUICE ${p.lay_level}/10: use termos populares reais e falsos positivos, como "dor nos rins" para dor lombar, "fígado atacado" para dispepsia, "pressão subiu" para cefaleia, "gastrite nervosa", "labirintite" para tontura. Nunca use nome de doença correto por acaso técnico.
- HOSTILIDADE ${p.hostility}/10: ${p.hostility >= 6 ? "comece desconfiado e ríspido ('cadê o médico de verdade?', 'faz duas horas que estou aqui'); só relaxe se o estudante for empático e se apresentar bem." : p.hostility >= 3 ? "impaciente no início, colabora depois." : "colaborativo desde o começo."}`;
}
