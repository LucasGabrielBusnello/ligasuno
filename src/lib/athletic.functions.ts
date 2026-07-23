import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helper: gera código curto e legível para ingressos (10 chars base36)
function shortCode() {
  return (crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36))
    .toUpperCase()
    .slice(0, 10);
}

/* ============ SÓCIOS / MEMBROS ============ */

export const upsertAthleticMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      athletic_id: z.string().uuid(),
      full_name: z.string().min(2).max(150),
      email: z.string().email().max(200),
      phone: z.string().max(40).optional().nullable(),
      cpf: z.string().max(20).optional().nullable(),
      matricula: z.string().max(50).optional().nullable(),
      semestre: z.string().max(20).optional().nullable(),
      role: z.enum(["socio", "diretor", "presidente"]).default("socio"),
      member_until: z.string().optional().nullable(),
      active: z.boolean().default(true),
      added_manually: z.boolean().default(true),
      director_tabs: z.array(z.string()).optional().nullable(),
      cycle_id: z.string().uuid().optional().nullable(),
      send_invite: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // authorization: is director?
    const { data: canManage } = await supabase.rpc("is_athletic_director", {
      _user_id: userId, _athletic_id: data.athletic_id,
    });
    if (!canManage) throw new Error("Sem permissão");

    // Tenta ligar ao user_id via profiles.email
    let linked_user_id: string | null = null;
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (prof) linked_user_id = (prof as any).id;

    // Se veio cycle_id, busca o ciclo para definir member_until automaticamente
    let effective_member_until = data.member_until ?? null;

    if (data.cycle_id) {
      const { data: cyc } = await supabaseAdmin
        .from("athletic_membership_cycles").select("ends_at").eq("id", data.cycle_id).maybeSingle();
      if (cyc && !effective_member_until) effective_member_until = (cyc as any).ends_at;
    }

    const payload: any = {
      athletic_id: data.athletic_id,
      full_name: data.full_name,
      email: data.email.toLowerCase(),
      phone: data.phone ?? null,
      cpf: data.cpf ?? null,
      matricula: data.matricula ?? null,
      semestre: data.semestre ?? null,
      role: data.role,
      member_until: effective_member_until,
      active: data.active,
      added_manually: data.added_manually,
      user_id: linked_user_id,
      director_tabs: data.director_tabs ?? null,
      cycle_id: data.cycle_id ?? null,
    };

    let result_id: string;
    if (data.id) {
      const { error } = await supabaseAdmin.from("athletic_memberships")
        .update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      result_id = data.id;
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("athletic_memberships").upsert(payload, { onConflict: "athletic_id,email" })
        .select("id").single();
      if (error) throw new Error(error.message);
      result_id = (row as any).id;
    }

    // Envia convite por e-mail se solicitado e o e-mail ainda não tem conta
    if (data.send_invite && !linked_user_id) {
      try {
        const { data: ath } = await supabaseAdmin
          .from("athletics").select("name, slug, primary_color").eq("id", data.athletic_id).maybeSingle();
        const ath_name: string = (ath as any)?.name ?? "sua atlética";
        const brand: string = (ath as any)?.primary_color ?? "#1f5132";

        const { sendGmail, emailLayout, emailInfoCard } = await import("./gmail.server");
        await sendGmail({
          to: data.email,
          subject: `Você foi cadastrado(a) como sócio(a) da ${ath_name}`,
          html: emailLayout({
            title: `Bem-vindo(a) à ${ath_name}!`,
            brandColor: brand,
            leagueName: ath_name,
            bodyHtml: `<p>Olá, <strong>${data.full_name}</strong>! A diretoria da <strong>${ath_name}</strong> cadastrou você como sócio(a) no site do MEDUNO.</p>
              <p>Para acessar seus benefícios, agenda, carteirinha digital e todos os recursos da atlética, basta criar sua conta com este mesmo e-mail (<strong>${data.email}</strong>). Assim que você concluir o cadastro, sua condição de sócio(a) será ativada automaticamente.</p>
              ${emailInfoCard({
                title: "Como acessar",
                brandColor: brand,
                rows: [
                  { label: "Site", value: "https://ligasuno.com.br" },
                  { label: "E-mail cadastrado", value: data.email },
                  { label: "Atlética", value: ath_name },
                ],
              })}
              <p>Se já tem conta com outro e-mail, atualize seu e-mail no perfil para o mesmo utilizado neste convite.</p>`,
            ctaLabel: "Criar minha conta",
            ctaUrl: `https://ligasuno.com.br/auth`,
            signature: `— Diretoria da ${ath_name}`,
          }),
        });
      } catch (e) {
        console.error("upsertAthleticMember: falha ao enviar convite", e);
      }
    }

    return { id: result_id };
  });


export const deleteAthleticMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ athletic_id: z.string().uuid(), member_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", {
      _user_id: userId, _athletic_id: data.athletic_id,
    });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_memberships").delete().eq("id", data.member_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Auto-associar (usuário logado se cadastra como sócio pendente de pagamento) */
export const requestSelfMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      full_name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional().nullable(),
      cpf: z.string().min(11),
      matricula: z.string().min(1),
      semestre: z.string().min(1),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ath } = await supabaseAdmin
      .from("athletics").select("membership_price, membership_period_days").eq("id", data.athletic_id).maybeSingle();
    if (!ath) throw new Error("Atlética não encontrada");

    // Ciclo atual da atlética (se houver) — define preço e validade
    const { data: cycle } = await (supabaseAdmin as any)
      .from("athletic_membership_cycles")
      .select("id, ends_at, price_new, price_renewal, open")
      .eq("athletic_id", data.athletic_id)
      .eq("is_current", true)
      .maybeSingle();

    // Detecta renovação (usuário já teve associação nesta atlética)
    let isRenewal = false;
    if (cycle) {
      const { data: prev } = await (supabaseAdmin as any)
        .from("athletic_memberships").select("id")
        .eq("athletic_id", data.athletic_id).eq("user_id", userId).maybeSingle();
      isRenewal = !!prev;
    }

    const amount = cycle
      ? Number(isRenewal ? (cycle as any).price_renewal : (cycle as any).price_new) || 0
      : Number((ath as any).membership_price) || 0;

    // Cria/atualiza membership como pending (active=false até pagamento)
    const { data: mem, error: mErr } = await supabaseAdmin
      .from("athletic_memberships").upsert({
        athletic_id: data.athletic_id,
        user_id: userId,
        full_name: data.full_name,
        email: data.email.toLowerCase(),
        phone: data.phone ?? null,
        cpf: data.cpf,
        matricula: data.matricula,
        semestre: data.semestre,
        role: "socio",
        active: false,
        added_manually: false,
        cycle_id: cycle ? (cycle as any).id : null,
      } as any, { onConflict: "athletic_id,email" }).select("id").single();
    if (mErr) throw new Error(mErr.message);

    // Cria pagamento pendente
    const { data: pay, error: pErr } = await supabaseAdmin
      .from("athletic_membership_payments").insert({
        athletic_id: data.athletic_id,
        membership_id: (mem as any).id,
        user_id: userId,
        amount,
        period_days: Number((ath as any).membership_period_days) || 180,
        buyer_name: data.full_name,
        buyer_email: data.email.toLowerCase(),
        buyer_cpf: data.cpf,
        matricula: data.matricula,
        semestre: data.semestre,
        status: "pending",
      }).select("id, amount").single();
    if (pErr) throw new Error(pErr.message);

    return {
      membership_id: (mem as any).id,
      payment_id: (pay as any).id,
      amount: (pay as any).amount,
      cycle_ends_at: cycle ? (cycle as any).ends_at : null,
    };
  });

/* Diretor confirma pagamento manual da associação → ativa sócio + cria entrada de caixa */
export const confirmMembershipPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      payment_id: z.string().uuid(),
      method: z.enum(["pix", "dinheiro", "cartao", "outro"]).default("pix"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", {
      _user_id: userId, _athletic_id: data.athletic_id,
    });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pay } = await supabaseAdmin
      .from("athletic_membership_payments").select("*").eq("id", data.payment_id).maybeSingle();
    if (!pay) throw new Error("Pagamento não encontrado");
    if ((pay as any).status === "paid") return { ok: true, already: true };

    // Se a membership tiver ciclo vinculado, usa a data final do ciclo; senão fallback em period_days
    let untilStr: string;
    let cycleEndsAt: string | null = null;
    if ((pay as any).membership_id) {
      const { data: memRow } = await (supabaseAdmin as any)
        .from("athletic_memberships").select("cycle_id").eq("id", (pay as any).membership_id).maybeSingle();
      if (memRow && (memRow as any).cycle_id) {
        const { data: cyc } = await (supabaseAdmin as any)
          .from("athletic_membership_cycles").select("ends_at").eq("id", (memRow as any).cycle_id).maybeSingle();
        if (cyc) cycleEndsAt = (cyc as any).ends_at;
      }
    }
    if (cycleEndsAt) {
      untilStr = String(cycleEndsAt).slice(0, 10);
    } else {
      const untilDate = new Date();
      untilDate.setDate(untilDate.getDate() + (Number((pay as any).period_days) || 180));
      untilStr = untilDate.toISOString().slice(0, 10);
    }

    await supabaseAdmin.from("athletic_membership_payments").update({
      status: "paid",
      member_until: untilStr,
    }).eq("id", data.payment_id);

    if ((pay as any).membership_id) {
      await supabaseAdmin.from("athletic_memberships").update({
        active: true, member_until: untilStr,
      }).eq("id", (pay as any).membership_id);
    }

    await supabaseAdmin.from("athletic_cash_entries").insert({
      athletic_id: data.athletic_id,
      category: "membership",
      description: `Associação de ${(pay as any).buyer_name} (${data.method})`,
      gross_amount: (pay as any).amount,
      net_amount: (pay as any).amount,
      is_income: true,
      related_membership_payment_id: data.payment_id,
      created_by: userId,
    });

    return { ok: true };
  });

/* ============ PRODUTOS / COLEÇÕES ============ */

export const upsertCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      athletic_id: z.string().uuid(),
      name: z.string().min(1).max(80),
      slug: z.string().min(1).max(80),
      description: z.string().max(500).optional().nullable(),
      cover_url: z.string().url().optional().nullable(),
      display_order: z.number().int().default(0),
      active: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", {
      _user_id: userId, _athletic_id: data.athletic_id,
    });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      athletic_id: data.athletic_id, name: data.name, slug: data.slug,
      description: data.description ?? null, cover_url: data.cover_url ?? null,
      display_order: data.display_order, active: data.active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("athletic_collections").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("athletic_collections").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_collections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      athletic_id: z.string().uuid(),
      collection_id: z.string().uuid().optional().nullable(),
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional().nullable(),
      images: z.array(z.string()).default([]),
      price: z.coerce.number().min(0),
      member_price: z.coerce.number().min(0).optional().nullable(),
      discount_pct: z.coerce.number().min(0).max(100).default(0),
      second_item_discount_pct: z.coerce.number().min(0).max(100).default(0),
      stock: z.coerce.number().int().min(0).optional().nullable(),
      is_highlight: z.boolean().default(false),
      is_new: z.boolean().default(false),
      badge_text: z.string().max(30).optional().nullable(),
      active: z.boolean().default(true),
      show_stock_warning: z.boolean().default(false),
      stock_warning_threshold: z.coerce.number().int().min(0).optional().nullable(),
      sales_deadline: z.string().optional().nullable(),
    }).parse(i),
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      athletic_id: data.athletic_id,
      collection_id: data.collection_id ?? null,
      title: data.title,
      description: data.description ?? null,
      images: data.images,
      price: data.price,
      member_price: data.member_price ?? null,
      discount_pct: data.discount_pct,
      second_item_discount_pct: data.second_item_discount_pct,
      stock: data.stock ?? null,
      is_highlight: data.is_highlight,
      is_new: data.is_new,
      badge_text: data.badge_text ?? null,
      active: data.active,
      show_stock_warning: data.show_stock_warning,
      stock_warning_threshold: data.stock_warning_threshold ?? null,
      sales_deadline: data.sales_deadline ? new Date(data.sales_deadline).toISOString() : null,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("athletic_products").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("athletic_products").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ EVENTOS + INGRESSOS ============ */

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      athletic_id: z.string().uuid(),
      title: z.string().min(1).max(200),
      description: z.string().max(3000).optional().nullable(),
      location: z.string().max(200).optional().nullable(),
      starts_at: z.string().optional().nullable(),
      ends_at: z.string().optional().nullable(),
      image_url: z.string().url().optional().nullable(),
      gallery: z.array(z.string().url()).default([]),
      theme_color: z.string().max(20).optional().nullable(),
      price_member: z.number().min(0),
      price_visitor: z.number().min(0),
      total_tickets: z.number().int().min(0),
      published: z.boolean().default(true),
      online_sales_open: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      athletic_id: data.athletic_id,
      title: data.title,
      description: data.description ?? null,
      location: data.location ?? null,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
      image_url: data.image_url ?? null,
      gallery: data.gallery,
      theme_color: data.theme_color ?? null,
      price_member: data.price_member,
      price_visitor: data.price_visitor,
      total_tickets: data.total_tickets,
      published: data.published,
      online_sales_open: data.online_sales_open,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("athletic_events").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("athletic_events").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Gera um lote de ingressos físicos com códigos únicos para QR */
export const generateTicketBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      event_id: z.string().uuid(),
      quantity: z.number().int().min(1).max(500),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("athletic_events").select("total_tickets").eq("id", data.event_id).maybeSingle();
    if (!ev) throw new Error("Evento não encontrado");

    const { count } = await supabaseAdmin
      .from("athletic_event_tickets").select("id", { count: "exact", head: true }).eq("event_id", data.event_id);
    const already = count ?? 0;
    if (already + data.quantity > Number((ev as any).total_tickets)) {
      throw new Error(`Excede o total de ingressos do evento (${(ev as any).total_tickets}). Já emitidos: ${already}.`);
    }

    const batch_id = crypto.randomUUID();
    const rows: any[] = [];
    for (let i = 0; i < data.quantity; i++) {
      rows.push({ event_id: data.event_id, code: shortCode(), batch_id, status: "available" });
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("athletic_event_tickets").insert(rows).select("id, code");
    if (error) throw new Error(error.message);
    return { batch_id, tickets: inserted };
  });

/* Registra venda manual (após leitura do QR): valida disponibilidade, marca como vendido, decrementa, cria caixa */
export const registerManualTicketSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      event_id: z.string().uuid(),
      code: z.string().min(4).max(40),
      buyer_name: z.string().min(2).max(150),
      buyer_email: z.string().email(),
      buyer_phone: z.string().max(40).optional().nullable(),
      buyer_cpf: z.string().min(11).max(20),
      price_paid: z.number().min(0),
      payment_methods: z.object({
        pix: z.number().min(0).default(0),
        dinheiro: z.number().min(0).default(0),
        cartao: z.number().min(0).default(0),
      }),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ticket } = await supabaseAdmin
      .from("athletic_event_tickets").select("*").eq("code", data.code.toUpperCase()).maybeSingle();
    if (!ticket) throw new Error("Ingresso não encontrado (código inválido)");
    if ((ticket as any).event_id !== data.event_id) throw new Error("Este ingresso pertence a outro evento");
    if ((ticket as any).status !== "available") {
      throw new Error(`Ingresso já foi vendido em ${new Date((ticket as any).sold_at).toLocaleString("pt-BR")} para ${(ticket as any).buyer_name ?? "—"}`);
    }

    const sum = data.payment_methods.pix + data.payment_methods.dinheiro + data.payment_methods.cartao;
    if (Math.abs(sum - data.price_paid) > 0.01) {
      throw new Error(`Soma dos pagamentos (R$ ${sum.toFixed(2)}) diferente do preço (R$ ${data.price_paid.toFixed(2)})`);
    }

    const { error: upErr } = await supabaseAdmin.from("athletic_event_tickets").update({
      status: "sold",
      sold_channel: "manual",
      buyer_name: data.buyer_name,
      buyer_email: data.buyer_email.toLowerCase(),
      buyer_phone: data.buyer_phone ?? null,
      buyer_cpf: data.buyer_cpf,
      price_paid: data.price_paid,
      payment_methods: data.payment_methods,
      sold_at: new Date().toISOString(),
      sold_by: userId,
    }).eq("id", (ticket as any).id);
    if (upErr) throw new Error(upErr.message);

    // Incrementa contador do evento
    const { data: evNow } = await supabaseAdmin
      .from("athletic_events").select("tickets_sold, title").eq("id", data.event_id).single();
    await supabaseAdmin.from("athletic_events").update({
      tickets_sold: (Number((evNow as any).tickets_sold) || 0) + 1,
    }).eq("id", data.event_id);

    // Registra no caixa (venda manual: sem taxa de MP)
    await supabaseAdmin.from("athletic_cash_entries").insert({
      athletic_id: data.athletic_id,
      category: "event_manual",
      description: `Ingresso #${(ticket as any).code} — ${(evNow as any).title} — ${data.buyer_name}`,
      gross_amount: data.price_paid,
      net_amount: data.price_paid,
      is_income: true,
      related_ticket_id: (ticket as any).id,
      created_by: userId,
    });

    // Envia e-mail (best-effort; não falha a venda se o envio quebrar)
    try {
      const { sendGmail, emailLayout } = await import("@/lib/gmail.server");
      const html = emailLayout({
        title: `Ingresso confirmado`,
        leagueName: `AAAMD Desbravadores`,
        brandColor: "#F97316",
        bodyHtml: `
          <p>Olá <strong>${data.buyer_name}</strong>, sua compra foi confirmada.</p>
          <p><strong>Evento:</strong> ${(evNow as any).title}</p>
          <p><strong>Código do ingresso:</strong><br/>
            <code style="background:#111;color:#F97316;padding:8px 14px;border-radius:8px;font-size:18px;letter-spacing:2px">${(ticket as any).code}</code>
          </p>
          <p>Apresente este e-mail ou o ingresso físico na entrada do evento.</p>
        `,
      });
      await sendGmail({
        to: data.buyer_email,
        subject: `Ingresso — ${(evNow as any).title}`,
        html,
      });
    } catch (e) {
      console.warn("[athletic] falha ao enviar e-mail do ingresso", e);
    }

    return { ok: true, ticket_id: (ticket as any).id };
  });

/* Diretor lança entrada/saída manual no caixa da atlética */
export const addAthleticCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      category: z.enum(["product", "event_online", "event_manual", "membership", "manual", "withdraw"]).default("manual"),
      description: z.string().min(1).max(200),
      gross_amount: z.number().min(0),
      is_income: z.boolean().default(true),
      receipt_url: z.string().url().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_cash_entries").insert({
      athletic_id: data.athletic_id,
      category: data.category,
      description: data.description,
      gross_amount: data.gross_amount,
      net_amount: data.gross_amount,
      is_income: data.is_income,
      receipt_url: data.receipt_url ?? null,
      created_by: userId,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Diretor exclui um lançamento do caixa */
export const deleteAthleticCashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ athletic_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_cash_entries").delete().eq("id", data.id).eq("athletic_id", data.athletic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Atualiza a atlética (valor da associação, período, cores, descrição, capa) */
export const updateAthletic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(150).optional(),
      description: z.string().max(2000).optional().nullable(),
      logo_url: z.string().url().optional().nullable(),
      cover_url: z.string().url().optional().nullable(),
      primary_color: z.string().max(20).optional(),
      secondary_color: z.string().max(20).optional(),
      membership_price: z.number().min(0).optional(),
      membership_period_days: z.number().int().min(1).optional(),
      published: z.boolean().optional(),
      history_title: z.string().max(200).optional().nullable(),
      history_description: z.string().max(3000).optional().nullable(),
      history_images: z.array(z.string()).optional(),
    }).parse(i),
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("athletics").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ ESPORTES ============ */
export const upsertSport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      athletic_id: z.string().uuid(),
      name: z.string().min(1).max(120),
      description: z.string().max(2000).optional().nullable(),
      image_url: z.string().optional().nullable(),
      coach: z.string().max(150).optional().nullable(),
      schedule: z.string().max(300).optional().nullable(),
      display_order: z.coerce.number().int().default(0),
      active: z.boolean().default(true),
      gender: z.enum(["masculino", "feminino", "misto"]).default("misto"),
      max_capacity: z.coerce.number().int().min(0).optional().nullable(),
      enrollment_open: z.boolean().default(true),
      whatsapp_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("athletic_sports").update(rest as any).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    } else {
      const { data: ins, error } = await supabaseAdmin.from("athletic_sports").insert(rest as any).select("id").single();
      if (error) throw new Error(error.message);
      return { id: (ins as any).id };
    }
  });

export const deleteSport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_sports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ PARCEIROS ============ */
export const upsertPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      athletic_id: z.string().uuid(),
      name: z.string().min(1).max(150),
      description: z.string().max(2000).optional().nullable(),
      image_url: z.string().optional().nullable(),
      discount_text: z.string().max(300).optional().nullable(),
      link_url: z.string().optional().nullable(),
      display_order: z.coerce.number().int().default(0),
      active: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("athletic_partners" as any).update(rest as any).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await supabaseAdmin.from("athletic_partners" as any).insert(rest as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (ins as any).id };
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", { _user_id: userId, _athletic_id: data.athletic_id });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_partners" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ INSCRIÇÕES ESPORTES ============ */
export const enrollInSport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sport_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verifica esporte + capacidade
    const { data: sport, error: sErr } = await supabase
      .from("athletic_sports")
      .select("id, athletic_id, active, enrollment_open, max_capacity")
      .eq("id", data.sport_id)
      .maybeSingle();
    if (sErr || !sport) throw new Error("Esporte não encontrado");
    if (!sport.active || !(sport as any).enrollment_open) throw new Error("Inscrições fechadas");
    const isMember = await supabase.rpc("is_athletic_member", { _user_id: userId, _athletic_id: sport.athletic_id });
    if (!isMember.data) throw new Error("Apenas sócios ativos podem se inscrever");
    if ((sport as any).max_capacity) {
      const { count } = await supabase.from("athletic_sport_enrollments" as any)
        .select("id", { count: "exact", head: true }).eq("sport_id", data.sport_id);
      if ((count ?? 0) >= (sport as any).max_capacity) throw new Error("Vagas esgotadas");
    }
    const { error } = await supabase.from("athletic_sport_enrollments" as any)
      .insert({ sport_id: data.sport_id, user_id: userId } as any);
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unenrollFromSport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sport_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("athletic_sport_enrollments" as any)
      .delete().eq("sport_id", data.sport_id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ ENTREGAS & VENDAS MANUAIS DE PRODUTOS ============ */

export const updateOrderItemDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      item_id: z.string().uuid(),
      delivered: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", {
      _user_id: userId, _athletic_id: data.athletic_id,
    });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("athletic_product_order_items" as any)
      .update({
        delivery_status: data.delivered ? "delivered" : "pending",
        delivered_at: data.delivered ? new Date().toISOString() : null,
        delivered_by: data.delivered ? userId : null,
      } as any)
      .eq("id", data.item_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerManualProductSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1).max(50),
      buyer_name: z.string().min(2).max(150),
      buyer_email: z.string().email(),
      buyer_cpf: z.string().min(11).max(20),
      buyer_registration: z.string().max(50).optional().nullable(),
      buyer_semester: z.number().int().min(0).max(20).optional().nullable(),
      method: z.enum(["pix", "dinheiro", "cartao"]).default("dinheiro"),
      apply_member_price: z.boolean().default(false),
      notes: z.string().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_athletic_director", {
      _user_id: userId, _athletic_id: data.athletic_id,
    });
    if (!ok) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prod } = await supabaseAdmin
      .from("athletic_products").select("*").eq("id", data.product_id).maybeSingle();
    if (!prod) throw new Error("Produto não encontrado");
    if ((prod as any).athletic_id !== data.athletic_id) throw new Error("Produto de outra atlética");

    let unit = Number(data.apply_member_price && (prod as any).member_price ? (prod as any).member_price : (prod as any).price);
    if (Number((prod as any).discount_pct) > 0) unit = unit * (1 - Number((prod as any).discount_pct) / 100);
    let lineTotal = unit * data.quantity;
    if (data.quantity >= 2 && Number((prod as any).second_item_discount_pct) > 0) {
      const extras = data.quantity - 1;
      lineTotal -= unit * extras * (Number((prod as any).second_item_discount_pct) / 100);
    }
    unit = Math.round(unit * 100) / 100;
    lineTotal = Math.round(lineTotal * 100) / 100;
    const rawSubtotal = Math.round(unit * data.quantity * 100) / 100;

    const { data: order, error: oErr } = await supabaseAdmin
      .from("athletic_product_orders").insert({
        athletic_id: data.athletic_id,
        user_id: null,
        buyer_name: data.buyer_name,
        buyer_email: data.buyer_email.toLowerCase(),
        buyer_cpf: data.buyer_cpf,
        buyer_registration: data.buyer_registration ?? null,
        buyer_semester: data.buyer_semester ?? null,
        subtotal: rawSubtotal,
        discount_total: rawSubtotal - lineTotal,
        total: lineTotal,
        status: "paid",
        source: "manual",
        notes: `Venda manual (${data.method})` + (data.notes ? ` — ${data.notes}` : ""),
      } as any).select("id").single();
    if (oErr) throw new Error(oErr.message);

    await supabaseAdmin.from("athletic_product_order_items").insert({
      order_id: (order as any).id,
      product_id: (prod as any).id,
      title: (prod as any).title,
      unit_price: unit,
      quantity: data.quantity,
      line_total: lineTotal,
    });

    // desconta estoque
    if ((prod as any).stock != null) {
      const newStock = Math.max(0, Number((prod as any).stock) - data.quantity);
      await supabaseAdmin.from("athletic_products").update({ stock: newStock }).eq("id", (prod as any).id);
    }

    // Enviar recibo por e-mail
    try {
      const { data: ath } = await supabaseAdmin
        .from("athletics").select("name, primary_color").eq("id", data.athletic_id).maybeSingle();
      const brand: string = (ath as any)?.primary_color ?? "#1f5132";
      const athName: string = (ath as any)?.name ?? "AAAMD";
      const { sendGmail, emailLayout, emailInfoCard } = await import("./gmail.server");
      await sendGmail({
        to: data.buyer_email,
        subject: `Recibo de compra — ${athName}`,
        html: emailLayout({
          title: `Obrigado pela sua compra, ${data.buyer_name.split(" ")[0]}!`,
          brandColor: brand,
          leagueName: athName,
          bodyHtml: `<p>Registramos sua compra na <strong>${athName}</strong>. Guarde este e-mail como comprovante.</p>
            ${emailInfoCard({
              title: "Detalhes",
              brandColor: brand,
              rows: [
                { label: "Produto", value: `${(prod as any).title} × ${data.quantity}` },
                { label: "Valor unitário", value: `R$ ${unit.toFixed(2)}` },
                { label: "Total pago", value: `R$ ${lineTotal.toFixed(2)}` },
                { label: "Forma de pagamento", value: data.method.toUpperCase() },
                { label: "Pedido", value: (order as any).id.slice(0, 8).toUpperCase() },
              ],
            })}
            <p>Assim que retirar seu produto, o status de entrega será marcado no sistema.</p>`,
          signature: `— Diretoria da ${athName}`,
        }),
      });
    } catch (e) {
      console.error("registerManualProductSale: falha ao enviar recibo", e);
    }

    return { ok: true, order_id: (order as any).id };
  });

export const retryProductOrderCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ order_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildCheckoutUrl } = await import("@/lib/infinitepay.server");

    const { data: order } = await supabaseAdmin
      .from("athletic_product_orders").select("*").eq("id", data.order_id).maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    if ((order as any).user_id !== userId) throw new Error("Sem permissão");
    if ((order as any).status !== "pending") throw new Error("Pedido não está pendente");

    const { data: items } = await supabaseAdmin
      .from("athletic_product_order_items").select("title,quantity,unit_price,line_total").eq("order_id", data.order_id);
    const lines = ((items as any[]) ?? []);
    if (lines.length === 0) throw new Error("Pedido sem itens");

    const { data: acc } = await supabaseAdmin
      .from("athletic_infinitepay_accounts").select("handle").eq("athletic_id", (order as any).athletic_id).maybeSingle();
    const handle = (acc as any)?.handle;
    if (!handle) throw new Error("InfinitePay não conectada para esta atlética");

    const origin = (process.env.APP_URL || process.env.PUBLIC_APP_URL || "https://ligasuno.com.br").replace(/\/$/, "");
    const nsu = `ath_prod:${(order as any).id}`;
    const checkout_url = await buildCheckoutUrl({
      handle,
      orderNsu: nsu,
      redirectUrl: `${origin}/atletica?paid=1&nsu=${encodeURIComponent(nsu)}`,
      webhookUrl: `${origin}/api/public/payments/infinitepay-webhook`,
      customerName: (order as any).buyer_name,
      customerEmail: (order as any).buyer_email,
      customerCellphone: (order as any).buyer_phone ?? undefined,
      items: lines.map((l) => ({
        name: l.title,
        quantity: Number(l.quantity),
        price: Math.round((Number(l.line_total) / Number(l.quantity)) * 100),
      })),
    });
    return { checkout_url };
  });

