import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* Cria pagamento Pix para uma associação (usa membership_payment já pendente). */
export const createMembershipPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ payment_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPlatformAccessToken, createPixPayment, loadFeeForCategory, computeFee } = await import("@/lib/mp.server");

    const { data: pay } = await supabaseAdmin
      .from("athletic_membership_payments").select("*").eq("id", data.payment_id).maybeSingle();
    if (!pay) throw new Error("Pagamento não encontrado");
    if ((pay as any).user_id !== userId) throw new Error("Sem permissão");
    if ((pay as any).status === "paid") throw new Error("Já pago");

    const amount = Number((pay as any).amount);
    const fee = await loadFeeForCategory(supabaseAdmin, "atletica_membership");
    const marketplaceFee = computeFee(amount, fee.pct, fee.fixed);

    const origin = process.env.APP_URL || "https://ligasuno.com.br";
    const notification = `${origin}/api/public/payments/mp-webhook`;

    const [firstName, ...rest] = String((pay as any).buyer_name ?? "Sócio").split(" ");
    const pix = await createPixPayment({
      sellerAccessToken: getPlatformAccessToken(),
      amount,
      description: `Associação AAAMD Desbravadores`,
      payerEmail: (pay as any).buyer_email,
      payerFirstName: firstName || "Sócio",
      payerLastName: rest.join(" ") || "AAAMD",
      payerCpf: String((pay as any).buyer_cpf ?? "").replace(/\D/g, ""),
      externalReference: `ath_memb:${(pay as any).id}`,
      notificationUrl: notification,
      applicationFee: marketplaceFee,
      metadata: { athletic_id: (pay as any).athletic_id, user_id: userId },
      expiresInMinutes: 30,
    });

    await supabaseAdmin.from("athletic_membership_payments").update({
      mp_payment_id: String(pix.id),
    }).eq("id", data.payment_id);

    const tx = (pix as any)?.point_of_interaction?.transaction_data ?? {};
    return {
      mp_payment_id: String(pix.id),
      qr_code: tx.qr_code as string | undefined,
      qr_code_base64: tx.qr_code_base64 as string | undefined,
      ticket_url: tx.ticket_url as string | undefined,
      amount,
    };
  });

/* Compra um ingresso online: aloca ticket disponível, cria Pix. */
export const createEventTicketPixPayment = createServerFn({ method: "POST" })
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
    const { getPlatformAccessToken, createPixPayment, loadFeeForCategory, computeFee } = await import("@/lib/mp.server");

    const { data: ev } = await supabaseAdmin
      .from("athletic_events").select("*").eq("id", data.event_id).maybeSingle();
    if (!ev) throw new Error("Evento não encontrado");
    if (!(ev as any).published || !(ev as any).online_sales_open) throw new Error("Vendas online não estão abertas");

    // preço: sócio ou visitante?
    const { data: mem } = await supabaseAdmin
      .from("athletic_memberships").select("id, active, member_until")
      .eq("athletic_id", (ev as any).athletic_id).eq("user_id", userId).maybeSingle();
    const isMember = !!(mem && (mem as any).active && (!(mem as any).member_until || new Date((mem as any).member_until) >= new Date()));
    const amount = Number(isMember ? (ev as any).price_member : (ev as any).price_visitor);
    if (!amount || amount <= 0) throw new Error("Preço inválido para este evento");

    // aloca ticket disponível
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("athletic_event_tickets").select("*").eq("event_id", data.event_id).eq("status", "available").limit(1).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!ticket) throw new Error("Ingressos esgotados. Emita mais lotes na diretoria.");

    // reserva
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

    const fee = await loadFeeForCategory(supabaseAdmin, "atletica_event");
    const marketplaceFee = computeFee(amount, fee.pct, fee.fixed);
    const origin = process.env.APP_URL || "https://ligasuno.com.br";

    const [firstName, ...rest] = String(data.buyer_name).split(" ");
    try {
      const pix = await createPixPayment({
        sellerAccessToken: getPlatformAccessToken(),
        amount,
        description: `Ingresso ${(ev as any).title}`,
        payerEmail: data.buyer_email,
        payerFirstName: firstName || "Ligante",
        payerLastName: rest.join(" ") || "AAAMD",
        payerCpf: String(data.buyer_cpf).replace(/\D/g, ""),
        externalReference: `ath_event:${(ticket as any).id}`,
        notificationUrl: `${origin}/api/public/payments/mp-webhook`,
        applicationFee: marketplaceFee,
        metadata: { athletic_id: (ev as any).athletic_id, user_id: userId, event_id: (ev as any).id },
        expiresInMinutes: 30,
      });
      await supabaseAdmin.from("athletic_event_tickets").update({ mp_payment_id: String(pix.id) }).eq("id", (ticket as any).id);
      const tx = (pix as any)?.point_of_interaction?.transaction_data ?? {};
      return {
        ticket_id: (ticket as any).id,
        code: (ticket as any).code,
        mp_payment_id: String(pix.id),
        qr_code: tx.qr_code as string | undefined,
        qr_code_base64: tx.qr_code_base64 as string | undefined,
        ticket_url: tx.ticket_url as string | undefined,
        amount,
      };
    } catch (e) {
      // libera a reserva
      await supabaseAdmin.from("athletic_event_tickets").update({
        status: "available", buyer_user_id: null, buyer_name: null, buyer_email: null,
        buyer_phone: null, buyer_cpf: null, price_paid: null, sold_channel: null,
      }).eq("id", (ticket as any).id);
      throw e;
    }
  });

/* Compra de um produto (single item) via Pix. */
export const createProductPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1).max(20).default(1),
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
    const { getPlatformAccessToken, createPixPayment, loadFeeForCategory, computeFee } = await import("@/lib/mp.server");

    const { data: prod } = await supabaseAdmin
      .from("athletic_products").select("*").eq("id", data.product_id).maybeSingle();
    if (!prod) throw new Error("Produto não encontrado");
    if (!(prod as any).active) throw new Error("Produto indisponível");
    if ((prod as any).stock != null && Number((prod as any).stock) < data.quantity) throw new Error("Estoque insuficiente");

    const { data: mem } = await supabaseAdmin
      .from("athletic_memberships").select("active, member_until")
      .eq("athletic_id", (prod as any).athletic_id).eq("user_id", userId).maybeSingle();
    const isMember = !!(mem && (mem as any).active && (!(mem as any).member_until || new Date((mem as any).member_until) >= new Date()));

    let unit = Number(isMember && (prod as any).member_price ? (prod as any).member_price : (prod as any).price);
    // desconto geral
    if (Number((prod as any).discount_pct) > 0) unit = unit * (1 - Number((prod as any).discount_pct) / 100);
    // desconto 2ª peça
    let total = unit * data.quantity;
    if (data.quantity >= 2 && Number((prod as any).second_item_discount_pct) > 0) {
      const extras = data.quantity - 1;
      const discount = unit * extras * (Number((prod as any).second_item_discount_pct) / 100);
      total = total - discount;
    }
    total = Math.round(total * 100) / 100;
    const subtotal = Math.round(unit * data.quantity * 100) / 100;

    const { data: order, error: oErr } = await supabaseAdmin.from("athletic_product_orders").insert({
      athletic_id: (prod as any).athletic_id,
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

    await supabaseAdmin.from("athletic_product_order_items").insert({
      order_id: (order as any).id,
      product_id: (prod as any).id,
      title: (prod as any).title,
      unit_price: unit,
      quantity: data.quantity,
      line_total: total,
    });


    const fee = await loadFeeForCategory(supabaseAdmin, "atletica_product");
    const marketplaceFee = computeFee(total, fee.pct, fee.fixed);
    const origin = process.env.APP_URL || "https://ligasuno.com.br";
    const [firstName, ...rest] = String(data.buyer_name).split(" ");

    const pix = await createPixPayment({
      sellerAccessToken: getPlatformAccessToken(),
      amount: total,
      description: `${(prod as any).title} x${data.quantity}`,
      payerEmail: data.buyer_email,
      payerFirstName: firstName || "Cliente",
      payerLastName: rest.join(" ") || "AAAMD",
      payerCpf: String(data.buyer_cpf).replace(/\D/g, ""),
      externalReference: `ath_prod:${(order as any).id}`,
      notificationUrl: `${origin}/api/public/payments/mp-webhook`,
      applicationFee: marketplaceFee,
      metadata: { athletic_id: (prod as any).athletic_id, user_id: userId, product_id: (prod as any).id },
      expiresInMinutes: 30,
    });
    await supabaseAdmin.from("athletic_product_orders").update({ mp_payment_id: String(pix.id) }).eq("id", (order as any).id);
    const tx = (pix as any)?.point_of_interaction?.transaction_data ?? {};
    return {
      order_id: (order as any).id,
      mp_payment_id: String(pix.id),
      qr_code: tx.qr_code as string | undefined,
      qr_code_base64: tx.qr_code_base64 as string | undefined,
      ticket_url: tx.ticket_url as string | undefined,
      amount: total,
    };
  });

/* =====================================================================
   PAGAMENTOS COM CARTÃO (Checkout Pro — Pix + Cartão de crédito/débito)
   =====================================================================
   Retornam init_point para redirecionar o pagador. O webhook (mp-webhook)
   já trata as external_references ath_memb/ath_event/ath_prod.
*/

function appOrigin() {
  return process.env.APP_URL || "https://ligasuno.com.br";
}

/* Associação → cartão */
export const createMembershipCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ payment_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutPreference } = await import("@/lib/mp.server");

    const { data: pay } = await supabaseAdmin
      .from("athletic_membership_payments").select("*").eq("id", data.payment_id).maybeSingle();
    if (!pay) throw new Error("Pagamento não encontrado");
    if ((pay as any).user_id !== userId) throw new Error("Sem permissão");
    if ((pay as any).status === "paid") throw new Error("Já pago");

    const amount = Number((pay as any).amount);
    const origin = appOrigin();
    const pref = await createCheckoutPreference({
      title: `Associação AAAMD Desbravadores`,
      unitPrice: amount,
      payerEmail: (pay as any).buyer_email,
      payerName: (pay as any).buyer_name,
      payerCpf: (pay as any).buyer_cpf,
      externalReference: `ath_memb:${(pay as any).id}`,
      notificationUrl: `${origin}/api/public/payments/mp-webhook`,
      successUrl: `${origin}/atletica?paid=1`,
      failureUrl: `${origin}/atletica?paid=0`,
      pendingUrl: `${origin}/atletica?paid=pending`,
      metadata: { athletic_id: (pay as any).athletic_id, user_id: userId },
    });
    return { init_point: pref.init_point, amount };
  });

/* Ingresso online → cartão */
export const createEventTicketCardPayment = createServerFn({ method: "POST" })
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
    const { createCheckoutPreference } = await import("@/lib/mp.server");

    const { data: ev } = await supabaseAdmin
      .from("athletic_events").select("*").eq("id", data.event_id).maybeSingle();
    if (!ev) throw new Error("Evento não encontrado");
    if (!(ev as any).published || !(ev as any).online_sales_open) throw new Error("Vendas online não estão abertas");

    const { data: mem } = await supabaseAdmin
      .from("athletic_memberships").select("id, active, member_until")
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

    const origin = appOrigin();
    try {
      const pref = await createCheckoutPreference({
        title: `Ingresso ${(ev as any).title}`,
        unitPrice: amount,
        payerEmail: data.buyer_email,
        payerName: data.buyer_name,
        payerCpf: data.buyer_cpf,
        externalReference: `ath_event:${(ticket as any).id}`,
        notificationUrl: `${origin}/api/public/payments/mp-webhook`,
        successUrl: `${origin}/atletica?paid=1`,
        failureUrl: `${origin}/atletica?paid=0`,
        pendingUrl: `${origin}/atletica?paid=pending`,
        metadata: { athletic_id: (ev as any).athletic_id, user_id: userId, event_id: (ev as any).id },
      });
      return { init_point: pref.init_point, amount, ticket_id: (ticket as any).id, code: (ticket as any).code };
    } catch (e) {
      await supabaseAdmin.from("athletic_event_tickets").update({
        status: "available", buyer_user_id: null, buyer_name: null, buyer_email: null,
        buyer_phone: null, buyer_cpf: null, price_paid: null, sold_channel: null,
      }).eq("id", (ticket as any).id);
      throw e;
    }
  });

/* CARRINHO — checkout Pro (Pix + Cartão) para 1+ produtos.
   Cria uma order única com N itens e retorna init_point. */
export const createCartCheckout = createServerFn({ method: "POST" })
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
    const { createCheckoutPreference } = await import("@/lib/mp.server");

    const ids = data.items.map((it) => it.product_id);
    const { data: prods } = await supabaseAdmin
      .from("athletic_products").select("*").in("id", ids);
    const productsById = new Map<string, any>();
    for (const p of (prods as any[]) ?? []) productsById.set(p.id, p);

    const { data: mem } = await supabaseAdmin
      .from("athletic_memberships").select("active, member_until")
      .eq("athletic_id", data.athletic_id).eq("user_id", userId).maybeSingle();
    const isMember = !!(mem && (mem as any).active && (!(mem as any).member_until || new Date((mem as any).member_until) >= new Date()));

    // valida cada item e calcula totais
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

    const origin = appOrigin();
    const titleSummary = lines.length === 1
      ? `${lines[0].title}${lines[0].qty > 1 ? ` x${lines[0].qty}` : ""}`
      : `Pedido AAAMD (${lines.reduce((s, l) => s + l.qty, 0)} itens)`;

    const pref = await createCheckoutPreference({
      title: titleSummary,
      unitPrice: total,
      payerEmail: data.buyer_email,
      payerName: data.buyer_name,
      payerCpf: data.buyer_cpf,
      externalReference: `ath_prod:${(order as any).id}`,
      notificationUrl: `${origin}/api/public/payments/mp-webhook`,
      successUrl: `${origin}/atletica?paid=1`,
      failureUrl: `${origin}/atletica?paid=0`,
      pendingUrl: `${origin}/atletica?paid=pending`,
      metadata: { athletic_id: data.athletic_id, user_id: userId },
    });
    await supabaseAdmin.from("athletic_product_orders")
      .update({ mp_payment_id: null }).eq("id", (order as any).id);

    return {
      order_id: (order as any).id,
      init_point: pref.init_point,
      amount: total,
    };
  });
