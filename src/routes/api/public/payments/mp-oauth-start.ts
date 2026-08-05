import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const PUBLISHED_URL = "https://ligasuno.com.br";

function callbackUrl() {
  return `${PUBLISHED_URL}/api/public/payments/mp-oauth-callback`;
}

export const Route = createFileRoute("/api/public/payments/mp-oauth-start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const [{ supabaseAdmin }, { getOAuthCredentials }] = await Promise.all([
            import("@/integrations/supabase/client.server"),
            import("@/lib/mp.server"),
          ]);

          const authHeader = request.headers.get("authorization");
          const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
          const body = await request.json().catch(() => null);
          const leagueId = body?.league_id as string | undefined;

          if (!leagueId || !token) {
            return new Response("Parâmetros faltando", { status: 400 });
          }

          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return new Response("Configuração de autenticação ausente", { status: 500 });
          }

          const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });

          const { data: claims, error: authError } = await authClient.auth.getClaims(token);
          const userId = claims?.claims?.sub;
          if (authError || !userId) {
            return new Response("Não autorizado", { status: 401 });
          }

          const { data: league } = await supabaseAdmin
            .from("leagues")
            .select("id, president_id, president2_id")
            .eq("id", leagueId)
            .maybeSingle();

          if (!league || ((league as any).president_id !== userId && (league as any).president2_id !== userId)) {
            return new Response("Sem permissão", { status: 403 });
          }

          await supabaseAdmin.from("league_mp_accounts").delete().eq("league_id", leagueId);

          const { client_id } = getOAuthCredentials();
          const state = `${leagueId}.${crypto.randomUUID()}`;

          const auth = new URL("https://auth.mercadopago.com.br/authorization");
          auth.searchParams.set("client_id", client_id);
          auth.searchParams.set("response_type", "code");
          auth.searchParams.set("platform_id", "mp");
          auth.searchParams.set("redirect_uri", callbackUrl());
          auth.searchParams.set("state", state);

          const logout = new URL("https://www.mercadopago.com.br/logout");
          logout.searchParams.set("go", auth.toString());

          return Response.json({ url: logout.toString() });
        } catch (e: any) {
          console.error("MP oauth start error", e);
          return new Response(e?.message ?? "Erro ao iniciar conexão", { status: 500 });
        }
      },
    },
  },
});