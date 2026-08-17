import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = "camed-course-docs";
const ALLOWED = ["pdf", "docx", "doc", "pptx", "ppt", "xlsx", "xls", "zip"];

async function assertAccess(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_camed_panel_tab", { _user_id: userId, _tab: "documentos" });
  if (!data) throw new Error("Sem permissão para gerenciar documentos do curso");
}

export const createCourseDocUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1).max(200),
        size: z.number().int().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId);
    if (data.size > MAX_BYTES) throw new Error("Arquivo maior que 15 MB");
    const ext = (data.filename.split(".").pop() || "").toLowerCase();
    if (!ALLOWED.includes(ext)) throw new Error("Formato de arquivo não suportado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao preparar upload");
    return { path, token: signed.token };
  });

export const getCourseDocDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("camed_course_documents" as any)
      .select("storage_path, file_url, file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const doc = row as any;
    if (!doc) throw new Error("Documento não encontrado");
    if (doc.file_url) return { url: doc.file_url as string };
    if (!doc.storage_path) throw new Error("Arquivo indisponível");
    const { data: signed, error: e2 } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 10, { download: doc.file_name ?? undefined });
    if (e2 || !signed) throw new Error(e2?.message ?? "Falha ao gerar link");
    return { url: signed.signedUrl };
  });

export const deleteCourseDocFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(BUCKET).remove([data.path]);
    return { ok: true };
  });
