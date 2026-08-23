/**
 * Catálogo padrão de manobras de exame físico do simulador.
 * Usado tanto no cliente (lista de manobras) quanto no servidor
 * (detecção do que o aluno disse que ia fazer).
 */

export type ExamCatalogItem = {
  key: string;
  label: string;
  group: string;
  sound_category: "cardiaca" | "pulmonar" | "abdominal" | "carotida" | "percussao" | "nenhum";
  keywords: string[];
};

export const PHYSICAL_EXAM_CATALOG: ExamCatalogItem[] = [
  // Geral
  { key: "inspecao_geral", label: "Inspeção geral", group: "Geral", sound_category: "nenhum", keywords: ["inspecao geral", "estado geral", "olhar o paciente", "inspecionar"] },
  { key: "sinais_vitais", label: "Sinais vitais", group: "Geral", sound_category: "nenhum", keywords: ["sinais vitais", "pressao arterial", "medir a pressao", "aferir", "saturacao", "temperatura", "frequencia cardiaca"] },
  { key: "estado_hidratacao", label: "Hidratação e perfusão", group: "Geral", sound_category: "nenhum", keywords: ["hidratacao", "perfusao", "enchimento capilar", "turgor"] },
  { key: "pele_mucosas", label: "Pele e mucosas", group: "Geral", sound_category: "nenhum", keywords: ["pele", "mucosa", "ictericia", "palidez", "cianose", "lesao de pele"] },
  { key: "nivel_consciencia", label: "Nível de consciência (Glasgow)", group: "Geral", sound_category: "nenhum", keywords: ["consciencia", "glasgow", "orientado", "responsivo"] },

  // Cabeça e pescoço
  { key: "orofaringe", label: "Oroscopia / garganta", group: "Cabeça e pescoço", sound_category: "nenhum", keywords: ["garganta", "oroscopia", "orofaringe", "boca", "amigdala"] },
  { key: "otoscopia", label: "Otoscopia", group: "Cabeça e pescoço", sound_category: "nenhum", keywords: ["otoscopia", "ouvido", "orelha"] },
  { key: "olhos_pupilas", label: "Olhos e pupilas", group: "Cabeça e pescoço", sound_category: "nenhum", keywords: ["pupila", "olho", "fotorreagente", "fundo de olho"] },
  { key: "linfonodos", label: "Palpação de linfonodos", group: "Cabeça e pescoço", sound_category: "nenhum", keywords: ["linfonodo", "ganglio", "cadeia cervical"] },
  { key: "tireoide", label: "Palpação da tireoide", group: "Cabeça e pescoço", sound_category: "nenhum", keywords: ["tireoide", "tiroide", "bocio"] },
  { key: "ausculta_carotidas", label: "Ausculta das carótidas", group: "Cabeça e pescoço", sound_category: "carotida", keywords: ["carotida", "carotidas"] },
  { key: "turgencia_jugular", label: "Turgência jugular", group: "Cabeça e pescoço", sound_category: "nenhum", keywords: ["jugular", "turgencia", "estase jugular"] },

  // Cardiovascular
  { key: "ausculta_cardiaca", label: "Ausculta cardíaca", group: "Cardiovascular", sound_category: "cardiaca", keywords: ["ausculta cardiaca", "auscultar o coracao", "auscultar seu coracao", "coracao", "bulhas", "sopro"] },
  { key: "palpacao_precordio", label: "Palpação do precórdio (ictus)", group: "Cardiovascular", sound_category: "nenhum", keywords: ["ictus", "precordio", "palpar o coracao"] },
  { key: "pulsos_perifericos", label: "Pulsos periféricos", group: "Cardiovascular", sound_category: "nenhum", keywords: ["pulso", "pulsos", "radial", "pedioso", "femoral"] },
  { key: "edema_mmii", label: "Edema de membros inferiores", group: "Cardiovascular", sound_category: "nenhum", keywords: ["edema", "inchaco na perna", "cacifo", "membros inferiores"] },
  { key: "panturrilhas", label: "Exame das panturrilhas (TVP)", group: "Cardiovascular", sound_category: "nenhum", keywords: ["panturrilha", "homans", "empastamento", "tvp"] },

  // Respiratório
  { key: "inspecao_torax", label: "Inspeção do tórax", group: "Respiratório", sound_category: "nenhum", keywords: ["inspecao do torax", "expansibilidade", "tiragem", "esforco respiratorio"] },
  { key: "palpacao_torax", label: "Palpação torácica / frêmito", group: "Respiratório", sound_category: "nenhum", keywords: ["fremito", "palpar o torax", "palpacao toracica"] },
  { key: "percussao_torax", label: "Percussão do tórax", group: "Respiratório", sound_category: "percussao", keywords: ["percutir o torax", "percussao do torax", "percussao pulmonar", "percutir o pulmao", "percutir o torax dele"] },
  { key: "ausculta_pulmonar", label: "Ausculta pulmonar", group: "Respiratório", sound_category: "pulmonar", keywords: ["ausculta pulmonar", "auscultar o pulmao", "auscultar seus pulmoes", "pulmao", "murmurio vesicular", "sibilo", "estertor"] },

  // Abdome
  { key: "inspecao_abdome", label: "Inspeção do abdome", group: "Abdome", sound_category: "nenhum", keywords: ["inspecao do abdome", "olhar a barriga", "abdome globoso", "cicatriz"] },
  { key: "ausculta_abdome", label: "Ausculta abdominal (RHA)", group: "Abdome", sound_category: "abdominal", keywords: ["ausculta abdominal", "auscultar o abdome", "ruidos hidroaereos", "rha", "auscultar a barriga"] },
  { key: "percussao_abdome", label: "Percussão do abdome", group: "Abdome", sound_category: "percussao", keywords: ["percutir o abdome", "percussao do abdome", "percutir a barriga", "macicez movel", "espaco de traube", "loja hepatica"] },
  { key: "palpacao_abdome", label: "Palpação do abdome", group: "Abdome", sound_category: "nenhum", keywords: ["palpar o abdome", "palpacao do abdome", "palpar a barriga", "descompressao", "blumberg", "murphy"] },
  { key: "hepatimetria", label: "Hepatimetria / baço", group: "Abdome", sound_category: "nenhum", keywords: ["figado", "hepatimetria", "baco", "esplenomegalia", "hepatomegalia"] },
  { key: "giordano", label: "Punho-percussão lombar (Giordano)", group: "Abdome", sound_category: "percussao", keywords: ["giordano", "punho percussao", "percutir a lombar", "loja renal"] },

  // Neuro e locomotor
  { key: "forca_muscular", label: "Força muscular", group: "Neurológico", sound_category: "nenhum", keywords: ["forca muscular", "forca nos bracos", "paresia", "hemiparesia"] },
  { key: "reflexos", label: "Reflexos tendinosos", group: "Neurológico", sound_category: "nenhum", keywords: ["reflexo", "patelar", "babinski", "martelo"] },
  { key: "sensibilidade", label: "Sensibilidade", group: "Neurológico", sound_category: "nenhum", keywords: ["sensibilidade", "tato", "parestesia"] },
  { key: "sinais_meningeos", label: "Sinais meníngeos", group: "Neurológico", sound_category: "nenhum", keywords: ["rigidez de nuca", "kernig", "brudzinski", "sinais meningeos"] },
  { key: "marcha_equilibrio", label: "Marcha e equilíbrio", group: "Neurológico", sound_category: "nenhum", keywords: ["marcha", "equilibrio", "romberg", "andar"] },
  { key: "pares_cranianos", label: "Pares cranianos", group: "Neurológico", sound_category: "nenhum", keywords: ["pares cranianos", "nervo facial", "desvio de rima"] },
  { key: "exame_articular", label: "Exame osteoarticular", group: "Locomotor", sound_category: "nenhum", keywords: ["articulacao", "joelho", "ombro", "coluna", "amplitude de movimento", "lasegue"] },
];

export const norm = (s: string) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Detecta, pelo texto do aluno, quais manobras de exame físico ele quis realizar. */
export function detectExamKeys(message: string): string[] {
  const t = norm(message);
  const hits = new Set<string>();
  for (const item of PHYSICAL_EXAM_CATALOG) {
    if (item.keywords.some((k) => t.includes(norm(k)))) hits.add(item.key);
  }
  // Percussão dita de forma genérica: escolhe pela região citada.
  if (/percut|percuss/.test(t)) {
    if (/abdome|barriga|ventre/.test(t)) hits.add("percussao_abdome");
    if (/torax|pulm|peito|costas/.test(t)) hits.add("percussao_torax");
    if (/lombar|renal|rim/.test(t)) hits.add("giordano");
    if (!/abdome|barriga|ventre|torax|pulm|peito|costas|lombar|renal|rim/.test(t)) hits.add("percussao_torax");
  }
  return [...hits];
}

export function catalogItem(key: string) {
  return PHYSICAL_EXAM_CATALOG.find((i) => i.key === key) ?? null;
}
