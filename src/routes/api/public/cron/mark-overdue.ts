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
            leagues:league_id(name, slug),
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
          return {
            to: email,
            subject: `Semestralidade em atraso — ${league?.name ?? "sua liga"}`,
            html: emailLayout({
              title: "Pagamento em atraso",
              bodyHtml: `<p>Olá, <strong>${name}</strong>!</p>
                <p>A semestralidade ${cycle?.semester}º/${cycle?.year} da <strong>${league?.name ?? ""}</strong> venceu.</p>
                ${cycle?.late_fee_cents > 0 ? `<p>Foi aplicado um acréscimo de <strong>${(cycle.late_fee_cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong>.</p>` : ""}
                <p>Regularize sua situação o quanto antes pelo painel do ligante.</p>`,
              ctaLabel: "Pagar agora",
              ctaUrl: `https://ligasuno.lovable.app/ligante/${league?.slug}?semestralidade=1`,
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
