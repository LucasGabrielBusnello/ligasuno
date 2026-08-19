import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { GlobalLoading } from "@/components/global-loading";
import { TermsGate } from "@/components/terms-gate";
import { GuestNoticeBar } from "@/components/guest-notice-bar";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google", content: "notranslate" },
      { httpEquiv: "Content-Language", content: "pt-BR" },
      { title: "MEDHUB — Plataforma estudantil de Medicina" },
      { name: "description", content: "Plataforma integrada para estudantes, ligas acadêmicas, atlética e CAMED de Medicina da Unochapecó." },
      { property: "og:title", content: "MEDHUB — Plataforma estudantil de Medicina" },
      { property: "og:description", content: "Plataforma integrada para estudantes, ligas, atlética e CAMED de Medicina da Unochapecó." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "MEDHUB — Plataforma estudantil de Medicina" },
      { name: "twitter:description", content: "Plataforma integrada para estudantes, ligas, atlética e CAMED de Medicina da Unochapecó." },
      { name: "theme-color", content: "#1f5132" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MEDHUB" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/app-icon-192.png" },
      { rel: "canonical", href: "https://ligasuno.com.br/" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoading />
      <MaintenanceGate>
        <SiteHeader />
        <VisitTracker />
        <AuthLogger />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </MaintenanceGate>
      <TermsGate />
      <Toaster richColors position="top-center" />

    </QueryClientProvider>
  );
}

function AuthLogger() {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        const key = `meduno_login_logged_${session?.user?.id ?? ""}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        logActivity({
          category: "auth",
          action: "Fez login",
          target: session?.user?.email ?? null,
          details: { provider: session?.user?.app_metadata?.provider ?? null },
        });
      }
      if (event === "SIGNED_OUT") {
        logActivity({ category: "auth", action: "Saiu da conta" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}

function VisitTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      let vid = localStorage.getItem("meduno_visitor_id");
      if (!vid) {
        vid = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
        localStorage.setItem("meduno_visitor_id", vid);
      }
      const key = `meduno_visit_${pathname}`;
      const last = Number(sessionStorage.getItem(key) || 0);
      const now = Date.now();
      if (now - last < 30_000) return;
      sessionStorage.setItem(key, String(now));
      logActivity({
        category: "navegacao",
        action: "Acessou uma página",
        target: pathname,
        details: { referrer: document.referrer || null },
      });
      supabase.auth.getUser().then(({ data }) => {
        supabase.from("site_visits" as any).insert({
          visitor_id: vid,
          user_id: data.user?.id ?? null,
          path: pathname,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        } as any).then(() => {});
      });
    } catch {}
  }, [pathname]);
  return null;
}
