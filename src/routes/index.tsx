import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { AdsBanner } from "@/components/ads-banner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MEDUNO — Medicina Unochapecó" },
      { name: "description", content: "Plataforma integrada para estudantes, ligas acadêmicas, atlética e CAMED de Medicina da Unochapecó." },
      { property: "og:title", content: "MEDUNO — Medicina Unochapecó" },
      { property: "og:description", content: "Plataforma integrada para estudantes, ligas, atlética e CAMED." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden relative">
      {/* Blobs de fundo vivos */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 size-[36rem] rounded-full bg-primary/25 blur-3xl animate-blob-1" />
        <div className="absolute top-40 -right-32 size-[32rem] rounded-full bg-accent/25 blur-3xl animate-blob-2" />
        <div className="absolute bottom-0 left-1/3 size-[28rem] rounded-full bg-primary/15 blur-3xl animate-blob-3" />
      </div>

      <section className="hub-hero text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 py-20 md:py-28 text-center animate-fade-up relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-widest mb-6 backdrop-blur">
            <Sparkles className="size-3.5" /> Centro Integrado
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            MEDUNO
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/85 font-medium">
            Plataforma integrada de Medicina da Unochapecó — cronograma, ligas acadêmicas,
            atlética e CAMED em um só lugar. Navegue pelas seções na barra acima.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-white/70 text-xs uppercase tracking-widest">
            <span className="h-px w-8 bg-white/40" />
            Destaque da semana
            <span className="h-px w-8 bg-white/40" />
          </div>
        </div>
      </section>

      <div className="-mt-10 md:-mt-14 relative z-10">
        <AdsBanner placement="home" />
      </div>

      <footer className="border-t border-border/50 mt-20 py-8 text-center text-sm text-muted-foreground relative">
        © {new Date().getFullYear()} MEDUNO · Medicina Unochapecó
      </footer>
    </div>
  );
}
