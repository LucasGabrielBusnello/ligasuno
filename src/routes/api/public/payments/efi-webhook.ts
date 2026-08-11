import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook da Efí (Gerencianet).
 * A Efí envia um token de notificação; consultamos esse token com as
 * credenciais da liga (identificada pelo parâmetro `lid` na URL).
 */
export const Route = createFileRoute("/api/public/payments/efi-webhook")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const leagueId = url.searchParams.get("lid");

          const ct = request.headers.get("content-type") ?? "";
          let token: string | null = null;
          if (ct.includes("application/json")) {
            const body: any = await request.json().catch(() => ({}));
            token = body?.notification ?? body?.token ?? null;
          } else {
            const form = await request.formData().catch(() => null);
            token = (form?.get("notification") as string) ?? null;
          }
          if (!token || !leagueId) return new Response("ok");

          const [{ supabaseAdmin }, { decryptString }, efi, { settleLeaguePayment }] =
            await Promise.all([
              import("@/integrations/supabase/client.server"),
              import("@/lib/crypto.server"),
              import("@/lib/efi.server"),
              import("@/lib/payment-settlement.server"),
            ]);

          const { data: acc } = await (supabaseAdmin as any)
            .from("league_efi_accounts").select("*").eq("league_id", leagueId).maybeSingle();
          if (!acc) return new Response("ok");

          const creds = {
            clientId: await decryptString(String(acc.client_id_encrypted)),
            clientSecret: await decryptString(String(acc.client_secret_encrypted)),
            sandbox: !!acc.sandbox,
          };

          const events = await efi.getEfiNotification(creds, token);
          const last = events[events.length - 1];
          if (!last) return new Response("ok");

          const customId: string | undefined = last?.custom_id ?? last?.identifiers?.custom_id;
          if (!customId) return new Response("ok");
          const [category, refId] = String(customId).split(":");
          if (!category || !refId) return new Response("ok");

          const gross = Number(last?.value ?? last?.total ?? 0) / 100;

          await settleLeaguePayment({
            category,
            refId,
            paymentId: String(last?.identifiers?.charge_id ?? last?.charge_id ?? customId),
            status: efi.normalizeEfiStatus(last?.status?.current ?? last?.status),
            grossAmount: gross,
            feeAmount: 0,
            method: String(last?.payment_method ?? "").toLowerCase() || null,
            leagueId,
            raw: last,
          });
        } catch (e) {
          console.error("Efí webhook error", e);
          return new Response("ok-with-error", { status: 200 });
        }
        return new Response("ok");
      },
    },
  },
});
