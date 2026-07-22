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

/* ============ CICLOS DE ASSOCIAÇÃO ============ */

export const upsertMembershipCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      athletic_id: z.string().uuid(),
      name: z.string().min(2).max(120),
      starts_at: z.string(),
      ends_at: z.string(),
      price_new: z.number().nonnegative(),
      price_renewal: z.number().nonnegative(),
      open: z.boolean().default(true),
      is_current: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Garante ciclo atual único por atlética
    if (data.is_current) {
      await (supabaseAdmin as any).from("athletic_membership_cycles")
        .update({ is_current: false })
        .eq("athletic_id", data.athletic_id)
        .neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const payload = {
      athletic_id: data.athletic_id,
      name: data.name,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      price_new: data.price_new,
      price_renewal: data.price_renewal,
      open: data.open,
      is_current: data.is_current,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("athletic_membership_cycles")
        .update(payload as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("athletic_membership_cycles")
      .insert(payload as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const deleteMembershipCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ athletic_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_membership_cycles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMembershipsOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ athletic_id: z.string().uuid(), open: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletics")
      .update({ memberships_open: data.open }).eq("id", data.athletic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ INFINITEPAY ============ */

export const saveInfinitepayCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      athletic_id: z.string().uuid(),
      handle: z.string().min(2).max(120),
      api_key: z.string().min(10),
      webhook_secret: z.string().min(6),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptString } = await import("@/lib/crypto.server");
    const api_key_encrypted = await encryptString(data.api_key);
    const webhook_secret_encrypted = await encryptString(data.webhook_secret);
    const { error } = await supabaseAdmin.from("athletic_infinitepay_accounts").upsert({
      athletic_id: data.athletic_id,
      handle: data.handle,
      api_key_encrypted,
      webhook_secret_encrypted,
    }, { onConflict: "athletic_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectInfinitepay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletic_infinitepay_accounts")
      .delete().eq("athletic_id", data.athletic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getInfinitepayStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ athletic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase, context.userId, data.athletic_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("athletic_infinitepay_accounts")
      .select("handle, connected_at, updated_at").eq("athletic_id", data.athletic_id).maybeSingle();
    return { connected: !!row, handle: (row as any)?.handle ?? null, connected_at: (row as any)?.connected_at ?? null };
  });
