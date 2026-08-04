/**
 * CallMeBot responde 200/203 com HTML de erro no corpo (ex.: "APIKey is invalid"),
 * então checar apenas response.ok deixa a falha passar silenciosamente.
 */
export async function sendCallMeBot(rawPhone?: string | null, rawKey?: string | null, text?: string) {
  const phone = (rawPhone ?? "").replace(/\D/g, "");
  const key = (rawKey ?? "").trim();
  if (!phone || !key) return { ok: false as const, reason: "WhatsApp não configurado (número ou API key ausente)." };
  if (phone.length < 12) return { ok: false as const, reason: "Número precisa incluir o DDI (ex.: 5549988415624)." };
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=%2B${phone}&text=${encodeURIComponent(text ?? "")}&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const body = await res.text();
    const plain = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const failed = !res.ok || /error|invalid|not\s+valid|empty|missing|denied|expired/i.test(plain);
    if (failed) return { ok: false as const, reason: plain || `HTTP ${res.status}` };
    return { ok: true as const, reason: plain };
  } catch (e: any) {
    return { ok: false as const, reason: e?.message ?? "Falha de rede" };
  }
}
