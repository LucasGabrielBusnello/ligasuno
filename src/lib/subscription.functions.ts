import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createPreapproval,
  mpFetch,
  getPlatformAccessToken,
} from "@/lib/mp.server";

const PUBLISHED_URL = "https://ligasuno.lovable.app";
const WEBHOOK_URL = `${PUBLISHED_URL}/api/public/payments/mp-webhook`;

const schema = z.object({
  league_id: z.string().uuid(),
  origin_url: z.string().url(),
});

/**
 * Calcula o fim do semestre vigente.
 * Semestres: 1º = fev–jul (fim em 31/07), 2º = ago–jan (fim em 31/01 do ano seguinte).
 * Se já estiver pago além do fim do semestre atual, estende para o próximo.
 */
function nextSemesterEnd(baseDate: Date): Date {
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth(); // 0=jan
  // 1º semestre: fev(1) → jul(6), fim 31/jul
  if (m >= 1 && m <= 6) return new Date(y, 6, 31);
  // 2º semestre: ago(7) → jan(0) do ano seguinte, fim 31/jan
  if (m >= 7) return new Date(y + 1, 0, 31);
  // janeiro: fim 31/jan deste ano
  return new Date(y, 0, 31);
}

async function loadMonthlyFee(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("annual_fee_credit_monthly")
    .eq("id", 1)
    .maybeSingle();
  return Number(data?.annual_fee_credit_monthly ?? 9.8);
}

/**
 * Cria assinatura mensal recorrente no cartão via Mercado Pago (preapproval).
 * Valor: mensalidade configurada em app_settings.
 * Recebe na conta da plataforma (MP_ACCESS_TOKEN), sem split.
 */
export const createLeagueSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: league } = await supabase
      .from("leagues")
      .select("id, name, slug, president_id")
      .eq("id", data.league_id)
      .maybeSingle();
    if (!league) throw new Error("Liga não encontrada");
    if ((league as any).president_id !== userId) {
      throw new Error("Apenas a presidência pode pagar a anuidade");
    }

    const monthly = await loadMonthlyFee();
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();
    const payerEmail = (prof as any)?.email;
    if (!payerEmail) throw new Error("E-mail do presidente não encontrado");

    const origin = data.origin_url.replace(/\/$/, "");
    const backUrl = `${origin}/presidente/${(league as any).slug}?anuidade=ok`;

    const pre = await createPreapproval({
      payerEmail,
      amount: Math.round(monthly * 100) / 100,
      reason: `Anuidade mensal — ${(league as any).name}`,
      backUrl,
      externalReference: `anuidade:${data.league_id}`,
    });

    return { url: pre.init_point };
  });

/**
 * Cria cobrança PIX única equivalente a 6 meses com 5% de desconto,
 * cobrindo até o fim do semestre vigente (fev–jul ou ago–jan).
 * Recebe na conta da plataforma (MP_ACCESS_TOKEN), sem split.
 */
export const createLeagueSemesterPixCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: league } = await supabase
      .from("leagues")
      .select("id, name, slug, president_id, paid_until")
      .eq("id", data.league_id)
      .maybeSingle();
    if (!league) throw new Error("Liga não encontrada");
    if ((league as any).president_id !== userId) {
      throw new Error("Apenas a presidência pode pagar a anuidade");
    }

    const monthly = await loadMonthlyFee();
    const semesterPrice = Math.round(monthly * 6 * 0.95 * 100) / 100;

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
    const payerEmail = (prof as any)?.email;
    if (!payerEmail) throw new Error("E-mail do presidente não encontrado");

    const origin = data.origin_url.replace(/\/$/, "");

    // Cria preferência PIX (sem split, na conta da plataforma)
    const token = getPlatformAccessToken();
    const pref = await mpFetch<{ id: string; init_point: string }>(
      "/checkout/preferences",
      {
        method: "POST",
        accessToken: token,
        body: {
          items: [{
            title: `Anuidade semestral — ${(league as any).name}`,
            quantity: 1,
            unit_price: semesterPrice,
            currency_id: "BRL",
          }],
          payer: { email: payerEmail },
          back_urls: {
            success: `${origin}/presidente/${(league as any).slug}?anuidade=ok`,
            failure: `${origin}/presidente/${(league as any).slug}?anuidade=fail`,
            pending: `${origin}/presidente/${(league as any).slug}?anuidade=pending`,
          },
          auto_return: "approved",
          external_reference: `anuidade_semestral:${data.league_id}`,
          notification_url: WEBHOOK_URL,
          metadata: { league_id: data.league_id, kind: "anuidade_semestral" },
          statement_descriptor: "LIGASUNO",
          payment_methods: {
            excluded_payment_types: [
              { id: "credit_card" }, { id: "debit_card" },
              { id: "ticket" }, { id: "atm" },
            ],
            installments: 1,
            default_payment_method_id: "pix",
          },
        },
      },
    );

    return { url: pref.init_point, amount: semesterPrice };
  });

/**
 * Cancela a assinatura mensal (preapproval) ativa de uma liga.
 */
export const cancelLeagueSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: league } = await supabase
      .from("leagues").select("id, president_id").eq("id", data.league_id).maybeSingle();
    if (!league) throw new Error("Liga não encontrada");
    if ((league as any).president_id !== userId) {
      throw new Error("Apenas a presidência pode cancelar");
    }

    // Busca preapproval ativo deste league via MP search por external_reference
    const search = await mpFetch<any>(
      `/preapproval/search?external_reference=anuidade:${data.league_id}&status=authorized`,
    );
    const results = search?.results ?? [];
    if (!results.length) throw new Error("Nenhuma assinatura ativa encontrada");

    for (const sub of results) {
      await mpFetch(`/preapproval/${sub.id}`, {
        method: "PUT",
        body: { status: "cancelled" },
      });
    }

    return { ok: true };
  });

/**
 * Cancela qualquer assinatura ativa da liga e exclui a liga.
 * Apenas admin master pode excluir.
 */
export const deleteLeagueWithCancel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin_master", { _user_id: userId });
    if (!isAdmin) throw new Error("Apenas admin master pode excluir ligas.");

    // Best-effort: cancela quaisquer preapprovals ativos da liga
    try {
      const search = await mpFetch<any>(
        `/preapproval/search?external_reference=anuidade:${data.league_id}`,
      );
      const results = search?.results ?? [];
      for (const sub of results) {
        if (sub?.status === "authorized" || sub?.status === "paused" || sub?.status === "pending") {
          try {
            await mpFetch(`/preapproval/${sub.id}`, {
              method: "PUT",
              body: { status: "cancelled" },
            });
          } catch (e) {
            console.error("Falha ao cancelar preapproval", sub?.id, e);
          }
        }
      }
    } catch (e) {
      console.error("Busca de preapproval falhou (seguindo com exclusão)", e);
    }

    const { error } = await supabaseAdmin.from("leagues").delete().eq("id", data.league_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Exporta o helper para uso pelo webhook (cálculo de paid_until semestral)
export { nextSemesterEnd };
