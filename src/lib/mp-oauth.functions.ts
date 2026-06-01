import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOAuthCredentials, mpFetch } from "@/lib/mp.server";

const PUBLISHED_URL = "https://ligasuno.lovable.app";

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
    const { userId } = context;
    // Confirma que o usuário é presidente da liga
    const { data: league } = await supabaseAdmin
      .from("leagues").select("id, president_id, slug")
      .eq("id", data.league_id).maybeSingle();
    if (!league || (league as any).president_id !== userId) {
      throw new Error("Apenas o presidente da liga pode conectar o Mercado Pago.");
    }

    const { client_id } = getOAuthCredentials();
    const state = `${data.league_id}.${crypto.randomUUID()}`;
    // Guarda o state (5 min) numa tabela leve via app_settings? Para simplicidade,
    // codificamos o league_id direto no state — validação extra no callback.

    const url = new URL("https://auth.mercadopago.com.br/authorization");
    url.searchParams.set("client_id", client_id);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("redirect_uri", callbackUrl());
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

/**
 * Desconecta a conta MP de uma liga.
 */
export const disconnectMp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ league_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: league } = await supabaseAdmin
      .from("leagues").select("president_id").eq("id", data.league_id).maybeSingle();
    if (!league || (league as any).president_id !== userId) {
      throw new Error("Sem permissão.");
    }
    await supabaseAdmin.from("league_mp_accounts").delete().eq("league_id", data.league_id);
    return { ok: true };
  });

/**
 * Renova access_token usando o refresh_token. Server-side helper para webhook/checkouts.
 */
export async function refreshMpToken(refreshToken: string) {
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
