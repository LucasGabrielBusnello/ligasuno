import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeFee,
  createSplitPreference,
  loadFeeForCategory,
  loadLeagueMpAccount,
} from "@/lib/mp.server";
import { sendGmail, sendGmailBulk, emailLayout } from "@/lib/gmail.server";

const PUBLISHED_URL = "https://ligasuno.lovable.app";
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
    .select("id, president_id, name, slug")
    .eq("id", leagueId)
    .maybeSingle();
  if (!l) throw new Error("Liga não encontrada");
  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin_master").maybeSingle();
  const isAdmin = !!roleRow;
  if (l.president_id !== userId && !isAdmin) throw new Error("Apenas o presidente pode gerenciar a semestralidade");
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

/** Garante que existe um payment row pra cada ligante ativo da liga no ciclo dado. */
async function ensurePaymentsForCycle(cycleId: string, leagueId: string, amountCents: number) {
  const { data: members } = await supabaseAdmin
    .from("league_memberships")
    .select("user_id")
    .eq("league_id", leagueId)
    .in("role", ["ligante", "diretor"]);
  const userIds = (members ?? []).map((m: any) => m.user_id);
  if (!userIds.length) return;

  const rows = userIds.map((uid) => ({
    cycle_id: cycleId,
    league_id: leagueId,
    user_id: uid,
    status: "pending" as const,
    amount_due_cents: amountCents,
  }));
  // Upsert sem mexer em quem já pagou
  for (const r of rows) {
    await supabaseAdmin
      .from("semester_payments")
      .upsert(r, { onConflict: "cycle_id,user_id", ignoreDuplicates: true });
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
    return { cycle: cycle ?? null };
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
    if (!cycleId) return { cycle: null, payments: [] };

    const { data: cycle } = await supabaseAdmin
      .from("semester_cycles").select("*").eq("id", cycleId).maybeSingle();

    const { data: payments } = await supabaseAdmin
      .from("semester_payments")
      .select("*, profiles!semester_payments_user_id_fkey(username, full_name, email)")
      .eq("cycle_id", cycleId);

    return { cycle, payments: payments ?? [] };
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
  amount_cents: z.number().int().min(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  late_fee_cents: z.number().int().min(0).default(0),
  notify: z.boolean().default(true),
});

export const upsertCurrentSemesterCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const league = await assertPresident(context.supabase, data.league_id, context.userId);

    const period = currentSemester();
    // Ciclo atual: se já existe, atualiza; senão, cria.
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
          amount_cents: data.amount_cents,
          due_date: data.due_date,
          late_fee_cents: data.late_fee_cents,
        })
        .eq("id", cycleId);
      // Atualiza valor devido nos pagamentos ainda pendentes
      await supabaseAdmin
        .from("semester_payments")
        .update({ amount_due_cents: data.amount_cents })
        .eq("cycle_id", cycleId)
        .in("status", ["pending", "overdue"]);
    } else {
      const { data: newCycle, error } = await supabaseAdmin
        .from("semester_cycles")
        .insert({
          league_id: data.league_id,
          semester: period.semester,
          year: period.year,
          start_date: period.start_date,
          end_date: period.end_date,
          amount_cents: data.amount_cents,
          due_date: data.due_date,
          late_fee_cents: data.late_fee_cents,
          is_current: true,
        })
        .select("id")
        .single();
      if (error || !newCycle) throw new Error(error?.message || "Falha ao criar ciclo");
      cycleId = newCycle.id;
    }

    await ensurePaymentsForCycle(cycleId!, data.league_id, data.amount_cents);

    // Notifica todos os ligantes ainda pendentes
    if (data.notify) {
      const { data: pendings } = await supabaseAdmin
        .from("semester_payments")
        .select("user_id, profiles!semester_payments_user_id_fkey(email, full_name, username)")
        .eq("cycle_id", cycleId)
        .in("status", ["pending", "overdue"]);
      const msgs = (pendings ?? []).map((p: any) => {
        const email = p.profiles?.email;
        if (!email) return null;
        const name = p.profiles?.full_name || p.profiles?.username || "ligante";
        return {
          to: email,
          subject: `Semestralidade aberta — ${league.name}`,
          html: emailLayout({
            title: `Semestralidade ${period.semester}º/${period.year}`,
            bodyHtml: `<p>Olá, <strong>${name}</strong>!</p>
              <p>A semestralidade da <strong>${league.name}</strong> está aberta.</p>
              <ul>
                <li><strong>Valor:</strong> ${brl(data.amount_cents)}</li>
                <li><strong>Vencimento:</strong> ${fmtDate(data.due_date)}</li>
                ${data.late_fee_cents > 0 ? `<li><strong>Acréscimo após vencimento:</strong> ${brl(data.late_fee_cents)}</li>` : ""}
              </ul>
              <p>Acesse o painel do ligante para pagar via Pix.</p>`,
            ctaLabel: "Pagar semestralidade",
            ctaUrl: `${PUBLISHED_URL}/ligante/${(league as any).slug}?tab=schedule&semestralidade=1`,
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

    // Garante que o usuário é ligante/diretor
    const { data: mem } = await supabaseAdmin
      .from("league_memberships")
      .select("role")
      .eq("league_id", data.league_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || !["ligante", "diretor"].includes((mem as any).role)) {
      throw new Error("Apenas ligantes podem pagar a semestralidade");
    }

    // Garante linha de pagamento
    await supabaseAdmin
      .from("semester_payments")
      .upsert({
        cycle_id: (cycle as any).id,
        league_id: data.league_id,
        user_id: userId,
        amount_due_cents: (cycle as any).amount_cents,
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

    // Calcula valor (com taxa de atraso se vencido)
    const isOverdue = new Date((cycle as any).due_date) < new Date(new Date().toISOString().slice(0, 10));
    const totalCents = (cycle as any).amount_cents + (isOverdue ? (cycle as any).late_fee_cents : 0);
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
