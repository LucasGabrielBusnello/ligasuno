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
  /** Teto de consumo por caso clínico (timeout de segurança). */
  max_tokens_per_case: number;
  /** 1 crédito = 1 caso clínico iniciado. */
  credits_per_case: number;
};

const DEFAULTS: SimSettings = {
  chat_model: "google/gemini-2.5-flash",
  grade_model: "anthropic/claude-3-5-sonnet-20240620",
  chat_cost_in_brl_per_mtok: 1.8,
  chat_cost_out_brl_per_mtok: 7.2,
  grade_cost_in_brl_per_mtok: 18,
  grade_cost_out_brl_per_mtok: 72,
  tokens_per_credit: 1000,
  gateway_fee_pct: 3,
  price_divisor: 0.47,
  free_credits: 20,
  max_tokens_per_case: 300_000,
  credits_per_case: 1,
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
    max_tokens_per_case: Number(d.max_tokens_per_case ?? DEFAULTS.max_tokens_per_case) || DEFAULTS.max_tokens_per_case,
    credits_per_case: Number(d.credits_per_case ?? DEFAULTS.credits_per_case),
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
 * Cobra 1 crédito (credits_per_case) pelo caso clínico iniciado.
 * A partir daqui o aluno usa o caso à vontade até o teto de tokens.
 */
export async function chargeCaseStart(userId: string, sessionId: string): Promise<number> {
  const s = await loadSimSettings();
  const credits = Number(s.credits_per_case ?? 1);
  await ensureBalance(userId);
  if (credits <= 0) return await ensureBalance(userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: balance } = await supabaseAdmin.rpc("sim_debit_credits", {
    _user_id: userId,
    _session_id: sessionId,
    _credits: credits,
    _tokens: 0,
    _cost: 0,
    _description: "Caso clínico iniciado",
  });
  return Number(balance ?? 0);
}

export const TIMEOUT_MESSAGE =
  "O tempo de consulta esgotou. O Preceptor precisou assumir a consulta devido à demora no atendimento. Dê sua hipótese diagnóstica para receber o parecer do preceptor.";

/** Estado do teto de tokens de uma sessão (timeout de segurança). */
export async function sessionTokenState(sessionId: string): Promise<{ tokens: number; cap: number; capReached: boolean }> {
  const s = await loadSimSettings();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("sim_sessions").select("tokens_used").eq("id", sessionId).maybeSingle();
  const tokens = Number((data as any)?.tokens_used ?? 0);
  return { tokens, cap: s.max_tokens_per_case, capReached: tokens >= s.max_tokens_per_case };
}

/**
 * Registra o uso de tokens para o painel financeiro e acumula o consumo da
 * sessão. Os créditos NÃO são debitados por token: 1 crédito = 1 caso clínico.
 * Retorna capReached=true quando a sessão bateu o teto de segurança.
 */
export async function recordUsage(args: {
  userId: string;
  sessionId?: string | null;
  phase: string;
  model: string;
  usage: Usage | null;
  tier: Tier;
}): Promise<{ credits: number; balance: number; cost: number; tokens: number; sessionTokens: number; cap: number; capReached: boolean }> {
  const s = await loadSimSettings();
  const cap = s.max_tokens_per_case;
  const u = args.usage;
  if (!u || !u.total_tokens) {
    const st = args.sessionId ? await sessionTokenState(args.sessionId) : { tokens: 0, cap, capReached: false };
    return { credits: 0, balance: await ensureBalance(args.userId), cost: 0, tokens: 0, sessionTokens: st.tokens, cap, capReached: st.capReached };
  }
  const cost = costOfUsage(u, args.tier, s);
  const credits = u.total_tokens / (s.tokens_per_credit || 1000);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const balance = await ensureBalance(args.userId);
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

  let sessionTokens = 0;
  if (args.sessionId) {
    const { data: total } = await supabaseAdmin.rpc("sim_add_session_tokens", {
      _session_id: args.sessionId,
      _tokens: u.total_tokens,
    });
    sessionTokens = Number(total ?? 0);
  }

  return {
    credits,
    balance,
    cost,
    tokens: u.total_tokens,
    sessionTokens,
    cap,
    capReached: !!args.sessionId && sessionTokens >= cap,
  };
}

