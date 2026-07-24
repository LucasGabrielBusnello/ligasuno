import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, GraduationCap, Trophy, Building2, BookOpen, ArrowRight } from "lucide-react";
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

const QUICK_ACCESS = [
  {
    to: "/painel",
    label: "Portal do Aluno",
    description: "Cronograma, matérias, quizzes e desempenho.",
    icon: GraduationCap,
    accent: "from-emerald-500/25 to-emerald-700/10",
    border: "border-emerald-500/40",
    iconClass: "bg-emerald-500/20 text-emerald-300",
  },
  {
    to: "/atletica",
    label: "AAAMD",
    description: "Atlética, produtos, eventos e carteirinha.",
    icon: Trophy,
    accent: "from-orange-500/25 to-orange-700/10",
    border: "border-orange-500/40",
    iconClass: "bg-orange-500/20 text-orange-300",
  },
  {
    to: "/camed",
    label: "CAMED",
    description: "Centro acadêmico, notícias e agendamentos.",
    icon: Building2,
    accent: "from-teal-500/25 to-teal-700/10",
    border: "border-teal-500/40",
    iconClass: "bg-teal-500/20 text-teal-300",
  },
  {
    to: "/ligas",
    label: "Ligas Acadêmicas",
    description: "Encontre ligas, entre em processos seletivos.",
    icon: BookOpen,
    accent: "from-primary/25 to-primary/5",
    border: "border-primary/40",
    iconClass: "bg-primary/20 text-primary",
  },
] as const;

function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 size-[36rem] rounded-full bg-primary/25 blur-3xl animate-blob-1" />
        <div className="absolute top-40 -right-32 size-[32rem] rounded-full bg-accent/25 blur-3xl animate-blob-2" />
        <div className="absolute bottom-0 left-1/3 size-[28rem] rounded-full bg-primary/15 blur-3xl animate-blob-3" />
      </div>

      {/* Banner de anúncio em destaque, acima do hero */}
      <div className="pt-6 md:pt-10 relative z-10">
        <AdsBanner placement="home" />
      </div>

      <section className="hub-hero text-white relative overflow-hidden mt-6 md:mt-10 rounded-none">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center animate-fade-up relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-widest mb-6 backdrop-blur">
            <Sparkles className="size-3.5" /> Centro Integrado
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            MEDUNO
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/85 font-medium">
            Plataforma integrada de Medicina da Unochapecó — cronograma, ligas acadêmicas,
            atlética e CAMED em um só lugar.
          </p>
        </div>
      </section>

      {/* Acesso Rápido */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] uppercase tracking-widest text-primary font-bold mb-3">
            Acesso Rápido
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Vá direto ao ponto</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Escolha o setor que você quer acessar agora.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACCESS.map(({ to, label, description, icon: Icon, accent, border, iconClass }) => (
            <Link
              key={to}
              to={to}
              className={`group relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${accent} p-6 transition-all hover:scale-[1.02] hover:shadow-2xl backdrop-blur`}
            >
              <div className={`inline-flex items-center justify-center size-12 rounded-xl ${iconClass} mb-4`}>
                <Icon className="size-6" />
              </div>
              <h3 className="text-lg font-black tracking-tight">{label}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-transform">
                Acessar <ArrowRight className="size-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground relative">
        © {new Date().getFullYear()} MEDUNO · Medicina Unochapecó
      </footer>
    </div>
  );
}
