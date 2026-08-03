import { supabase } from "@/integrations/supabase/client";

export type LogCategory =
  | "auth"
  | "navegacao"
  | "imagem"
  | "conteudo"
  | "pagamento"
  | "cronograma"
  | "geral";

type LogInput = {
  action: string;
  category?: LogCategory;
  target?: string | null;
  details?: Record<string, unknown>;
};

/** Registra um evento na tabela de logs. Nunca lança erro. */
export async function logActivity({ action, category = "geral", target = null, details = {} }: LogInput) {
  if (typeof window === "undefined") return;
  try {
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    await (supabase as any).from("activity_logs").insert({
      user_id: u?.id ?? null,
      user_email: u?.email ?? null,
      user_name:
        (u?.user_metadata as any)?.full_name ??
        (u?.user_metadata as any)?.username ??
        null,
      category,
      action,
      target,
      details,
      path: window.location.pathname,
    });
  } catch {
    /* logging nunca deve quebrar a aplicação */
  }
}

export const LOG_CATEGORY_LABEL: Record<string, string> = {
  auth: "Autenticação",
  navegacao: "Navegação",
  imagem: "Imagens",
  conteudo: "Conteúdo",
  pagamento: "Pagamentos",
  cronograma: "Cronograma",
  geral: "Geral",
};
