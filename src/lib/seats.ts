// Helpers para mensagens de vagas
export type SeatsState = {
  full: boolean;
  remaining: number | null;
  total: number | null;
  message: string | null;
  severity: "info" | "warning" | "critical" | null;
};

export function computeSeats(maxSeats: number | null | undefined, taken: number): SeatsState {
  if (!maxSeats || maxSeats <= 0) {
    return { full: false, remaining: null, total: null, message: null, severity: null };
  }
  const remaining = Math.max(0, maxSeats - taken);
  if (remaining === 0) {
    return { full: true, remaining: 0, total: maxSeats, message: "Não há mais vagas", severity: "critical" };
  }
  // Avisos absolutos têm prioridade sobre %
  if (remaining <= 10) {
    return { full: false, remaining, total: maxSeats, message: `Restam menos de ${Math.max(remaining, 1)} ${remaining === 1 ? "vaga" : "vagas"}`, severity: "critical" };
  }
  const pct = Math.round((taken / maxSeats) * 100);
  if (pct >= 90) return { full: false, remaining, total: maxSeats, message: "90% das vagas já foram preenchidas", severity: "warning" };
  if (pct >= 80) return { full: false, remaining, total: maxSeats, message: "80% das vagas já foram preenchidas", severity: "warning" };
  if (pct >= 70) return { full: false, remaining, total: maxSeats, message: "70% das vagas já foram preenchidas", severity: "warning" };
  if (pct >= 60) return { full: false, remaining, total: maxSeats, message: "60% das vagas já foram preenchidas", severity: "info" };
  if (pct >= 50) return { full: false, remaining, total: maxSeats, message: "Metade das vagas já foram preenchidas", severity: "info" };
  return { full: false, remaining, total: maxSeats, message: null, severity: null };
}
