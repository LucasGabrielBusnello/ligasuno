import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const refineScheduleWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        subjects: z.array(z.object({ name: z.string(), professor: z.string().nullable().optional() })).max(60),
        cells: z
          .array(
            z.object({
              text: z.string().max(400),
              kind: z.string(),
              is_abex: z.boolean(),
              shift: z.string(),
            }),
          )
          .max(400),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const { refineCells } = await import("./schedule-ai.server");
    return refineCells(data.subjects, data.cells);
  });
