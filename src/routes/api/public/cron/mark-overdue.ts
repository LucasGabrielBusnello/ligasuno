import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendGmailBulk, emailLayout } from "@/lib/gmail.server";

/**
 * Cron diário — agendado via pg_cron.
 * Autenticação: header `apikey` com o anon key do Supabase.
 *
 * 1. Marca como `overdue` os pagamentos pendentes cujo ciclo já venceu.
 * 2. Para cada pagamento recém-vencido, dispara e-mail de aviso.
 */
export const Route = createFileRoute("/api/public/cron/mark-overdue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || apikey !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Quais pagamentos vão virar overdue agora? (antes da atualização)
        const { data: toExpire } = await supabaseAdmin
          .from("semester_payments")
          .select(`
            id, league_id,
            semester_cycles!inner(id, due_date, is_current, semester, year, amount_cents, late_fee_cents),
            leagues:league_id(name, slug, theme_color),
            profiles!semester_payments_user_id_fkey(email, full_name, username)
          `)
          .eq("status", "pending")
          .lte("semester_cycles.due_date", new Date().toISOString().slice(0, 10))
          .eq("semester_cycles.is_current", true);

        const { data: countRes } = await supabaseAdmin.rpc("mark_overdue_semester_payments");

        // E-mails de aviso
        const msgs = (toExpire ?? []).map((p: any) => {
          const email = p.profiles?.email;
          if (!email) return null;
          const name = p.profiles?.full_name || p.profiles?.username || "ligante";
          const league = p.leagues;
          const cycle = p.semester_cycles;
          const brand = league?.theme_color ?? "#1f5132";
          return {
            to: email,
            subject: `Semestralidade em atraso — ${league?.name ?? "sua liga"}`,
            html: emailLayout({
              title: `Olá, ${name}. Sua semestralidade venceu.`,
              brandColor: brand,
              leagueName: league?.name,
              bodyHtml: `<p>A semestralidade <strong>${cycle?.semester}º/${cycle?.year}</strong> da <strong>${league?.name ?? ""}</strong> passou da data de vencimento.</p>
                ${cycle?.late_fee_cents > 0 ? `<p>Foi aplicado um acréscimo de <strong>${(cycle.late_fee_cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong> sobre o valor original.</p>` : ""}
                <p>Para evitar bloqueio nas atividades da liga, regularize agora pelo painel do ligante — o pagamento é por Pix e a confirmação é automática.</p>`,
              ctaLabel: "Regularizar agora",
              ctaUrl: `https://ligasuno.com.br/ligante/${league?.slug}?semestralidade=1`,
              signature: `— Presidência da ${league?.name ?? "liga"}`,
            }),
          };
        }).filter(Boolean) as any[];

        if (msgs.length) {
          await sendGmailBulk(msgs);
        }

        return new Response(JSON.stringify({ ok: true, updated: countRes ?? 0, notified: msgs.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("ok"),
    },
  },
});
