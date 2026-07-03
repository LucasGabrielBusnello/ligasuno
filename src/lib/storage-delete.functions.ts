import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteStorageFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ paths: z.array(z.string()) }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const paths = data.paths
      .filter((p) => Boolean(p) && typeof p === "string")
      .map((p) => {
        try {
          const url = new URL(p);
          // Exemplo: /storage/v1/object/public/images/leagues/uuid.webp
          const idx = url.pathname.indexOf("/images/");
          if (idx !== -1) {
            return decodeURIComponent(url.pathname.slice(idx + "/images/".length).replace(/^\//, ""));
          }
          // Se já for apenas o path relativo ao bucket
          return p.replace(/^images\//, "").replace(/^\//, "");
        } catch {
          return p.replace(/^images\//, "").replace(/^\//, "");
        }
      })
      .filter(Boolean);

    if (paths.length === 0) return { ok: true, deleted: 0 };

    const { error, data: removed } = await supabaseAdmin.storage.from("images").remove(paths);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: removed?.length ?? paths.length };
  });
