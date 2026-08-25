/** Níveis de dificuldade do simulador (client-safe). 7 = Pré-Residência. */
export const SIM_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

export const PRE_RESIDENCIA_LEVEL = 7;

export function levelLabel(level: number): string {
  return Number(level) === PRE_RESIDENCIA_LEVEL ? "Pré-Residência" : `${Number(level)}º ano`;
}
