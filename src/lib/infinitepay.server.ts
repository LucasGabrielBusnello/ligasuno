// InfinitePay — Checkout Integrado via API (POST /links).
// Docs: https://docs.infinitepay.io/checkout/link-de-pagamento

export type CheckoutItem = {
  name?: string;
  description?: string;
  quantity: number;
  price: number; // em centavos
};

export type BuildCheckoutOpts = {
  handle: string;
  items: CheckoutItem[];
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerCellphone?: string;
};

function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  let phone = raw.replace(/\D/g, "");
  if (!phone) return undefined;
  if (phone.length === 10 || phone.length === 11) phone = "55" + phone;
  return "+" + phone;
}

/**
 * Cria um link de checkout na InfinitePay via API e retorna a URL para
 * redirecionar o comprador.
 */
export async function buildCheckoutUrl(o: BuildCheckoutOpts): Promise<string> {
  const handle = o.handle.replace(/^@/, "").trim();
  const items = o.items.map((it) => ({
    description: (it.description ?? it.name ?? "Item").slice(0, 120),
    quantity: Math.max(1, Math.floor(it.quantity)),
    price: Math.max(1, Math.floor(it.price)),
  }));

  const payload: Record<string, unknown> = {
    handle,
    order_nsu: o.orderNsu,
    items,
    redirect_url: o.redirectUrl,
    webhook_url: o.webhookUrl,
  };

  const customer: Record<string, string> = {};
  if (o.customerName) customer.name = o.customerName;
  if (o.customerEmail) customer.email = o.customerEmail;
  const phone = normalizePhone(o.customerCellphone);
  if (phone) customer.phone_number = phone;
  if (Object.keys(customer).length > 0) payload.customer = customer;

  const res = await fetch("https://api.checkout.infinitepay.io/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(`InfinitePay: ${msg}`);
  }

  const url: string | undefined = json?.url ?? json?.checkout_url ?? json?.data?.url;
  if (!url) throw new Error("InfinitePay: resposta sem URL de checkout");
  return url;
}

/** HMAC-SHA256 helper para validar assinatura de webhook (se configurada). */
export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
