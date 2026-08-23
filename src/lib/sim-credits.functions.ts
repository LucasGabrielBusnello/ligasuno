import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLISHED_URL = "https://ligasuno.com.br";
const WEBHOOK_URL = `${PUBLISHED_URL}/api/public/payments/mp-webhook`;

async function requireAdmin(context: any) {
  const { data } = await context.supabase.rpc("is_admin_master", { _user_id: context.userId });
  if (!data) throw new Error("Acesso restrito ao administrador.");
}

function periodStart(period: "month" | "quarter" | "year" | "all") {
  const now = new Date();
  if (period === "all") return new Date(2000, 0, 1);
  const d = new Date(now);
  if (period === "month") d.setMonth(d.getMonth() - 1);
  if (period === "quarter") d.setMonth(d.getMonth() - 3);
  if (period === "year") d.setFullYear(d.getFullYear() - 1);
  return d;
}

/* ------------------------------- Aluno ---------------------------------- */

export const getMyCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureBalance, loadSimSettings } = await import("./sim-billing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const balance = await ensureBalance(context.userId);
    const settings = await loadSimSettings();
    const { data: ledger } = await supabaseAdmin
      .from("sim_credit_ledger")
      .select("id, kind, credits, tokens, amount_brl, description, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const { data: packages } = await supabaseAdmin
      .from("sim_credit_packages")
      .select("id, name, credits, price_brl")
      .eq("active", true)
      .order("sort");
    return {
      balance: Number(balance),
      tokensPerCredit: settings.tokens_per_credit,
      ledger: ledger ?? [],
      packages: packages ?? [],
    };
  });

export const buyCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ packageId: z.string().uuid(), originUrl: z.string().url() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutPreference } = await import("@/lib/mp.server");
    const { data: pkg } = await supabaseAdmin
      .from("sim_credit_packages")
      .select("*")
      .eq("id", data.packageId)
      .eq("active", true)
      .maybeSingle();
    if (!pkg) throw new Error("Pacote indisponível.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, cpf")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: purchase, error } = await supabaseAdmin
      .from("sim_purchases")
      .insert({
        user_id: context.userId,
        package_id: (pkg as any).id,
        credits: (pkg as any).credits,
        amount_brl: (pkg as any).price_brl,
        provider: "mercadopago",
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const origin = new URL(data.originUrl).origin;
    const pref = await createCheckoutPreference({
      title: `${(pkg as any).credits} créditos — Simulador Clínico`,
      unitPrice: Number((pkg as any).price_brl),
      payerEmail: (profile as any)?.email ?? undefined,
      payerName: (profile as any)?.full_name ?? undefined,
      payerCpf: (profile as any)?.cpf ?? undefined,
      successUrl: `${origin}/aluno?credits=1`,
      failureUrl: `${origin}/aluno?credits=0`,
      externalReference: `credits:${purchase.id}`,
      notificationUrl: WEBHOOK_URL,
      metadata: { user_id: context.userId, purchase_id: purchase.id },
    });
    const url = (pref as any)?.init_point ?? (pref as any)?.sandbox_init_point;
    await supabaseAdmin
      .from("sim_purchases")
      .update({ external_id: String((pref as any)?.id ?? ""), checkout_url: url })
      .eq("id", purchase.id);
    if (!url) throw new Error("Não foi possível abrir o checkout agora. Tente novamente.");
    return { url: url as string };
  });

/** Evolução do aluno no período (média de nota, casos resolvidos/não resolvidos). */
export const getSimProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        period: z.enum(["month", "quarter", "year", "all"]).default("month"),
        userId: z.string().uuid().nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let target = context.userId;
    if (data.userId && data.userId !== context.userId) {
      await requireAdmin(context);
      target = data.userId;
    }
    const since = periodStart(data.period).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("sim_sessions")
      .select("id, score, status, area, level, created_at, finished_at")
      .eq("user_id", target)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const list = (rows ?? []) as any[];
    const finished = list.filter((s) => s.status === "finished" && s.score != null);
    const solved = finished.filter((s) => Number(s.score) >= 60);
    const avg = finished.length
      ? finished.reduce((a, s) => a + Number(s.score), 0) / finished.length
      : 0;
    const half = Math.floor(finished.length / 2);
    const firstAvg = half ? finished.slice(0, half).reduce((a, s) => a + Number(s.score), 0) / half : 0;
    const lastAvg = finished.length - half
      ? finished.slice(half).reduce((a, s) => a + Number(s.score), 0) / (finished.length - half)
      : 0;

    const byArea = new Map<string, { area: string; count: number; sum: number }>();
    for (const s of finished) {
      const key = s.area ?? "Geral";
      const cur = byArea.get(key) ?? { area: key, count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += Number(s.score);
      byArea.set(key, cur);
    }

    return {
      period: data.period,
      total: list.length,
      finished: finished.length,
      abandoned: list.filter((s) => s.status !== "finished").length,
      solved: solved.length,
      unsolved: finished.length - solved.length,
      average: Number(avg.toFixed(1)),
      trend: Number((lastAvg - firstAvg).toFixed(1)),
      series: finished.map((s) => ({
        at: s.finished_at ?? s.created_at,
        score: Number(s.score),
        area: s.area,
        level: s.level,
      })),
      areas: [...byArea.values()]
        .map((a) => ({ area: a.area, count: a.count, average: Number((a.sum / a.count).toFixed(1)) }))
        .sort((a, b) => b.count - a.count),
    };
  });

/* -------------------------------- Admin ---------------------------------- */

export const adminGetSimFinanceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("sim_settings").select("*").eq("id", true).maybeSingle();
    const d = (data ?? {}) as any;
    const { data: packages } = await supabaseAdmin
      .from("sim_credit_packages")
      .select("*")
      .order("sort");
    return {
      settings: {
        chat_model: d.chat_model,
        grade_model: d.grade_model,
        chat_cost_in_brl_per_mtok: Number(d.chat_cost_in_brl_per_mtok ?? 0),
        chat_cost_out_brl_per_mtok: Number(d.chat_cost_out_brl_per_mtok ?? 0),
        grade_cost_in_brl_per_mtok: Number(d.grade_cost_in_brl_per_mtok ?? 0),
        grade_cost_out_brl_per_mtok: Number(d.grade_cost_out_brl_per_mtok ?? 0),
        tokens_per_credit: Number(d.tokens_per_credit ?? 1000),
        gateway_fee_pct: Number(d.gateway_fee_pct ?? 3),
        price_divisor: Number(d.price_divisor ?? 0.47),
        free_credits: Number(d.free_credits ?? 20),
      },
      keys: {
        mercadopago: !!d.mp_access_token_enc,
        openai: !!d.openai_key_enc,
        anthropic: !!d.anthropic_key_enc,
      },
      packages: packages ?? [],
    };
  });

export const adminSaveSimFinanceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        chat_model: z.string().min(2).max(120),
        grade_model: z.string().min(2).max(120),
        chat_cost_in_brl_per_mtok: z.number().min(0),
        chat_cost_out_brl_per_mtok: z.number().min(0),
        grade_cost_in_brl_per_mtok: z.number().min(0),
        grade_cost_out_brl_per_mtok: z.number().min(0),
        tokens_per_credit: z.number().int().min(1),
        gateway_fee_pct: z.number().min(0).max(50),
        price_divisor: z.number().min(0.05).max(1),
        free_credits: z.number().min(0).max(10000),
        mp_access_token: z.string().max(500).nullable().optional(),
        openai_key: z.string().max(500).nullable().optional(),
        anthropic_key: z.string().max(500).nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptString } = await import("@/lib/crypto.server");
    const patch: Record<string, any> = { ...data };
    delete patch.mp_access_token;
    delete patch.openai_key;
    delete patch.anthropic_key;
    if (data.mp_access_token) patch.mp_access_token_enc = await encryptString(data.mp_access_token);
    if (data.openai_key) patch.openai_key_enc = await encryptString(data.openai_key);
    if (data.anthropic_key) patch.anthropic_key_enc = await encryptString(data.anthropic_key);
    const { error } = await supabaseAdmin.from("sim_settings").update(patch as never).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveCreditPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        name: z.string().min(2).max(80),
        credits: z.number().int().min(1),
        price_brl: z.number().min(0),
        active: z.boolean().default(true),
        sort: z.number().int().default(0),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      name: data.name,
      credits: data.credits,
      price_brl: data.price_brl,
      active: data.active,
      sort: data.sort,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("sim_credit_packages").update(row).eq("id", data.id)
      : await supabaseAdmin.from("sim_credit_packages").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCreditPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sim_credit_packages").delete().eq("id", data.id);
    return { ok: true };
  });

/** Busca de usuários para concessão manual de créditos. */
export const adminSearchSimUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ query: z.string().max(120).default("") }).parse(v))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim();
    let sel = supabaseAdmin.from("profiles").select("id, full_name, email, username").limit(15);
    if (q) sel = sel.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,username.ilike.%${q}%`);
    const { data: profiles } = await sel;
    const ids = (profiles ?? []).map((p: any) => p.id);
    const { data: balances } = ids.length
      ? await supabaseAdmin.from("sim_credit_balances").select("user_id, credits").in("user_id", ids)
      : { data: [] as any[] };
    const bal = new Map((balances ?? []).map((b: any) => [b.user_id, Number(b.credits)]));
    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      name: p.full_name || p.username || p.email,
      email: p.email,
      credits: bal.get(p.id) ?? 0,
    }));
  });

/**
 * Ajuste manual de créditos. NÃO conta como dinheiro recebido: entra no
 * ledger como "grant" (cortesia) e não incrementa os créditos comprados.
 */
export const adminGrantCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ userId: z.string().uuid(), credits: z.number(), note: z.string().max(200).default("Ajuste manual") }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureBalance } = await import("./sim-billing.server");
    const current = await ensureBalance(data.userId);
    const next = Math.max(0, Number((current + data.credits).toFixed(4)));
    const { error } = await supabaseAdmin
      .from("sim_credit_balances")
      .update({ credits: next })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("sim_credit_ledger").insert({
      user_id: data.userId,
      kind: "grant",
      credits: Number(data.credits.toFixed(4)),
      amount_brl: 0,
      description: data.note,
    });
    return { balance: next };
  });


/** Log financeiro: um registro por caso clínico + KPIs do período. */
export const adminSimFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ period: z.enum(["month", "quarter", "year", "all"]).default("month") }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSimSettings, priceFromCost } = await import("./sim-billing.server");
    const settings = await loadSimSettings();
    const since = periodStart(data.period).toISOString();

    const { data: usage } = await supabaseAdmin
      .from("sim_usage_events")
      .select("session_id, user_id, total_tokens, cost_brl, credits, created_at")
      .gte("created_at", since)
      .limit(20000);

    const { data: sessions } = await supabaseAdmin
      .from("sim_sessions")
      .select("id, user_id, status, score, area, level, created_at, sim_cases(title)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);

    const userIds = [...new Set((sessions ?? []).map((s: any) => s.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] as any[] };
    const nameOf = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email]));

    const agg = new Map<string, { tokens: number; cost: number; credits: number }>();
    let orphanTokens = 0;
    let orphanCost = 0;
    let orphanCredits = 0;
    for (const u of (usage ?? []) as any[]) {
      if (!u.session_id) {
        orphanTokens += Number(u.total_tokens);
        orphanCost += Number(u.cost_brl);
        orphanCredits += Number(u.credits);
        continue;
      }
      const cur = agg.get(u.session_id) ?? { tokens: 0, cost: 0, credits: 0 };
      cur.tokens += Number(u.total_tokens);
      cur.cost += Number(u.cost_brl);
      cur.credits += Number(u.credits);
      agg.set(u.session_id, cur);
    }

    const fee = settings.gateway_fee_pct / 100;

    /* Parcela PAGA de cada aluno: créditos comprados (dinheiro de verdade) vs
       cortesias/boas-vindas. Só o consumo coberto por créditos comprados vira lucro. */
    const allIds = [...new Set([...(usage ?? []).map((u: any) => u.user_id), ...userIds])].filter(Boolean);
    const paidInfo = new Map<string, { ratio: number; revPerCredit: number }>();
    if (allIds.length) {
      const [{ data: buys }, { data: grants }, { data: spends }] = await Promise.all([
        supabaseAdmin.from("sim_purchases").select("user_id, credits, amount_brl").eq("status", "paid").in("user_id", allIds),
        supabaseAdmin.from("sim_credit_ledger").select("user_id, credits, kind").eq("kind", "grant").in("user_id", allIds),
        supabaseAdmin.from("sim_usage_events").select("user_id, credits").in("user_id", allIds).limit(50000),
      ]);
      const acc = new Map<string, { bought: number; revenue: number; granted: number; spent: number }>();
      const get = (id: string) => {
        const cur = acc.get(id) ?? { bought: 0, revenue: 0, granted: 0, spent: 0 };
        acc.set(id, cur);
        return cur;
      };
      for (const b of (buys ?? []) as any[]) { const a = get(b.user_id); a.bought += Number(b.credits); a.revenue += Number(b.amount_brl); }
      for (const g of (grants ?? []) as any[]) get(g.user_id).granted += Number(g.credits);
      for (const s of (spends ?? []) as any[]) get(s.user_id).spent += Number(s.credits);
      for (const [id, a] of acc) {
        const paidSpent = Math.max(0, Math.min(a.spent - a.granted, a.bought));
        paidInfo.set(id, {
          ratio: a.spent > 0 ? paidSpent / a.spent : 0,
          revPerCredit: a.bought > 0 ? a.revenue / a.bought : 0,
        });
      }
    }

    const rows = (sessions ?? []).map((s: any) => {
      const a = agg.get(s.id) ?? { tokens: 0, cost: 0, credits: 0 };
      const info = paidInfo.get(s.user_id) ?? { ratio: 0, revPerCredit: 0 };
      const paidCredits = a.credits * info.ratio;
      const charged = paidCredits * info.revPerCredit; // receita reconhecida (créditos pagos usados)
      const profit = charged - charged * fee - a.cost * info.ratio;
      return {
        id: s.id,
        title: s.sim_cases?.title ?? "Caso clínico",
        student: nameOf.get(s.user_id) ?? "—",
        area: s.area,
        level: s.level,
        created_at: s.created_at,
        status: s.status,
        score: s.score,
        tokens: a.tokens,
        cost: Number(a.cost.toFixed(4)),
        credits: Number(a.credits.toFixed(2)),
        paid_credits: Number(paidCredits.toFixed(2)),
        charged: Number(charged.toFixed(2)),
        profit: Number(profit.toFixed(2)),
      };
    });

    const totalTokens = rows.reduce((x, r) => x + r.tokens, 0) + orphanTokens;
    const totalCost = rows.reduce((x, r) => x + r.cost, 0) + orphanCost;
    const totalCharged = rows.reduce((x, r) => x + r.charged, 0);
    const totalProfit = rows.reduce((x, r) => x + r.profit, 0);
    const totalPaidCredits = rows.reduce((x, r) => x + r.paid_credits, 0);

    const { data: purchases } = await supabaseAdmin
      .from("sim_purchases")
      .select("amount_brl, status, created_at")
      .eq("status", "paid")
      .gte("created_at", since);
    const revenue = (purchases ?? []).reduce((x: number, p: any) => x + Number(p.amount_brl), 0);


    return {
      settings: { tokensPerCredit: settings.tokens_per_credit, feePct: settings.gateway_fee_pct, divisor: settings.price_divisor },
      kpis: {
        totalTokens,
        totalCost: Number(totalCost.toFixed(2)),
        totalCharged: Number(totalCharged.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2)),
        totalCredits: Number((rows.reduce((x, r) => x + r.credits, 0) + orphanCredits).toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        cases: rows.length,
      },
      rows,
    };
  });

export const adminSimStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ period: z.enum(["month", "quarter", "year", "all"]).default("month") }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = periodStart(data.period).toISOString();
    const { data: sessions } = await supabaseAdmin
      .from("sim_sessions")
      .select("user_id, status, score")
      .gte("created_at", since)
      .limit(20000);
    const map = new Map<string, { total: number; finished: number; solved: number; sum: number }>();
    for (const s of (sessions ?? []) as any[]) {
      const cur = map.get(s.user_id) ?? { total: 0, finished: 0, solved: 0, sum: 0 };
      cur.total += 1;
      if (s.status === "finished" && s.score != null) {
        cur.finished += 1;
        cur.sum += Number(s.score);
        if (Number(s.score) >= 60) cur.solved += 1;
      }
      map.set(s.user_id, cur);
    }
    const ids = [...map.keys()];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as any[] };
    const { data: balances } = ids.length
      ? await supabaseAdmin.from("sim_credit_balances").select("user_id, credits").in("user_id", ids)
      : { data: [] as any[] };
    const bal = new Map((balances ?? []).map((b: any) => [b.user_id, Number(b.credits)]));
    return (profiles ?? []).map((p: any) => {
      const m = map.get(p.id)!;
      return {
        id: p.id,
        name: p.full_name || p.email,
        email: p.email,
        total: m.total,
        finished: m.finished,
        solved: m.solved,
        unsolved: m.finished - m.solved,
        average: m.finished ? Number((m.sum / m.finished).toFixed(1)) : 0,
        credits: bal.get(p.id) ?? 0,
      };
    }).sort((a, b) => b.total - a.total);
  });
