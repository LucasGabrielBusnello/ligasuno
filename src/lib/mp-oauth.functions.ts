import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLISHED_URL = "https://ligasuno.com.br";

function callbackUrl() {
  // Sempre publicado para evitar problemas de redirect dinâmico nas configs do MP.
  return `${PUBLISHED_URL}/api/public/payments/mp-oauth-callback`;
}

/**
 * Inicia o fluxo OAuth do presidente — retorna a URL de autorização.
 * O `state` codifica o league_id e um nonce para validação no callback.
 */
export const startMpOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    league_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { getOAuthCredentials }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/mp.server"),
    ]);

    const { userId } = context;
    const { data: league } = await supabaseAdmin
      .from("leagues").select("id, president_id, president2_id, slug")
      .eq("id", data.league_id).maybeSingle();
    if (!league || ((league as any).president_id !== userId && (league as any).president2_id !== userId)) {
      throw new Error("Apenas o presidente da liga pode conectar o Mercado Pago.");
    }

    // Sempre força reconexão do zero — apaga qualquer vínculo prévio
    // para que cada liga conecte a sua própria conta sem reaproveitar token antigo.
    await supabaseAdmin.from("league_mp_accounts").delete().eq("league_id", data.league_id);

    const { client_id } = getOAuthCredentials();
    const state = `${data.league_id}.${crypto.randomUUID()}`;

    const auth = new URL("https://auth.mercadopago.com.br/authorization");
    auth.searchParams.set("client_id", client_id);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("platform_id", "mp");
    auth.searchParams.set("redirect_uri", callbackUrl());
    auth.searchParams.set("state", state);

    // Encadeia logout do MP antes da tela de autorização, para que o
    // presidente escolha manualmente qual conta usar (em vez de o MP
    // reutilizar automaticamente a sessão já logada no navegador).
    const logout = new URL("https://www.mercadopago.com.br/logout");
    logout.searchParams.set("go", auth.toString());

    return { url: logout.toString() };
  });

/**
 * Desconecta a conta MP de uma liga.
 */
export const disconnectMp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { userId } = context;
    const { data: league } = await supabaseAdmin
      .from("leagues").select("president_id, president2_id").eq("id", data.league_id).maybeSingle();
    if (!league || ((league as any).president_id !== userId && (league as any).president2_id !== userId)) {
      throw new Error("Sem permissão.");
    }
    await supabaseAdmin.from("league_mp_accounts").delete().eq("league_id", data.league_id);
    return { ok: true };
  });

/**
 * Renova access_token usando o refresh_token. Server-side helper para webhook/checkouts.
 */
export async function refreshMpToken(refreshToken: string) {
  const { getOAuthCredentials } = await import("@/lib/mp.server");
  const { client_id, client_secret } = getOAuthCredentials();
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", client_id);
  body.set("client_secret", client_secret);
  body.set("refresh_token", refreshToken);

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`MP refresh falhou: ${j?.message ?? res.status}`);
  return j as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
    public_key: string;
    scope: string;
    live_mode: boolean;
  };
}
