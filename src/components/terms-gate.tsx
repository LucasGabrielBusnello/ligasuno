import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";
import { TERMS_CLAUSES, TERMS_TITLE, TERMS_VERSION } from "@/lib/terms";
import { acceptTerms, getMyTermsStatus } from "@/lib/terms.functions";

const EXEMPT = ["/auth", "/termos"];

export function TermsGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const status = useServerFn(getMyTermsStatus);
  const accept = useServerFn(acceptTerms);
  const [needs, setNeeds] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (!data.session) {
        setNeeds(false);
        return;
      }
      try {
        const res = await status({});
        if (alive) setNeeds(!res.accepted);
      } catch {
        // falha de rede: não libera o acesso por engano, tenta de novo
        if (alive) retry = setTimeout(check, 5000);
      }
    }
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") check();
    });
    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

  const blocking = needs && !EXEMPT.some((p) => pathname.startsWith(p)) && !pathname.startsWith("/api/");

  useEffect(() => {
    if (!blocking) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", trap, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", trap, true);
    };
  }, [blocking]);

  if (!blocking) {
    return null;
  }


  async function confirm() {
    if (!checked) return;
    setBusy(true);
    try {
      await accept({});
      setNeeds(false);
      toast.success("Termos aceitos. Bom uso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar o aceite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="flex h-[90vh] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-start gap-3 border-b border-border p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScrollText className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-black leading-tight">{TERMS_TITLE}</h2>
            <p className="text-xs text-muted-foreground">
              Versão {TERMS_VERSION} — leia e aceite para continuar usando a plataforma.
            </p>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {TERMS_CLAUSES.map((c) => (
            <section key={c.n}>
              <h3 className="text-sm font-bold">
                {c.n}. {c.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
            </section>
          ))}
        </div>

        <div className="shrink-0 space-y-3 border-t border-border p-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setChecked((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setChecked((v) => !v);
              }
            }}
            className="flex cursor-pointer select-none items-start gap-2.5 text-sm"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v: boolean | "indeterminate") => setChecked(v === true)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
            <span>
              Li e aceito os termos de uso e a política de privacidade, inclusive que o MEDHUB não é
              canal oficial da instituição e que meus dados pessoais podem ser vistos pelas entidades
              das quais eu participar.
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={confirm} disabled={!checked || busy} className="flex-1">
              {busy ? "Registrando..." : "Li e aceito"}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="sm:w-40"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
