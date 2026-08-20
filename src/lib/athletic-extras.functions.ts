import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertDirector(supabase: any, userId: string, athletic_id: string) {
  const { data: ok } = await supabase.rpc("is_athletic_director", {
    _user_id: userId,
    _athletic_id: athletic_id,
  });
  if (!ok) throw new Error("Sem permissão");
}

/* ============ MANUTENÇÃO ============ */

export const setAthleticMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ athletic_id: z.string().uuid(), enabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("athletics")
      .update({ maintenance_enabled: data.enabled } as any)
      .eq("id", data.athletic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCamedMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("has_camed_panel_access", { _user_id: userId });
    if (!allowed) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("camed_settings")
      .update({ maintenance_enabled: data.enabled, updated_at: new Date().toISOString() } as any)
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ EXCLUIR PAGAMENTO PENDENTE DE ASSOCIAÇÃO ============ */

export const deletePendingMembershipPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ athletic_id: z.string().uuid(), payment_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay } = await supabaseAdmin
      .from("athletic_membership_payments")
      .select("id,status,athletic_id")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (!pay) throw new Error("Não encontrado");
    if ((pay as any).athletic_id !== data.athletic_id) throw new Error("Outra atlética");
    if ((pay as any).status === "paid") throw new Error("Pagamento já foi confirmado");
    const { error } = await supabaseAdmin
      .from("athletic_membership_payments")
      .delete()
      .eq("id", data.payment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ AUTOCOMPLETE DE COMPRADORES POR E-MAIL ============ */

export const searchBuyerSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ athletic_id: z.string().uuid(), query: z.string().min(1).max(100) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.toLowerCase().trim();
    if (!q) return { items: [] };
    const pattern = `%${q}%`;

    // Buscar por e-mail em profiles e pedidos anteriores; unir e desduplicar.
    const [profRes, orderRes, memRes, ticketRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("email,full_name,cpf,phone,matricula,current_semester")
        .ilike("email", pattern)
        .limit(6),
      supabaseAdmin
        .from("athletic_product_orders")
        .select("buyer_email,buyer_name,buyer_cpf,buyer_registration,buyer_semester")
        .eq("athletic_id", data.athletic_id)
        .ilike("buyer_email", pattern)
        .limit(6),
      supabaseAdmin
        .from("athletic_memberships")
        .select("email,full_name,cpf,phone,matricula,semestre")
        .eq("athletic_id", data.athletic_id)
        .ilike("email", pattern)
        .limit(6),
      supabaseAdmin
        .from("athletic_event_tickets")
        .select("buyer_email,buyer_name,buyer_cpf")
        .ilike("buyer_email", pattern)
        .limit(6),
    ]);

    const map = new Map<string, any>();
    function push(email: string | null | undefined, entry: any) {
      if (!email) return;
      const key = email.toLowerCase();
      const cur = map.get(key) ?? { email: key };
      map.set(key, {
        email: key,
        full_name: cur.full_name ?? entry.full_name ?? null,
        cpf: cur.cpf ?? entry.cpf ?? null,
        phone: cur.phone ?? entry.phone ?? null,
        matricula: cur.matricula ?? entry.matricula ?? null,
        semestre: cur.semestre ?? entry.semestre ?? null,
      });
    }
    for (const r of (profRes.data as any[]) ?? [])
      push(r.email, {
        full_name: r.full_name,
        cpf: r.cpf,
        phone: r.phone,
        matricula: r.matricula,
        semestre: r.current_semester ? String(r.current_semester) : null,
      });
    for (const r of (memRes.data as any[]) ?? [])
      push(r.email, {
        full_name: r.full_name,
        cpf: r.cpf,
        phone: r.phone,
        matricula: r.matricula,
        semestre: r.semestre,
      });
    for (const r of (orderRes.data as any[]) ?? [])
      push(r.buyer_email, {
        full_name: r.buyer_name,
        cpf: r.buyer_cpf,
        matricula: r.buyer_registration,
        semestre: r.buyer_semester ? String(r.buyer_semester) : null,
      });
    for (const r of (ticketRes.data as any[]) ?? [])
      push(r.buyer_email, { full_name: r.buyer_name, cpf: r.buyer_cpf });

    const items = Array.from(map.values())
      .sort((a, b) => a.email.indexOf(q) - b.email.indexOf(q) || a.email.localeCompare(b.email))
      .slice(0, 4);
    return { items };
  });

/* ============ PAGAMENTOS PENDENTES (PRODUTOS E INGRESSOS) ============ */

export const listPendingProductAndTicketPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ordersRes, ticketsRes] = await Promise.all([
      supabaseAdmin
        .from("athletic_product_orders")
        .select(
          "id,total,created_at,buyer_name,buyer_email,buyer_cpf,buyer_phone,buyer_registration,buyer_semester,user_id,source,athletic_product_order_items(title,quantity)",
        )
        .eq("athletic_id", data.athletic_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("athletic_event_tickets")
        .select("id,price_paid,sold_at,buyer_name,buyer_email,buyer_cpf,event_id,athletic_events!inner(title,athletic_id)")
        .eq("athletic_events.athletic_id", data.athletic_id)
        .eq("status", "reserved" as any)
        .order("sold_at", { ascending: false })
        .limit(200),
    ]);

    return {
      orders: (ordersRes.data as any[]) ?? [],
      tickets: (ticketsRes.data as any[]) ?? [],
    };
  });

export const resolveProductOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      order_id: z.string().uuid(),
      approve: z.boolean(),
      method: z.enum(["pix", "dinheiro", "cartao", "outro"]).default("pix"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("athletic_product_orders")
      .select("*")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    if ((order as any).athletic_id !== data.athletic_id) throw new Error("Outra atlética");
    if ((order as any).status === "paid") return { ok: true, already: true };

    if (!data.approve) {
      await supabaseAdmin
        .from("athletic_product_orders")
        .update({ status: "canceled" } as any)
        .eq("id", data.order_id);
      return { ok: true, canceled: true };
    }

    await supabaseAdmin
      .from("athletic_product_orders")
      .update({ status: "paid", notes: `Aprovado manualmente (${data.method})` } as any)
      .eq("id", data.order_id);

    await supabaseAdmin.from("athletic_cash_entries").insert({
      athletic_id: data.athletic_id,
      category: "product",
      description: `Pedido ${data.order_id.slice(0, 8).toUpperCase()} — ${(order as any).buyer_name} (${data.method})`,
      gross_amount: (order as any).total,
      net_amount: (order as any).total,
      is_income: true,
      related_order_id: data.order_id,
      created_by: context.userId,
    } as any);

    return { ok: true };
  });

export const resolveTicketPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      ticket_id: z.string().uuid(),
      approve: z.boolean(),
      method: z.enum(["pix", "dinheiro", "cartao", "outro"]).default("pix"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("athletic_event_tickets")
      .select("*, athletic_events!inner(athletic_id)")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!t) throw new Error("Ingresso não encontrado");
    if (((t as any).athletic_events?.athletic_id) !== data.athletic_id) throw new Error("Outra atlética");
    if ((t as any).status === "sold") return { ok: true, already: true };
    if (!data.approve) {
      await supabaseAdmin
        .from("athletic_event_tickets")
        .update({ status: "cancelled" } as any)
        .eq("id", data.ticket_id);
      return { ok: true, canceled: true };
    }
    await supabaseAdmin
      .from("athletic_event_tickets")
      .update({ status: "sold", sold_channel: "manual", sold_at: new Date().toISOString() } as any)
      .eq("id", data.ticket_id);
    await supabaseAdmin.from("athletic_cash_entries").insert({
      athletic_id: data.athletic_id,
      category: "event_online",
      description: `Ingresso ${(t as any).code ?? data.ticket_id.slice(0, 8)} — ${(t as any).buyer_name} (${data.method})`,
      gross_amount: (t as any).price_paid,
      net_amount: (t as any).price_paid,
      is_income: true,
      related_ticket_id: data.ticket_id,
      created_by: context.userId,
    } as any);
    return { ok: true };
  });

/* ============ IMPORTAÇÃO EM MASSA ============ */

export const bulkImportMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      cycle_id: z.string().uuid().optional().nullable(),
      send_invites: z.boolean().default(true),
      rows: z
        .array(
          z.object({
            email: z.string().email().optional().nullable().or(z.literal("")),
            full_name: z.string().min(2).max(200),
            cpf: z.string().max(20).optional().nullable(),
            phone: z.string().max(40).optional().nullable(),
            matricula: z.string().max(50).optional().nullable(),
            semestre: z.string().max(20).optional().nullable(),
          }),
        )
        .min(1)
        .max(2000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let cycleEnd: string | null = null;
    if (data.cycle_id) {
      const { data: cyc } = await supabaseAdmin
        .from("athletic_membership_cycles")
        .select("ends_at")
        .eq("id", data.cycle_id)
        .maybeSingle();
      cycleEnd = (cyc as any)?.ends_at ?? null;
    } else {
      const { data: cyc } = await supabaseAdmin
        .from("athletic_membership_cycles")
        .select("id,ends_at")
        .eq("athletic_id", data.athletic_id)
        .eq("is_current", true)
        .maybeSingle();
      if (cyc) {
        data.cycle_id = (cyc as any).id;
        cycleEnd = (cyc as any).ends_at;
      }
    }

    const { data: ath } = await supabaseAdmin
      .from("athletics")
      .select("name,primary_color,slug")
      .eq("id", data.athletic_id)
      .maybeSingle();
    const athName: string = (ath as any)?.name ?? "AAAMD";
    const brand: string = (ath as any)?.primary_color ?? "#1f5132";

    let created = 0;
    let updated = 0;
    let invited = 0;
    const failures: Array<{ email: string; reason: string }> = [];

    for (const raw of data.rows) {
      const email = raw.email ? raw.email.toLowerCase().trim() : null;
      try {
        let linkedUserId: string | null = null;
        if (email) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .ilike("email", email)
            .maybeSingle();
          linkedUserId = (prof as any)?.id ?? null;
        }

        // Find existing: by email if present, else by (athletic_id + full_name + cpf) heuristic
        let existingId: string | null = null;
        if (email) {
          const { data: existing } = await supabaseAdmin
            .from("athletic_memberships")
            .select("id")
            .eq("athletic_id", data.athletic_id)
            .ilike("email", email)
            .maybeSingle();
          existingId = (existing as any)?.id ?? null;
        } else if (raw.cpf) {
          const { data: existing } = await supabaseAdmin
            .from("athletic_memberships")
            .select("id")
            .eq("athletic_id", data.athletic_id)
            .eq("cpf", raw.cpf)
            .maybeSingle();
          existingId = (existing as any)?.id ?? null;
        }

        const payload: any = {
          athletic_id: data.athletic_id,
          full_name: raw.full_name,
          email,
          phone: raw.phone ?? null,
          cpf: raw.cpf ?? null,
          matricula: raw.matricula ?? null,
          semestre: raw.semestre ?? null,
          role: "socio",
          active: true,
          added_manually: true,
          user_id: linkedUserId,
          member_until: cycleEnd,
          cycle_id: data.cycle_id ?? null,
        };

        if (existingId) {
          await supabaseAdmin
            .from("athletic_memberships")
            .update(payload)
            .eq("id", existingId);
          updated++;
        } else {
          const { error } = await supabaseAdmin
            .from("athletic_memberships")
            .insert(payload);
          if (error) throw new Error(error.message);
          created++;
        }

        if (data.send_invites && email && !linkedUserId) {
          try {
            const { sendGmail, emailLayout, emailInfoCard } = await import("./gmail.server");
            await sendGmail({
              to: email,
              subject: `Você foi cadastrado(a) como sócio(a) da ${athName}`,
              html: emailLayout({
                title: `Bem-vindo(a) à ${athName}, ${raw.full_name.split(" ")[0]}!`,
                brandColor: brand,
                leagueName: athName,
                bodyHtml: `<p>A diretoria da <strong>${athName}</strong> te cadastrou como sócio(a) da atlética.</p>
                  <p>Para acessar sua carteirinha digital, benefícios de sócio, comprar produtos e ingressos com desconto, crie sua conta no MEDPLEX usando o mesmo e-mail deste convite (<strong>${email}</strong>). Seu vínculo de sócio será ativado automaticamente.</p>
                  ${emailInfoCard({
                    title: "Seu cadastro",
                    brandColor: brand,
                    rows: [
                      { label: "Nome", value: raw.full_name },
                      { label: "E-mail", value: email },
                      ...(raw.matricula ? [{ label: "Matrícula", value: raw.matricula }] : []),
                      ...(raw.semestre ? [{ label: "Semestre", value: raw.semestre }] : []),
                    ],
                  })}
                  <p>Se você já tem conta no MEDPLEX, é só entrar — o vínculo já aparece na aba <strong>Sócio</strong>.</p>`,
                ctaLabel: "Criar minha conta",
                ctaUrl: "https://ligasuno.com.br/auth",
                signature: `— Diretoria da ${athName}`,
              }),
            });
            invited++;
            await supabaseAdmin
              .from("athletic_memberships")
              .update({ invite_sent_at: new Date().toISOString() } as any)
              .eq("athletic_id", data.athletic_id)
              .ilike("email", email);
          } catch (e: any) {
            console.error("invite email failed", email, e?.message);
          }
        }
      } catch (e: any) {
        failures.push({ email: email ?? "(sem e-mail)", reason: e?.message ?? "erro" });
      }
    }

    return { created, invited, failures, total: data.rows.length, imported: created + updated, updated };
  });

/* ============ REENVIO DE CONVITES ============ */
// Reenvia o convite para todos os sócios com e-mail que ainda NÃO criaram conta no site
// (user_id null). Pode ser executado quantas vezes for necessário.
export const resendMemberInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      only_never_sent: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendGmail, emailLayout, emailInfoCard } = await import("./gmail.server");

    const { data: ath } = await supabaseAdmin
      .from("athletics")
      .select("name,primary_color")
      .eq("id", data.athletic_id)
      .maybeSingle();
    const athName: string = (ath as any)?.name ?? "AAAMD";
    const brand: string = (ath as any)?.primary_color ?? "#1f5132";

    let query = supabaseAdmin
      .from("athletic_memberships")
      .select("id,full_name,email,matricula,semestre,invite_sent_at,user_id")
      .eq("athletic_id", data.athletic_id)
      .is("user_id", null)
      .not("email", "is", null);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const list = ((rows as any[]) ?? []).filter((r) => {
      if (!r.email) return false;
      if (data.only_never_sent && r.invite_sent_at) return false;
      return true;
    });

    let sent = 0;
    const failures: Array<{ email: string; reason: string }> = [];

    for (const m of list) {
      const email = String(m.email).toLowerCase().trim();
      try {
        await sendGmail({
          to: email,
          subject: `Você foi cadastrado(a) como sócio(a) da ${athName}`,
          html: emailLayout({
            title: `Bem-vindo(a) à ${athName}, ${String(m.full_name).split(" ")[0]}!`,
            brandColor: brand,
            leagueName: athName,
            bodyHtml: `<p>A diretoria da <strong>${athName}</strong> te cadastrou como sócio(a) da atlética.</p>
              <p>Para acessar sua carteirinha digital, benefícios de sócio, comprar produtos e ingressos com desconto, crie sua conta no MEDPLEX usando este e-mail (<strong>${email}</strong>). Seu vínculo de sócio será ativado automaticamente.</p>
              ${emailInfoCard({
                title: "Seu cadastro",
                brandColor: brand,
                rows: [
                  { label: "Nome", value: String(m.full_name) },
                  { label: "E-mail", value: email },
                  ...(m.matricula ? [{ label: "Matrícula", value: String(m.matricula) }] : []),
                  ...(m.semestre ? [{ label: "Semestre", value: String(m.semestre) }] : []),
                ],
              })}
              <p>Se você já tem conta, é só entrar — o vínculo já aparece na aba <strong>Sócio</strong>.</p>`,
            ctaLabel: "Criar minha conta",
            ctaUrl: "https://ligasuno.com.br/auth",
            signature: `— Diretoria da ${athName}`,
          }),
        });
        sent++;
        await supabaseAdmin
          .from("athletic_memberships")
          .update({ invite_sent_at: new Date().toISOString() } as any)
          .eq("id", m.id);
      } catch (e: any) {
        failures.push({ email, reason: e?.message ?? "erro no envio" });
        console.error("resendMemberInvites failed for", email, e?.message);
      }
    }

    return { sent, failures, total: list.length };
  });

