import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "camed-docs";

async function assertCamedDocsAccess(supabase: any, userId: string) {
  const [admin, pres, tab] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin_master" }),
    supabase.rpc("is_camed_president", { _user_id: userId }),
    supabase.rpc("has_camed_panel_tab", { _user_id: userId, _tab: "documentos" }),
  ]);
  if (!(admin.data || pres.data || tab.data)) throw new Error("Sem permissão para Atas e Documentos");
}

export const createDocUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1).max(200),
        size: z.number().int().positive(),
        mime: z.string().trim().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCamedDocsAccess(context.supabase, context.userId);
    if (data.size > MAX_BYTES) throw new Error("Arquivo maior que 5 MB");
    const ext = (data.filename.split(".").pop() || "").toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) throw new Error("Somente arquivos PDF ou DOCX");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao preparar upload");
    return { path, token: signed.token };
  });

export const getDocDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCamedDocsAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar link");
    return { url: signed.signedUrl };
  });

export const deleteDocFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paths: z.array(z.string().min(1)).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCamedDocsAccess(context.supabase, context.userId);
    if (!data.paths.length) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(BUCKET).remove(data.paths);
    return { ok: true };
  });
