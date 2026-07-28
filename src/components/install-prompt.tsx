import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, X, Share } from "lucide-react";

const STORAGE_KEY = "meduno_a2hs_prompt_v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Aviso "Adicionar atalho na tela inicial".
 * Aparece uma única vez por usuário/dispositivo — após aceitar ou negar,
 * a escolha é gravada no localStorage e o aviso não volta a aparecer.
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      dismissed = true;
    }
    if (dismissed) return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS/Safari não dispara beforeinstallprompt — mostramos instruções.
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = isIos && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const t = window.setTimeout(() => {
      if (isSafari) {
        setIosHelp(true);
        setOpen(true);
      }
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.clearTimeout(t);
    };
  }, []);

  function remember() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }

  function decline() {
    remember();
    setOpen(false);
  }

  async function accept() {
    remember();
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch {
        /* ignore */
      }
      setOpen(false);
      return;
    }
    // Sem API nativa: mantém as instruções visíveis por alguns segundos.
    setIosHelp(true);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 size-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-black tracking-tight leading-tight">
              Adicionar um Atalho na Tela inicial
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {iosHelp
                ? "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início” para criar o ícone do MEDUNO."
                : "Crie um ícone do MEDUNO na tela inicial do seu aparelho e acesse o hub com um toque."}
            </p>
            {iosHelp && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <Share className="size-3.5" /> Compartilhar → Adicionar à Tela de Início
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="font-bold" onClick={accept}>
                {iosHelp ? "Entendi" : "Adicionar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={decline}>
                Agora não
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={decline}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
