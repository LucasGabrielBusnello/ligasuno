/**
 * Economia do simulador clínico: precificação, captura de uso (tokens) e
 * débito automático de créditos. Server-only.
 */

export type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };
export type Tier = "chat" | "grade";

export type SimSettings = {
  chat_model: string;
  grade_model: string;
  chat_cost_in_brl_per_mtok: number;
  chat_cost_out_brl_per_mtok: number;
  grade_cost_in_brl_per_mtok: number;
  grade_cost_out_brl_per_mtok: number;
  tokens_per_credit: number;
  gateway_fee_pct: number;
  price_divisor: number;
  free_credits: number;
};

const DEFAULTS: SimSettings = {
  chat_model: "google/gemini-2.5-flash",
  grade_model: "anthropic/claude-3-5-sonnet-20241022",
  chat_cost_in_brl_per_mtok: 1.8,
  chat_cost_out_brl_per_mtok: 7.2,
  grade_cost_in_brl_per_mtok: 18,
  grade_cost_out_brl_per_mtok: 72,
  tokens_per_credit: 1000,
  gateway_fee_pct: 3,
  price_divisor: 0.47,
  free_credits: 20,
};

export async function loadSimSettings(): Promise<SimSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("sim_settings").select("*").eq("id", true).maybeSingle();
  if (!data) return DEFAULTS;
  const d = data as any;
  return {
    chat_model: d.chat_model ?? DEFAULTS.chat_model,
    grade_model: d.grade_model ?? DEFAULTS.grade_model,
    chat_cost_in_brl_per_mtok: Number(d.chat_cost_in_brl_per_mtok ?? DEFAULTS.chat_cost_in_brl_per_mtok),
    chat_cost_out_brl_per_mtok: Number(d.chat_cost_out_brl_per_mtok ?? DEFAULTS.chat_cost_out_brl_per_mtok),
    grade_cost_in_brl_per_mtok: Number(d.grade_cost_in_brl_per_mtok ?? DEFAULTS.grade_cost_in_brl_per_mtok),
    grade_cost_out_brl_per_mtok: Number(d.grade_cost_out_brl_per_mtok ?? DEFAULTS.grade_cost_out_brl_per_mtok),
    tokens_per_credit: Number(d.tokens_per_credit ?? DEFAULTS.tokens_per_credit) || 1000,
    gateway_fee_pct: Number(d.gateway_fee_pct ?? DEFAULTS.gateway_fee_pct),
    price_divisor: Number(d.price_divisor ?? DEFAULTS.price_divisor) || 0.47,
    free_credits: Number(d.free_credits ?? DEFAULTS.free_credits),
  };
}

/** Custo bruto pago à API (R$) para um uso de tokens. */
export function costOfUsage(u: Usage, tier: Tier, s: SimSettings): number {
  const cin = tier === "grade" ? s.grade_cost_in_brl_per_mtok : s.chat_cost_in_brl_per_mtok;
  const cout = tier === "grade" ? s.grade_cost_out_brl_per_mtok : s.chat_cost_out_brl_per_mtok;
  return (u.prompt_tokens / 1_000_000) * cin + (u.completion_tokens / 1_000_000) * cout;
}

/** Preço final ao cliente = custo base / divisor (padrão 0,47 → 50% lucro + 3% gateway). */
export function priceFromCost(costBrl: number, s: SimSettings): number {
  return costBrl / (s.price_divisor || 0.47);
}

/** Saldo atual do aluno, criando a carteira com os créditos gratuitos na primeira vez. */
export async function ensureBalance(userId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("sim_credit_balances")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return Number((data as any).credits);
  const s = await loadSimSettings();
  await supabaseAdmin.from("sim_credit_balances").insert({ user_id: userId, credits: s.free_credits });
  await supabaseAdmin.from("sim_credit_ledger").insert({
    user_id: userId,
    kind: "grant",
    credits: s.free_credits,
    description: "Créditos de boas-vindas",
  });
  return s.free_credits;
}

export class NoCreditsError extends Error {
  constructor() {
    super("Seus créditos de treino acabaram. Recarregue para continuar a simulação.");
    this.name = "NoCreditsError";
  }
}

/** Bloqueia a chamada quando o aluno está sem saldo. */
export async function assertCredits(userId: string) {
  const balance = await ensureBalance(userId);
  if (balance <= 0) throw new NoCreditsError();
  return balance;
}

/**
 * Registra o uso de tokens e debita os créditos correspondentes
 * (1 crédito = tokens_per_credit tokens, fração inclusa).
 */
export async function recordUsage(args: {
  userId: string;
  sessionId?: string | null;
  phase: string;
  model: string;
  usage: Usage | null;
  tier: Tier;
}): Promise<{ credits: number; balance: number; cost: number; tokens: number }> {
  const u = args.usage;
  if (!u || !u.total_tokens) return { credits: 0, balance: await ensureBalance(args.userId), cost: 0, tokens: 0 };
  const s = await loadSimSettings();
  const cost = costOfUsage(u, args.tier, s);
  const credits = u.total_tokens / (s.tokens_per_credit || 1000);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await ensureBalance(args.userId);
  await supabaseAdmin.from("sim_usage_events").insert({
    session_id: args.sessionId ?? null,
    user_id: args.userId,
    phase: args.phase,
    model: args.model,
    prompt_tokens: u.prompt_tokens,
    completion_tokens: u.completion_tokens,
    total_tokens: u.total_tokens,
    cost_brl: Number(cost.toFixed(6)),
    credits: Number(credits.toFixed(4)),
  });
  const { data: balance } = await supabaseAdmin.rpc("sim_debit_credits", {
    _user_id: args.userId,
    _session_id: (args.sessionId ?? null) as string,
    _credits: Number(credits.toFixed(4)),
    _tokens: u.total_tokens,
    _cost: Number(cost.toFixed(6)),
    _description: args.phase,
  });
  return { credits, balance: Number(balance ?? 0), cost, tokens: u.total_tokens };
}
