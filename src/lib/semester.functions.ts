import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeFee,
  createPixPayment,
  createSplitPreference,
  getPayment,
  loadFeeForCategory,
  loadLeagueMpAccount,
} from "@/lib/mp.server";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";
import { sendGmail, sendGmailBulk, emailLayout, emailInfoCard } from "@/lib/gmail.server";

/** Lê o valor padrão de semestralidade definido pelo CAMED (em centavos). */
async function loadCamedDefaultSemesterCents(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("camed_settings")
    .select("semestrality_fee")
    .eq("id", 1)
    .maybeSingle();
  const reais = Number((data as any)?.semestrality_fee ?? 0) || 0;
  return Math.round(reais * 100);
}

/** True se o usuário é presidente da liga (president_id) ou tem role 'presidente'/'diretor'. */
async function isLeaderOf(leagueId: string, userId: string, leaguePresidentId?: string | null): Promise<boolean> {
  if (leaguePresidentId && leaguePresidentId === userId) return true;
  const { data } = await supabaseAdmin
    .from("league_memberships")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (data as any)?.role;
  return role === "presidente" || role === "diretor";
}

const PUBLISHED_URL = "https://ligasuno.com.br";
const WEBHOOK_URL = `${PUBLISHED_URL}/api/public/payments/mp-webhook`;

// ------------------ helpers ------------------

function currentSemester(d = new Date()): { semester: 1 | 2; year: number; start_date: string; end_date: string } {
  const month = d.getUTCMonth() + 1; // 1-12
  const year = d.getUTCFullYear();
  if (month <= 6) {
    return { semester: 1, year, start_date: `${year}-01-01`, end_date: `${year}-06-30` };
  }
  return { semester: 2, year, start_date: `${year}-07-01`, end_date: `${year}-12-31` };
}

async function assertPresident(supabase: any, leagueId: string, userId: string) {
  const { data: l } = await supabase
    .from("leagues")
    .select("id, president_id, president2_id, name, slug, theme_color")
    .eq("id", leagueId)
    .maybeSingle();
  if (!l) throw new Error("Liga não encontrada");
  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();
  const isAdmin = !!roleRow;
  if (l.president_id !== userId && (l as any).president2_id !== userId && !isAdmin) throw new Error("Apenas o presidente pode gerenciar a semestralidade");
  return l;
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ------------------ ensure / get current cycle ------------------

/**
 * Garante linha de payment para cada ligante/diretor ativo, usando o valor correto
 * conforme o papel: diretores e o presidente usam `directorAmountCents`, demais
 * usam o `amountCents` (padrão do CAMED).
 */
async function ensurePaymentsForCycle(
  cycleId: string,
  leagueId: string,
  amountCents: number,
  directorAmountCents: number,
  presidentId: string | null,
) {
  const { data: members } = await supabaseAdmin
    .from("league_memberships")
    .select("user_id, role")
    .eq("league_id", leagueId)
    .in("role", ["ligante", "diretor", "presidente"]);
  const list = (members ?? []) as Array<{ user_id: string; role: string }>;
  // Garante o presidente mesmo sem linha em memberships
  if (presidentId && !list.some((m) => m.user_id === presidentId)) {
    list.push({ user_id: presidentId, role: "presidente" });
  }
  if (!list.length) return;

  for (const m of list) {
    const isLeader =
      m.role === "diretor" ||
      m.role === "presidente" ||
      (presidentId && m.user_id === presidentId);
    const due = isLeader ? directorAmountCents : amountCents;
    await supabaseAdmin
      .from("semester_payments")
      .upsert(
        {
          cycle_id: cycleId,
          league_id: leagueId,
          user_id: m.user_id,
          status: "pending" as const,
          amount_due_cents: due,
        },
        { onConflict: "cycle_id,user_id", ignoreDuplicates: true },
      );
  }
}

// ------------------ get current cycle (público p/ membros) ------------------

export const getCurrentSemesterCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ league_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: cycle } = await supabaseAdmin
      .from("semester_cycles")
      .select("*")
      .eq("league_id", data.league_id)
      .eq("is_current", true)
      .maybeSingle();
    const camedDefaultCents = await loadCamedDefaultSemesterCents();
    return { cycle: cycle ?? null, camed_default_cents: camedDefaultCents };
  });

// ------------------ president: list payments for current cycle ------------------

export const listCyclePayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    league_id: z.string().uuid(),
    cycle_id: z.string().uuid().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPresident(context.supabase, data.league_id, context.userId);

    let cycleId = data.cycle_id;
    if (!cycleId) {
      const { data: cur } = await supabaseAdmin
        .from("semester_cycles").select("id").eq("league_id", data.league_id).eq("is_current", true).maybeSingle();
      cycleId = cur?.id;
    }
    const camedDefaultCents = await loadCamedDefaultSemesterCents();
    if (!cycleId) return { cycle: null, payments: [], camed_default_cents: camedDefaultCents };

    const { data: cycle } = await supabaseAdmin
      .from("semester_cycles").select("*").eq("id", cycleId).maybeSingle();

    const { data: payments } = await supabaseAdmin
      .from("semester_payments")
      .select("*, profiles!semester_payments_user_id_fkey(username, full_name, email)")
      .eq("cycle_id", cycleId);

    return { cycle, payments: payments ?? [], camed_default_cents: camedDefaultCents };
  });

// ------------------ president: list all cycles (history) ------------------

export const listSemesterCycles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ league_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPresident(context.supabase, data.league_id, context.userId);
    const { data: cycles } = await supabaseAdmin
      .from("semester_cycles")
      .select("*")
      .eq("league_id", data.league_id)
      .order("year", { ascending: false })
      .order("semester", { ascending: false });
    return { cycles: cycles ?? [] };
  });

// ------------------ president: create or update current cycle ------------------

const upsertSchema = z.object({
  league_id: z.string().uuid(),
  amount_cents: z.number().int().min(0).optional(),
  director_amount_cents: z.number().int().min(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  late_fee_cents: z.number().int().min(0).default(0),
  notify: z.boolean().default(true),
});

export const upsertCurrentSemesterCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const league = await assertPresident(context.supabase, data.league_id, context.userId);
    const brand = (league as any).theme_color || "#1f5132";

    // Valor dos ligantes é definido pelo presidente; se não informado, usa o padrão do CAMED.
    const camedAmountCents =
      data.amount_cents && data.amount_cents > 0
        ? data.amount_cents
        : await loadCamedDefaultSemesterCents();
    if (!camedAmountCents) {
      throw new Error("Defina o valor da semestralidade para os ligantes.");
    }


    const period = currentSemester();
    const { data: existing } = await supabaseAdmin
      .from("semester_cycles")
      .select("id")
      .eq("league_id", data.league_id)
      .eq("is_current", true)
      .maybeSingle();

    let cycleId = existing?.id;

    if (cycleId) {
      await supabaseAdmin
        .from("semester_cycles")
        .update({
          amount_cents: camedAmountCents,
          director_amount_cents: data.director_amount_cents,
          due_date: data.due_date,
          late_fee_cents: data.late_fee_cents,
        })
        .eq("id", cycleId);

      // Atualiza valor devido nos pagamentos pendentes, conforme o papel do usuário.
      const { data: pendings } = await supabaseAdmin
        .from("semester_payments")
        .select("id, user_id, league_memberships:user_id(role)")
        .eq("cycle_id", cycleId)
        .in("status", ["pending", "overdue"]);
      // Como o join via FK pode não existir, busca roles em batch.
      const userIds = (pendings ?? []).map((p: any) => p.user_id);
      const { data: mems } = await supabaseAdmin
        .from("league_memberships")
        .select("user_id, role")
        .eq("league_id", data.league_id)
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const roleByUser = new Map<string, string>();
      (mems ?? []).forEach((m: any) => roleByUser.set(m.user_id, m.role));
      for (const p of pendings ?? []) {
        const role = roleByUser.get((p as any).user_id);
        const isLeader =
          role === "diretor" || role === "presidente" || (league as any).president_id === (p as any).user_id || (league as any).president2_id === (p as any).user_id;
        await supabaseAdmin
          .from("semester_payments")
          .update({ amount_due_cents: isLeader ? data.director_amount_cents : camedAmountCents })
          .eq("id", (p as any).id);
      }
    } else {
      const { data: newCycle, error } = await supabaseAdmin
        .from("semester_cycles")
        .insert({
          league_id: data.league_id,
          semester: period.semester,
          year: period.year,
          start_date: period.start_date,
          end_date: period.end_date,
          amount_cents: camedAmountCents,
          director_amount_cents: data.director_amount_cents,
          due_date: data.due_date,
          late_fee_cents: data.late_fee_cents,
          is_current: true,
        })
        .select("id")
        .single();
      if (error || !newCycle) throw new Error(error?.message || "Falha ao criar ciclo");
      cycleId = newCycle.id;
    }

    await ensurePaymentsForCycle(
      cycleId!,
      data.league_id,
      camedAmountCents,
      data.director_amount_cents,
      (league as any).president_id,
    );

    // Notifica todos os ligantes ainda pendentes
    if (data.notify) {
      const { data: pendings } = await supabaseAdmin
        .from("semester_payments")
        .select("user_id, amount_due_cents, profiles!semester_payments_user_id_fkey(email, full_name, username)")
        .eq("cycle_id", cycleId)
        .in("status", ["pending", "overdue"]);
      const msgs = (pendings ?? []).map((p: any) => {
        const email = p.profiles?.email;
        if (!email) return null;
        const name = p.profiles?.full_name || p.profiles?.username || "ligante";
        const due = p.amount_due_cents ?? camedAmountCents;
        return {
          to: email,
          subject: `Semestralidade aberta — ${league.name}`,
          html: emailLayout({
            title: `Olá, ${name}. A semestralidade ${period.semester}º/${period.year} está aberta.`,
            brandColor: brand,
            leagueName: league.name,
            bodyHtml: `<p>A presidência da <strong>${league.name}</strong> abriu o ciclo de pagamento da semestralidade. Quitar agora garante que você não perca atividades, oficinas nem oportunidades de pesquisa da liga.</p>
              ${emailInfoCard({
                title: "Seu pagamento",
                brandColor: brand,
                rows: [
                  { label: "Ciclo", value: `${period.semester}º semestre de ${period.year}` },
                  { label: "Valor", value: brl(due) },
                  { label: "Vencimento", value: fmtDate(data.due_date) },
                  ...(data.late_fee_cents > 0 ? [{ label: "Acréscimo após vencer", value: brl(data.late_fee_cents) }] : []),
                ],
              })}
              <p>É rápido: o pagamento é feito por Pix direto no painel do ligante, com confirmação automática.</p>`,
            ctaLabel: "Pagar via Pix",
            ctaUrl: `${PUBLISHED_URL}/ligante/${(league as any).slug}?tab=schedule&semestralidade=1`,
            signature: `— Presidência da ${league.name}`,
          }),
        };
      }).filter(Boolean) as any[];
      if (msgs.length) {
        await sendGmailBulk(msgs);
      }
    }

    return { ok: true, cycle_id: cycleId };
  });


// ------------------ president: close current cycle (archive) ------------------

export const closeCurrentSemesterCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ league_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPresident(context.supabase, data.league_id, context.userId);

    await supabaseAdmin
      .from("semester_cycles")
      .update({ is_current: false, closed_at: new Date().toISOString() })
      .eq("league_id", data.league_id)
      .eq("is_current", true);

    return { ok: true };
  });

// ------------------ ligante: pay semester ------------------

export const createSemesterCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    league_id: z.string().uuid(),
    origin_url: z.string().url(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Ciclo atual
    const { data: cycle } = await supabaseAdmin
      .from("semester_cycles")
      .select("*, leagues!inner(id, name, slug)")
      .eq("league_id", data.league_id)
      .eq("is_current", true)
      .maybeSingle();
    if (!cycle) throw new Error("Não há semestralidade aberta para esta liga");

    // Garante que o usuário é ligante/diretor/presidente
    const { data: mem } = await supabaseAdmin
      .from("league_memberships")
      .select("role")
      .eq("league_id", data.league_id)
      .eq("user_id", userId)
      .maybeSingle();
    const role = (mem as any)?.role;
    const presidentId = (cycle as any).leagues?.id ? null : null;
    const { data: leagueRow } = await supabaseAdmin
      .from("leagues").select("president_id, president2_id").eq("id", data.league_id).maybeSingle();
    const isLeader = role === "diretor" || role === "presidente" || (leagueRow as any)?.president_id === userId || (leagueRow as any)?.president2_id === userId;
    if (!role && !isLeader) {
      throw new Error("Apenas membros da liga podem pagar a semestralidade");
    }

    // Valor base depende do papel
    const baseAmountCents = isLeader
      ? ((cycle as any).director_amount_cents ?? 0) || (cycle as any).amount_cents
      : (cycle as any).amount_cents;

    // Garante linha de pagamento com o valor correto
    await supabaseAdmin
      .from("semester_payments")
      .upsert({
        cycle_id: (cycle as any).id,
        league_id: data.league_id,
        user_id: userId,
        amount_due_cents: baseAmountCents,
        status: "pending",
      }, { onConflict: "cycle_id,user_id", ignoreDuplicates: true });

    const { data: payment } = await supabaseAdmin
      .from("semester_payments")
      .select("*")
      .eq("cycle_id", (cycle as any).id)
      .eq("user_id", userId)
      .single();
    if (!payment) throw new Error("Falha ao registrar pagamento");
    if ((payment as any).status === "paid") {
      return { already_paid: true };
    }

    // Calcula valor proporcional aos meses e dias restantes até o fim do semestre.
    // monthlyCents = valor base / total de meses do ciclo
    // mesesRestantes = (meses inteiros até o fim) + (dias restantes no mês atual / dias do mês atual)
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth(); // 0-11
    const todayYear = today.getFullYear();
    const [sy, sm] = ((cycle as any).start_date as string).split("-").map(Number);
    const [ey, em] = ((cycle as any).end_date as string).split("-").map(Number);
    const totalMonths = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
    const baseDueCents = (payment as any).amount_due_cents ?? baseAmountCents;
    const monthlyCents = baseDueCents / totalMonths;
    // Meses inteiros restantes (incluindo o mês atual)
    let monthsLeft = (ey - todayYear) * 12 + ((em - 1) - todayMonth) + 1;
    // Subtrai a fração do mês corrente já decorrida
    const daysInThisMonth = new Date(todayYear, todayMonth + 1, 0).getDate();
    const fractionUsed = Math.max(0, Math.min(1, (todayDay - 1) / daysInThisMonth));
    monthsLeft = Math.max(0, monthsLeft - fractionUsed);
    const effectiveMonths = Math.min(totalMonths, monthsLeft);
    const proratedCents = Math.max(100, Math.round(monthlyCents * effectiveMonths));
    const todayISO = new Date().toISOString().slice(0, 10);
    const isOverdue = (cycle as any).due_date < todayISO;
    const totalCents = proratedCents + (isOverdue ? (cycle as any).late_fee_cents : 0);
    const totalReais = totalCents / 100;
    if (totalReais <= 0) throw new Error("Valor inválido");

    const mpAccount = await loadLeagueMpAccount(supabaseAdmin, data.league_id);
    const feeCfg = await loadFeeForCategory(supabaseAdmin, "semester");
    const marketplaceFee = computeFee(totalReais, feeCfg.pct, feeCfg.fixed);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();

    const origin = data.origin_url.replace(/\/$/, "");
    const slug = (cycle as any).leagues.slug;
    const cycleLabel = `${(cycle as any).semester}º/${(cycle as any).year}`;

    const pref = await createSplitPreference({
      sellerAccessToken: (mpAccount as any).access_token,
      title: `Semestralidade ${cycleLabel} — ${(cycle as any).leagues.name}`,
      unitPrice: totalReais,
      payerEmail: (prof as any)?.email,
      successUrl: `${origin}/ligante/${slug}?semestralidade=paid`,
      failureUrl: `${origin}/ligante/${slug}?semestralidade=fail`,
      marketplaceFee,
      externalReference: `semester:${(payment as any).id}`,
      notificationUrl: WEBHOOK_URL,
      metadata: {
        payment_id: (payment as any).id,
        cycle_id: (cycle as any).id,
        user_id: userId,
        league_id: data.league_id,
      },
      pixOnly: true,
    });

    await supabaseAdmin
      .from("semester_payments")
      .update({ mp_preference_id: pref.id })
      .eq("id", (payment as any).id);

    return { url: pref.init_point, amount_cents: totalCents };
  });

// ------------------ ligante: get own payment status ------------------

export const getMySemesterPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ league_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: cycle } = await supabaseAdmin
      .from("semester_cycles")
      .select("*")
      .eq("league_id", data.league_id)
      .eq("is_current", true)
      .maybeSingle();
    if (!cycle) return { cycle: null, payment: null };
    const { data: payment } = await supabaseAdmin
      .from("semester_payments")
      .select("*")
      .eq("cycle_id", (cycle as any).id)
      .eq("user_id", userId)
      .maybeSingle();
    return { cycle, payment };
  });

// ------------------ ligante: pay semester via Pix nativo (com QR + polling) ------------------

function splitName(full: string) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "Ligante";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "Ligasuno";
  return { first: first.slice(0, 50), last: last.slice(0, 50) };
}

export const createSemesterPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    league_id: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: cycle } = await supabaseAdmin
      .from("semester_cycles")
      .select("*, leagues!inner(id, name, slug)")
      .eq("league_id", data.league_id)
      .eq("is_current", true)
      .maybeSingle();
    if (!cycle) throw new Error("Não há semestralidade aberta para esta liga");

    const { data: mem } = await supabaseAdmin
      .from("league_memberships")
      .select("role")
      .eq("league_id", data.league_id)
      .eq("user_id", userId)
      .maybeSingle();
    const role = (mem as any)?.role;
    const { data: leagueRow } = await supabaseAdmin
      .from("leagues").select("president_id, president2_id").eq("id", data.league_id).maybeSingle();
    const isLeader = role === "diretor" || role === "presidente" || (leagueRow as any)?.president_id === userId || (leagueRow as any)?.president2_id === userId;
    if (!role && !isLeader) {
      throw new Error("Apenas membros da liga podem pagar a semestralidade");
    }

    const baseAmountCents = isLeader
      ? ((cycle as any).director_amount_cents ?? 0) || (cycle as any).amount_cents
      : (cycle as any).amount_cents;

    await supabaseAdmin
      .from("semester_payments")
      .upsert({
        cycle_id: (cycle as any).id,
        league_id: data.league_id,
        user_id: userId,
        amount_due_cents: baseAmountCents,
        status: "pending",
      }, { onConflict: "cycle_id,user_id", ignoreDuplicates: true });

    const { data: payment } = await supabaseAdmin
      .from("semester_payments")
      .select("*")
      .eq("cycle_id", (cycle as any).id)
      .eq("user_id", userId)
      .single();
    if (!payment) throw new Error("Falha ao registrar pagamento");
    if ((payment as any).status === "paid") {
      return { already_paid: true, registration_id: (payment as any).id };
    }

    // Cálculo proporcional (mesma lógica de createSemesterCheckout)
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    const [sy, sm] = ((cycle as any).start_date as string).split("-").map(Number);
    const [ey, em] = ((cycle as any).end_date as string).split("-").map(Number);
    const totalMonths = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
    const baseDueCents = (payment as any).amount_due_cents ?? baseAmountCents;
    const monthlyCents = baseDueCents / totalMonths;
    let monthsLeft = (ey - todayYear) * 12 + ((em - 1) - todayMonth) + 1;
    const daysInThisMonth = new Date(todayYear, todayMonth + 1, 0).getDate();
    const fractionUsed = Math.max(0, Math.min(1, (todayDay - 1) / daysInThisMonth));
    monthsLeft = Math.max(0, monthsLeft - fractionUsed);
    const effectiveMonths = Math.min(totalMonths, monthsLeft);
    const proratedCents = Math.max(100, Math.round(monthlyCents * effectiveMonths));
    const todayISO = new Date().toISOString().slice(0, 10);
    const isOverdue = (cycle as any).due_date < todayISO;
    const totalCents = proratedCents + (isOverdue ? (cycle as any).late_fee_cents : 0);
    const totalReais = totalCents / 100;
    if (totalReais <= 0) throw new Error("Valor inválido");

    const mpAccount = await loadLeagueMpAccount(supabaseAdmin, data.league_id);
    const feeCfg = await loadFeeForCategory(supabaseAdmin, "semester");
    const fee = computeFee(totalReais, feeCfg.pct, feeCfg.fixed);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email, full_name, cpf").eq("id", userId).maybeSingle();
    const email = (prof as any)?.email || `${userId}@noemail.local`;
    const cpf = normalizeCpf((prof as any)?.cpf ?? "");
    if (!cpf || !isValidCPF(cpf)) {
      throw new Error("Cadastre um CPF válido em seu perfil antes de pagar via Pix.");
    }
    const { first, last } = splitName((prof as any)?.full_name ?? "");
    const cycleLabel = `${(cycle as any).semester}º/${(cycle as any).year}`;

    const pay = await createPixPayment({
      sellerAccessToken: (mpAccount as any).access_token,
      amount: totalReais,
      description: `Semestralidade ${cycleLabel} — ${(cycle as any).leagues.name}`,
      payerEmail: email,
      payerFirstName: first,
      payerLastName: last,
      payerCpf: cpf,
      externalReference: `semester:${(payment as any).id}`,
      notificationUrl: "https://ligasuno.com.br/api/public/payments/mp-webhook",
      applicationFee: fee,
      metadata: {
        payment_id: (payment as any).id,
        cycle_id: (cycle as any).id,
        user_id: userId,
        league_id: data.league_id,
      },
      expiresInMinutes: 30,
    });

    await supabaseAdmin
      .from("semester_payments")
      .update({ mp_payment_id: String(pay.id) })
      .eq("id", (payment as any).id);

    const tx = pay?.point_of_interaction?.transaction_data ?? {};
    return {
      registration_id: (payment as any).id,
      payment_id: String(pay.id),
      status: pay.status,
      amount: totalReais,
      qr_code: tx.qr_code as string | undefined,
      qr_code_base64: tx.qr_code_base64 as string | undefined,
      ticket_url: tx.ticket_url as string | undefined,
      expires_at: pay.date_of_expiration as string | undefined,
    };
  });

export const getSemesterPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ registration_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: payment } = await supabaseAdmin
      .from("semester_payments")
      .select("id, user_id, status, mp_payment_id, league_id, amount_due_cents")
      .eq("id", data.registration_id)
      .maybeSingle();
    if (!payment || (payment as any).user_id !== userId) throw new Error("Pagamento não encontrado");
    if ((payment as any).status === "paid") return { status: "paid" };
    const paymentId = (payment as any).mp_payment_id;
    if (!paymentId) return { status: (payment as any).status };
    try {
      const mp = await loadLeagueMpAccount(supabaseAdmin, (payment as any).league_id).catch(() => null);
      const pay = await getPayment(String(paymentId), (mp as any)?.access_token);
      if (pay?.status === "approved") {
        const gross = Number(pay?.transaction_amount ?? 0);
        await supabaseAdmin.from("semester_payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            amount_paid_cents: Math.round(gross * 100),
            mp_payment_id: String(paymentId),
          })
          .eq("id", (payment as any).id);
        return { status: "paid" };
      }
      return { status: pay?.status ?? (payment as any).status };
    } catch {
      return { status: (payment as any).status };
    }
  });
