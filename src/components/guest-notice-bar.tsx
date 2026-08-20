import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Info, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function GuestNoticeBar() {
  const { user, loading } = useAuth();
  const [closed, setClosed] = useState(false);

  if (loading || user || closed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex items-start gap-3 px-4 py-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="flex-1 text-[11px] leading-relaxed text-muted-foreground">
          O MEDPLEX é uma plataforma estudantil independente e{" "}
          <span className="font-semibold text-foreground">não é um canal oficial de informações</span>{" "}
          da Unochapecó, do curso de Medicina, do CAMED, da atlética ou de qualquer entidade.{" "}
          <Link to="/termos" className="underline underline-offset-2 hover:text-foreground">
            Ver termos de uso
          </Link>
        </p>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => setClosed(true)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
