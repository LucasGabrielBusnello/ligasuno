/**
 * Coerência de sexo do paciente. Casos gerados por IA às vezes trazem nome
 * feminino com gender "masculino" (e vice-versa). O nome próprio é a evidência
 * mais visível para o aluno, então ele manda na correção.
 */

const FEM_EXCEPTIONS = new Set(["luca", "nicola", "sasha", "andrea"]);
const MASC_ENDING_A = new Set(["joshua", "elias", "tobias", "matias", "isaias", "jonas", "lucas", "thomas", "nicolas", "dimas"]);

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Deduz o sexo pelo primeiro nome (heurística pt-BR). null quando não dá para saber. */
export function genderFromName(name: string): "masculino" | "feminino" | null {
  const first = norm(name).split(/\s+/)[0] ?? "";
  if (!first || first.length < 3) return null;
  if (MASC_ENDING_A.has(first)) return "masculino";
  if (FEM_EXCEPTIONS.has(first)) return "masculino";
  if (/(a|ia|ana|ice|ete|ilda|inha)$/.test(first)) return "feminino";
  if (/(o|os|or|el|il|son|ton|ir|ur|im|us|au)$/.test(first)) return "masculino";
  return null;
}

/** Devolve o paciente com `gender` coerente com o nome, quando o nome for conclusivo. */
export function fixPatientGender<T extends { name?: string | null; gender?: string | null }>(patient: T): T {
  const guess = genderFromName(String(patient?.name ?? ""));
  if (!guess) return patient;
  const current = norm(String(patient?.gender ?? ""));
  const currentNorm = /^f/.test(current) ? "feminino" : /^m/.test(current) ? "masculino" : null;
  if (currentNorm === guess) return patient;
  return { ...patient, gender: guess };
}
