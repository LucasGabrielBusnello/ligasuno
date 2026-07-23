import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function appOrigin() {
  return process.env.APP_URL || "https://ligasuno.com.br";
}

async function loadHandle(supabaseAdmin: any, athletic_id: string): Promise<string> {
  const { data: acc } = await supabaseAdmin
    .from("athletic_infinitepay_accounts")
    .select("handle")
    .eq("athletic_id", athletic_id)
    .maybeSingle();
  if (!acc?.handle) throw new Error("InfinitePay não conectada para esta atlética");
  return String(acc.handle);
}

/* ============ ASSOCIAÇÃO ============ */
export const createMembershipInfinitepayCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ payment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildCheckoutUrl } = await import("@/lib/infinitepay.server");

    const { data: pay } = await supabaseAdmin
      .from("athletic_membership_payments").select("*").eq("id", data.payment_id).maybeSingle();
    if (!pay) throw new Error("Pagamento não encontrado");
    if ((pay as any).user_id !== userId) throw new Error("Sem permissão");
    if ((pay as any).status === "paid") throw new Error("Já pago");

    const amount = Number((pay as any).amount);
    const handle = await loadHandle(supabaseAdmin, (pay as any).athletic_id);
    const origin = appOrigin();

    const url = await buildCheckoutUrl({
      handle,
      orderNsu: `ath_memb:${(pay as any).id}`,
      redirectUrl: `${origin}/atletica?paid=1`,
      webhookUrl: `${origin}/api/public/payments/infinitepay-webhook`,
      customerName: (pay as any).buyer_name ?? undefined,
      customerEmail: (pay as any).buyer_email ?? undefined,
      items: [{
        name: "Associação AAAMD Desbravadores",
        description: `Sócio(a) — pagamento único`,
        quantity: 1,
        price: Math.round(amount * 100),
      }],
    });
    return { checkout_url: url, amount };
  });

/* ============ INGRESSO DE EVENTO ============ */
export const createEventTicketInfinitepayCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      event_id: z.string().uuid(),
      buyer_name: z.string().min(2),
      buyer_email: z.string().email(),
      buyer_phone: z.string().optional().nullable(),
      buyer_cpf: z.string().min(11),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildCheckoutUrl } = await import("@/lib/infinitepay.server");

    const { data: ev } = await supabaseAdmin
      .from("athletic_events").select("*").eq("id", data.event_id).maybeSingle();
    if (!ev) throw new Error("Evento não encontrado");
    if (!(ev as any).published || !(ev as any).online_sales_open) throw new Error("Vendas online não estão abertas");

    const { data: mem } = await supabaseAdmin
      .from("athletic_memberships").select("active, member_until")
      .eq("athletic_id", (ev as any).athletic_id).eq("user_id", userId).maybeSingle();
    const isMember = !!(mem && (mem as any).active && (!(mem as any).member_until || new Date((mem as any).member_until) >= new Date()));
    const amount = Number(isMember ? (ev as any).price_member : (ev as any).price_visitor);
    if (!amount || amount <= 0) throw new Error("Preço inválido para este evento");

    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("athletic_event_tickets").select("*").eq("event_id", data.event_id).eq("status", "available").limit(1).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!ticket) throw new Error("Ingressos esgotados. Emita mais lotes na diretoria.");

    const { error: reserveErr } = await supabaseAdmin.from("athletic_event_tickets").update({
      status: "reserved" as any,
      buyer_user_id: userId,
      buyer_name: data.buyer_name,
      buyer_email: data.buyer_email.toLowerCase(),
      buyer_phone: data.buyer_phone ?? null,
      buyer_cpf: data.buyer_cpf,
      price_paid: amount,
      sold_channel: "online",
    }).eq("id", (ticket as any).id).eq("status", "available");
    if (reserveErr) throw new Error(reserveErr.message);

    try {
      const handle = await loadHandle(supabaseAdmin, (ev as any).athletic_id);
      const origin = appOrigin();
      const url = await buildCheckoutUrl({
        handle,
        orderNsu: `ath_event:${(ticket as any).id}`,
        redirectUrl: `${origin}/atletica?paid=1`,
        webhookUrl: `${origin}/api/public/payments/infinitepay-webhook`,
        customerName: data.buyer_name,
        customerEmail: data.buyer_email,
        customerCellphone: data.buyer_phone ?? undefined,
        items: [{
          name: `Ingresso ${(ev as any).title}`,
          description: isMember ? "Ingresso sócio" : "Ingresso visitante",
          quantity: 1,
          price: Math.round(amount * 100),
        }],
      });
      return { checkout_url: url, amount, ticket_id: (ticket as any).id, code: (ticket as any).code };
    } catch (e) {
      await supabaseAdmin.from("athletic_event_tickets").update({
        status: "available", buyer_user_id: null, buyer_name: null, buyer_email: null,
        buyer_phone: null, buyer_cpf: null, price_paid: null, sold_channel: null,
      }).eq("id", (ticket as any).id);
      throw e;
    }
  });

/* ============ CARRINHO ============ */
export const createCartInfinitepayCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      })).min(1).max(20),
      buyer_name: z.string().min(2),
      buyer_email: z.string().email(),
      buyer_phone: z.string().optional().nullable(),
      buyer_cpf: z.string().min(11),
      notes: z.string().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildCheckoutUrl } = await import("@/lib/infinitepay.server");

    const ids = data.items.map((it) => it.product_id);
    const { data: prods } = await supabaseAdmin
      .from("athletic_products").select("*").in("id", ids);
    const productsById = new Map<string, any>();
    for (const p of (prods as any[]) ?? []) productsById.set(p.id, p);

    const { data: mem } = await supabaseAdmin
      .from("athletic_memberships").select("active, member_until")
      .eq("athletic_id", data.athletic_id).eq("user_id", userId).maybeSingle();
    const isMember = !!(mem && (mem as any).active && (!(mem as any).member_until || new Date((mem as any).member_until) >= new Date()));

    const now = new Date();
    let subtotal = 0;
    let total = 0;
    const lines: Array<{ product_id: string; title: string; unit: number; qty: number; line_total: number }> = [];

    for (const it of data.items) {
      const prod = productsById.get(it.product_id);
      if (!prod) throw new Error("Produto não encontrado");
      if (prod.athletic_id !== data.athletic_id) throw new Error("Produto de outra atlética no carrinho");
      if (!prod.active) throw new Error(`Produto indisponível: ${prod.title}`);
      if ((prod as any).sales_deadline && new Date((prod as any).sales_deadline) < now) {
        throw new Error(`Prazo de compra encerrado: ${prod.title}`);
      }
      if (prod.stock != null && Number(prod.stock) < it.quantity) throw new Error(`Estoque insuficiente: ${prod.title}`);

      let unit = Number(isMember && prod.member_price ? prod.member_price : prod.price);
      if (Number(prod.discount_pct) > 0) unit = unit * (1 - Number(prod.discount_pct) / 100);
      let lineTotal = unit * it.quantity;
      if (it.quantity >= 2 && Number(prod.second_item_discount_pct) > 0) {
        const extras = it.quantity - 1;
        const discount = unit * extras * (Number(prod.second_item_discount_pct) / 100);
        lineTotal = lineTotal - discount;
      }
      lineTotal = Math.round(lineTotal * 100) / 100;
      const rawLine = Math.round(unit * it.quantity * 100) / 100;
      subtotal += rawLine;
      total += lineTotal;
      lines.push({ product_id: prod.id, title: prod.title, unit, qty: it.quantity, line_total: lineTotal });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    total = Math.round(total * 100) / 100;

    const { data: order, error: oErr } = await supabaseAdmin.from("athletic_product_orders").insert({
      athletic_id: data.athletic_id,
      user_id: userId,
      buyer_name: data.buyer_name,
      buyer_email: data.buyer_email.toLowerCase(),
      buyer_phone: data.buyer_phone ?? null,
      buyer_cpf: data.buyer_cpf,
      subtotal,
      discount_total: subtotal - total,
      total,
      status: "pending",
      notes: data.notes ?? null,
    }).select("id").single();
    if (oErr) throw new Error(oErr.message);

    await supabaseAdmin.from("athletic_product_order_items").insert(
      lines.map((l) => ({
        order_id: (order as any).id,
        product_id: l.product_id,
        title: l.title,
        unit_price: l.unit,
        quantity: l.qty,
        line_total: l.line_total,
      })),
    );

    const handle = await loadHandle(supabaseAdmin, data.athletic_id);
    const origin = appOrigin();

    const url = buildCheckoutUrl({
      handle,
      orderNsu: `ath_prod:${(order as any).id}`,
      redirectUrl: `${origin}/atletica?paid=1`,
      webhookUrl: `${origin}/api/public/payments/infinitepay-webhook`,
      customerName: data.buyer_name,
      customerEmail: data.buyer_email,
      customerCellphone: data.buyer_phone ?? undefined,
      items: lines.map((l) => ({
        name: l.title,
        quantity: l.qty,
        price: Math.round((l.line_total / l.qty) * 100),
      })),
    });

    return { order_id: (order as any).id, checkout_url: url, amount: total };
  });
