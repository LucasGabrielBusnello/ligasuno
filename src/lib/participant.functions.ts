import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cancelSchema = z.object({ registration_id: z.string().uuid() });

export const cancelMinicourseRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reg } = await supabaseAdmin
      .from("minicourse_registrations")
      .select("id,user_id,status,paid_price,quota_used")
      .eq("id", data.registration_id)
      .maybeSingle();

    if (!reg || (reg as any).user_id !== userId) throw new Error("Inscrição não encontrada");

    const paidValue = Number((reg as any).paid_price ?? 0);
    if ((reg as any).status === "paid" && paidValue > 0 && !(reg as any).quota_used) {
      throw new Error("Pagamento já realizado. Entre em contato com a organização do evento para reembolso.");
    }

    const { error } = await supabaseAdmin
      .from("minicourse_registrations")
      .delete()
      .eq("id", data.registration_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
