import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const parseScheduleFromPdfText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ text: z.string().min(20).max(200000) }).parse(v))
  .handler(async ({ data }) => {
    const { parsePdfSchedule } = await import("./schedule-pdf-ai.server");
    return parsePdfSchedule(data.text);
  });
