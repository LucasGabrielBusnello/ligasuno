// InfinitePay — Checkout Integrado (link de pagamento).
// Docs: https://docs.infinitepay.io/checkout/link-de-pagamento
// Formato: https://checkout.infinitepay.io/{handle}?items=<base64>&redirect_url=&webhook_url=&order_nsu=

export type CheckoutItem = {
  name: string;
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

function b64(s: string): string {
  // Worker runtime tem btoa nativo
  return btoa(unescape(encodeURIComponent(s)));
}

export function buildCheckoutUrl(o: BuildCheckoutOpts): string {
  const handle = o.handle.replace(/^@/, "").trim();
  // InfinitePay espera itens com { quantity, price (centavos), description }
  const normalized = o.items.map((it) => ({
    quantity: Math.max(1, Math.floor(it.quantity)),
    price: Math.max(1, Math.floor(it.price)),
    description: (it.description ?? it.name ?? "Item").slice(0, 120),
  }));
  const items = b64(JSON.stringify(normalized));
  const params = new URLSearchParams();
  params.set("items", items);
  params.set("order_nsu", o.orderNsu);
  params.set("redirect_url", o.redirectUrl);
  params.set("webhook_url", o.webhookUrl);
  if (o.customerName) params.set("customer_name", o.customerName);
  if (o.customerEmail) params.set("customer_email", o.customerEmail);
  if (o.customerCellphone) {
    let phone = o.customerCellphone.replace(/\D/g, "");
    if (phone.length === 10 || phone.length === 11) phone = "55" + phone;
    params.set("customer_cellphone", "+" + phone);
  }
  return `https://checkout.infinitepay.io/${encodeURIComponent(handle)}?${params.toString()}`;
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
