import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";

const GATEWAY = "https://connector-gateway.lovable.dev/stripe";
const STRIPE_KEY = () => process.env.STRIPE_LIVE_API_KEY ?? process.env.STRIPE_SANDBOX_API_KEY;

const schema = z.object({
  league_id: z.string().uuid(),
  full_name: z.string().min(2).max(150),
  cpf: z.string().min(11).max(20),
  email: z.string().email(),
  phone: z.string().min(8).max(30),
  semester: z.number().int().refine(v => [1,3,5,7,9,11].includes(v), "Semestre inválido"),
  payment_method: z.enum(["card","pix"]).default("card"),
  origin_url: z.string().url(),
});

export const createSelectionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cpf = normalizeCpf(data.cpf);
    if (!isValidCPF(cpf)) throw new Error("CPF inválido");

    const { data: league } = await supabase.from("leagues").select("*").eq("id", data.league_id).maybeSingle();
    if (!league) throw new Error("Liga não encontrada");
    const l: any = league;
    if (!l.selection_open) throw new Error("Inscrições fechadas");
    if (l.selection_deadline && new Date(l.selection_deadline) < new Date()) throw new Error("Prazo de inscrição encerrado");

    const { data: settings } = await supabase.from("camed_settings").select("*").eq("id", 1).maybeSingle();
    const fee = Number((settings as any)?.league_registration_fee ?? 0);

    const { data: reg, error: regErr } = await (supabaseAdmin as any)
      .from("league_selection_registrations")
      .upsert({
        league_id: data.league_id, user_id: userId,
        full_name: data.full_name, cpf, email: data.email, phone: data.phone,
        semester: data.semester, paid_price: fee,
        status: fee === 0 ? "paid" : "pending",
      }, { onConflict: "league_id,user_id" })
      .select("*").single();
    if (regErr || !reg) throw new Error(regErr?.message || "Falha ao registrar");

    if (fee === 0) return { free: true, registration_id: (reg as any).id };

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const KEY = STRIPE_KEY();
    if (!LOVABLE_API_KEY || !KEY) throw new Error("Pagamentos não configurados");

    const origin = data.origin_url.replace(/\/$/, "");
    const successUrl = `${origin}/${l.slug}?selection_paid=1`;
    const cancelUrl = `${origin}/${l.slug}?selection_paid=0`;

    const params = new URLSearchParams();
    params.append("mode","payment");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    params.append("payment_method_types[]", data.payment_method);
    if (data.payment_method === "pix") params.append("payment_method_options[pix][expires_after_seconds]","3600");
    params.append("customer_email", data.email);
    params.append("line_items[0][quantity]","1");
    params.append("line_items[0][price_data][currency]","brl");
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(fee*100)));
    params.append("line_items[0][price_data][product_data][name]", `Inscrição prova — ${l.name}`);
    params.append("metadata[selection_registration_id]", (reg as any).id);
    params.append("metadata[user_id]", userId);

    const res = await fetch(`${GATEWAY}/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok) {
      const msg = session?.error?.message ?? JSON.stringify(session);
      if (typeof msg === "string" && msg.toLowerCase().includes("provided: pix is invalid")) {
        throw new Error("Pix ainda não está habilitado na conta de pagamentos. Ative o Pix nas configurações.");
      }
      throw new Error(`Stripe falhou [${res.status}]: ${msg}`);
    }
    await (supabaseAdmin as any).from("league_selection_registrations")
      .update({ stripe_session_id: session.id }).eq("id", (reg as any).id);

    return { free: false, registration_id: (reg as any).id, url: session.url as string };
  });

// ============ RANKING ============
async function loadSelectionContext(leagueId: string) {
  const [{ data: league }, { data: regs }, { data: quotas }] = await Promise.all([
    (supabaseAdmin as any).from("leagues").select("id, selection_total_seats").eq("id", leagueId).maybeSingle(),
    (supabaseAdmin as any).from("league_selection_registrations").select("*").eq("league_id", leagueId).eq("status", "paid"),
    (supabaseAdmin as any).from("league_selection_quotas").select("*").eq("league_id", leagueId),
  ]);
  return { league, regs: (regs ?? []) as any[], quotas: (quotas ?? []) as any[] };
}

async function pushHistory(leagueId: string) {
  const { data: snap } = await (supabaseAdmin as any)
    .from("league_selection_registrations")
    .select("id, ranked_position, ranked_via, ranked_semester")
    .eq("league_id", leagueId);
  await (supabaseAdmin as any).from("league_selection_ranking_history").insert({
    league_id: leagueId,
    snapshot: snap ?? [],
  });
  // Keep only last 20
  const { data: hist } = await (supabaseAdmin as any)
    .from("league_selection_ranking_history").select("id, created_at")
    .eq("league_id", leagueId).order("created_at", { ascending: false });
  if ((hist ?? []).length > 20) {
    const toDelete = (hist as any[]).slice(20).map(h => h.id);
    await (supabaseAdmin as any).from("league_selection_ranking_history").delete().in("id", toDelete);
  }
}

function rankPool(pool: any[]) {
  return [...pool].sort((a,b) => {
    const ga = Number(a.grade) || 0, gb = Number(b.grade) || 0;
    if (gb !== ga) return gb - ga;
    return (Number(a.delivery_position) || 999999) - (Number(b.delivery_position) || 999999);
  });
}

export const generateRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { league, regs, quotas } = await loadSelectionContext(data.league_id);
    if (!league) throw new Error("Liga não encontrada");
    const total = Number((league as any).selection_total_seats) || 0;
    if (total <= 0) throw new Error("Defina o total de vagas antes de gerar a classificação");

    const present = regs.filter((r:any) => r.present);
    const missing = present.filter((r:any) => r.grade == null || r.delivery_position == null);
    if (missing.length > 0) {
      throw new Error(`Faltam nota/posição para: ${missing.map((m:any) => m.full_name).join(", ")}`);
    }

    await pushHistory(data.league_id);

    // Reset ranking
    await (supabaseAdmin as any).from("league_selection_registrations")
      .update({ ranked_position: null, ranked_via: null, ranked_semester: null })
      .eq("league_id", data.league_id);

    const used = new Set<string>();
    let pos = 1;
    const updates: { id: string; ranked_position: number; ranked_via: string; ranked_semester: number | null }[] = [];

    // 1. Cotas primeiro
    for (const q of quotas) {
      const sem = Number(q.semester);
      const seats = Math.max(0, Number(q.seats) || 0);
      if (seats === 0) continue;
      const candidates = rankPool(present.filter((r:any) => r.semester === sem && !used.has(r.id)));
      const taken = candidates.slice(0, seats);
      for (const c of taken) {
        used.add(c.id);
        updates.push({ id: c.id, ranked_position: pos++, ranked_via: "quota", ranked_semester: sem });
      }
    }

    // 2. Geral preenche restantes
    const remainingSeats = Math.max(0, total - updates.length);
    const generalPool = rankPool(present.filter((r:any) => !used.has(r.id)));
    const taken = generalPool.slice(0, remainingSeats);
    for (const c of taken) {
      used.add(c.id);
      updates.push({ id: c.id, ranked_position: pos++, ranked_via: "general", ranked_semester: null });
    }

    // 3. Waitlist
    const waitlist = rankPool(present.filter((r:any) => !used.has(r.id)));
    let wpos = 1;
    for (const c of waitlist) {
      updates.push({ id: c.id, ranked_position: wpos++, ranked_via: "waitlist", ranked_semester: null });
    }

    for (const u of updates) {
      await (supabaseAdmin as any).from("league_selection_registrations")
        .update({ ranked_position: u.ranked_position, ranked_via: u.ranked_via, ranked_semester: u.ranked_semester })
        .eq("id", u.id);
    }

    return { ok: true, classified: updates.filter(u => u.ranked_via !== "waitlist").length };
  });

export const removeFromRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ registration_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: reg } = await (supabaseAdmin as any)
      .from("league_selection_registrations").select("*").eq("id", data.registration_id).maybeSingle();
    if (!reg) throw new Error("Inscrição não encontrada");
    const r: any = reg;
    if (!r.ranked_via || r.ranked_via === "waitlist") throw new Error("Inscrito não está classificado");

    await pushHistory(r.league_id);

    // Try to find a replacement from waitlist
    const { data: wl } = await (supabaseAdmin as any)
      .from("league_selection_registrations").select("*")
      .eq("league_id", r.league_id).eq("ranked_via", "waitlist");
    const sorted = rankPool(wl ?? []);

    let replacement: any = null;
    if (r.ranked_via === "quota" && r.ranked_semester) {
      replacement = sorted.find((w:any) => w.semester === r.ranked_semester) ?? sorted[0] ?? null;
    } else {
      replacement = sorted[0] ?? null;
    }

    // Remove the classified person from ranking
    await (supabaseAdmin as any).from("league_selection_registrations")
      .update({ ranked_position: null, ranked_via: "eliminated", ranked_semester: null })
      .eq("id", r.id);
    // Also remove the ligante membership if it exists
    await (supabaseAdmin as any).from("league_memberships")
      .delete().eq("league_id", r.league_id).eq("user_id", r.user_id).eq("role", "ligante");

    if (replacement) {
      await (supabaseAdmin as any).from("league_selection_registrations")
        .update({
          ranked_position: r.ranked_position,
          ranked_via: r.ranked_via,
          ranked_semester: r.ranked_semester,
        })
        .eq("id", replacement.id);
    }

    return { ok: true, replaced: !!replacement };
  });

export const undoLastRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: hist } = await (supabaseAdmin as any)
      .from("league_selection_ranking_history")
      .select("*").eq("league_id", data.league_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!hist) throw new Error("Nada para desfazer");
    const snap = (hist as any).snapshot as any[];
    // Reset all then apply snapshot
    await (supabaseAdmin as any).from("league_selection_registrations")
      .update({ ranked_position: null, ranked_via: null, ranked_semester: null })
      .eq("league_id", data.league_id);
    for (const s of snap) {
      await (supabaseAdmin as any).from("league_selection_registrations")
        .update({ ranked_position: s.ranked_position, ranked_via: s.ranked_via, ranked_semester: s.ranked_semester })
        .eq("id", s.id);
    }
    await (supabaseAdmin as any).from("league_selection_ranking_history").delete().eq("id", (hist as any).id);
    return { ok: true };
  });

export const toggleLigante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ registration_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: reg } = await (supabaseAdmin as any)
      .from("league_selection_registrations").select("league_id, user_id").eq("id", data.registration_id).maybeSingle();
    if (!reg) throw new Error("Inscrição não encontrada");
    const r: any = reg;
    const { data: existing } = await (supabaseAdmin as any).from("league_memberships")
      .select("id").eq("league_id", r.league_id).eq("user_id", r.user_id).eq("role", "ligante").maybeSingle();
    if (existing) {
      const { error } = await (supabaseAdmin as any).from("league_memberships")
        .delete().eq("league_id", r.league_id).eq("user_id", r.user_id).eq("role", "ligante");
      if (error) throw new Error(error.message);
      return { ok: true, isLigante: false };
    }
    const { error } = await (supabaseAdmin as any).from("league_memberships")
      .upsert({ league_id: r.league_id, user_id: r.user_id, role: "ligante" }, { onConflict: "league_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, isLigante: true };
  });

export const setAsLigante = toggleLigante;
