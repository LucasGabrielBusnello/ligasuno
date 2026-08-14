import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function LoadingScreen({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm">
      <div className="size-12 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
      <p className="text-sm font-semibold tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

/** Mostra um indicador central enquanto o app hidrata ou troca de rota. */
export function GlobalLoading() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!hydrated || isLoading) {
      const t = setTimeout(() => setShow(true), 250);
      return () => clearTimeout(t);
    }
    setShow(false);
    return;
  }, [hydrated, isLoading]);

  if (!show) return null;
  return <LoadingScreen />;
}
