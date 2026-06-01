import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOAuthCredentials } from "@/lib/mp.server";

const PUBLISHED_URL = "https://ligasuno.lovable.app";

export const Route = createFileRoute("/api/public/payments/mp-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          return Response.redirect(`${PUBLISHED_URL}/?mp_error=${encodeURIComponent(error)}`, 302);
        }
        if (!code || !state) {
          return new Response("Parâmetros faltando", { status: 400 });
        }

        const leagueId = state.split(".")[0];
        if (!leagueId) return new Response("State inválido", { status: 400 });

        // Confirma que a liga existe e pega o slug pro redirect
        const { data: league } = await supabaseAdmin
          .from("leagues").select("id, slug").eq("id", leagueId).maybeSingle();
        if (!league) return new Response("Liga não encontrada", { status: 404 });

        // Troca o code por access_token
        try {
          const { client_id, client_secret } = getOAuthCredentials();
          const body = new URLSearchParams();
          body.set("grant_type", "authorization_code");
          body.set("client_id", client_id);
          body.set("client_secret", client_secret);
          body.set("code", code);
          body.set("redirect_uri", `${PUBLISHED_URL}/api/public/payments/mp-oauth-callback`);

          const res = await fetch("https://api.mercadopago.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          const j = await res.json();
          if (!res.ok) {
            console.error("MP token exchange failed", j);
            return Response.redirect(`${PUBLISHED_URL}/presidente/${(league as any).slug}?mp_error=token`, 302);
          }

          const expiresAt = new Date(Date.now() + (Number(j.expires_in) || 0) * 1000).toISOString();

          await supabaseAdmin.from("league_mp_accounts").upsert({
            league_id: leagueId,
            mp_user_id: String(j.user_id),
            access_token: j.access_token,
            refresh_token: j.refresh_token,
            public_key: j.public_key,
            scope: j.scope,
            live_mode: !!j.live_mode,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: "league_id" });

          return Response.redirect(`${PUBLISHED_URL}/presidente/${(league as any).slug}?mp_connected=1`, 302);
        } catch (e: any) {
          console.error("MP callback error", e);
          return Response.redirect(`${PUBLISHED_URL}/presidente/${(league as any).slug}?mp_error=${encodeURIComponent(e?.message ?? "unknown")}`, 302);
        }
      },
    },
  },
});
