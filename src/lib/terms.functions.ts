import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TERMS_VERSION } from "@/lib/terms";

export const getMyTermsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("terms_acceptances" as any)
      .select("version, accepted_at")
      .eq("user_id", context.userId)
      .eq("version", TERMS_VERSION)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { version: TERMS_VERSION, accepted: !!data };
  });

export const acceptTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const req = getRequest();
    const ip =
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const ua = req?.headers.get("user-agent") ?? null;

    const { error } = await context.supabase
      .from("terms_acceptances" as any)
      .upsert(
        {
          user_id: context.userId,
          version: TERMS_VERSION,
          ip,
          user_agent: ua,
        } as any,
        { onConflict: "user_id,version" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, version: TERMS_VERSION };
  });
