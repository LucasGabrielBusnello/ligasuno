/** Imagens ilustrativas para exames complementares do simulador. */

export type ExamImage = { label: string; url: string };

const norm = (s: string) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Rule = { url: string; label: string; test: (name: string, ctx: string) => boolean };

const RULES: Rule[] = [
  {
    url: "/sim-exams/ecg-supra-st.jpg",
    label: "Eletrocardiograma — supradesnivelamento de ST",
    test: (n, c) =>
      /(ecg|eletrocardiograma)/.test(n) &&
      /(supra|st elevad|infarto|iam|isquemi|sca)/.test(`${n} ${c}`),
  },
  {
    url: "/sim-exams/ecg-normal.jpg",
    label: "Eletrocardiograma de 12 derivações",
    test: (n) => /(ecg|eletrocardiograma)/.test(n),
  },
  {
    url: "/sim-exams/rx-torax-consolidacao.jpg",
    label: "Radiografia de tórax — consolidação",
    test: (n, c) =>
      /(torax|pulm)/.test(n) &&
      /(rx|raio|radiograf)/.test(n) &&
      /(consolida|pneumonia|infiltrad|opacidad|derrame|congest)/.test(`${n} ${c}`),
  },
  {
    url: "/sim-exams/rx-torax-normal.jpg",
    label: "Radiografia de tórax",
    test: (n) => /(rx|raio|radiograf)/.test(n) && /(torax|pulm)/.test(n),
  },
  {
    url: "/sim-exams/rx-abdome.jpg",
    label: "Radiografia de abdome",
    test: (n) => /(rx|raio|radiograf)/.test(n) && /(abdome|abdominal)/.test(n),
  },
  {
    url: "/sim-exams/rx-fratura.jpg",
    label: "Radiografia osteoarticular",
    test: (n) =>
      /(rx|raio|radiograf)/.test(n) &&
      /(fratura|punho|antebraco|mao|joelho|tornozelo|osso|ossea|coluna|quadril|ombro)/.test(n),
  },
  {
    url: "/sim-exams/tc-cranio-avc.jpg",
    label: "Tomografia de crânio (corte axial)",
    test: (n) => /(tc|tomografia|cranio|cranica|cranio)/.test(n) && /(cranio|cranian|encefalo|cerebr)/.test(n),
  },
  {
    url: "/sim-exams/usg-abdome.jpg",
    label: "Ultrassonografia abdominal",
    test: (n) => /(usg|ultrass|ecografia)/.test(n) && /(abdome|abdominal|hepat|vesic|biliar|rim|renal)/.test(n),
  },
];

/** Retorna uma imagem ilustrativa coerente com o exame pedido, ou null. */
export function imageForExam(examName: string, context = ""): ExamImage | null {
  const n = norm(examName);
  const c = norm(context);
  const hit = RULES.find((r) => r.test(n, c));
  return hit ? { label: hit.label, url: hit.url } : null;
}
