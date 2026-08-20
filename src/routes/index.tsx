import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, GraduationCap, Trophy, Building2, BookOpen, ArrowRight, CalendarDays, Users, ShieldCheck } from "lucide-react";
import { AdsBanner } from "@/components/ads-banner";
import { InstallPrompt } from "@/components/install-prompt";
import { HubLogos } from "@/components/hub-logos";
import { NotOfficialNotice } from "@/components/not-official-notice";
import { Reveal } from "@/components/reveal";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MEDPLEX — Plataforma estudantil de Medicina" },
      { name: "description", content: "Plataforma integrada para estudantes, ligas acadêmicas, atlética e CAMED de Medicina da Unochapecó." },
      { property: "og:title", content: "MEDPLEX — Plataforma estudantil de Medicina" },
      { property: "og:description", content: "Plataforma integrada para estudantes, ligas, atlética e CAMED." },
    ],
  }),
  component: HomePage,
});

const QUICK_ACCESS = [
  { to: "/aluno", label: "Portal do Aluno", description: "Cronograma, matérias, quizzes e desempenho.", icon: GraduationCap },
  { to: "/atletica", label: "AAAMD", description: "Atlética, produtos, eventos e carteirinha.", icon: Trophy },
  { to: "/camed", label: "CAMED", description: "Centro acadêmico, notícias e agendamentos.", icon: Building2 },
  { to: "/ligas", label: "Ligas Acadêmicas", description: "Encontre ligas, entre em processos seletivos.", icon: BookOpen },
] as const;

const HIGHLIGHTS = [
  { title: "Sua semana organizada", text: "Cronograma sempre atualizado, com aulas, práticas e provas por turma.", icon: CalendarDays },
  { title: "Toda a comunidade", text: "Ligas, atlética, CAMED e IFMSA reunidos em uma única plataforma.", icon: Users },
  { title: "Inscrições sem atrito", text: "Eventos, minicursos e pagamentos com confirmação automática.", icon: ShieldCheck },
] as const;


function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden relative">
      <InstallPrompt />
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 size-[36rem] rounded-full bg-primary/20 blur-3xl animate-blob-1" />
        <div className="absolute top-40 -right-32 size-[32rem] rounded-full bg-copper/20 blur-3xl animate-blob-2" />
        <div className="absolute bottom-0 left-1/3 size-[28rem] rounded-full bg-primary/10 blur-3xl animate-blob-3" />
      </div>

      {/* Hero MEDPLEX */}
      <section className="hub-hero grain text-primary-foreground relative overflow-hidden rounded-none">
        <div className="max-w-5xl mx-auto px-4 py-20 md:py-28 text-center animate-fade-up relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-copper/15 border border-copper/40 text-[11px] uppercase tracking-[0.25em] mb-7 backdrop-blur animate-pulse-ring">
            <Sparkles className="size-3.5 text-copper" /> Tudo em um só lugar
          </div>

          <h1 className="relative text-6xl md:text-8xl font-black tracking-tighter mb-3 leading-[0.9]">
            <span className="copper-text">MED</span>
            <span className="text-primary-foreground">PLEX</span>
            <span className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shine" />
            </span>
          </h1>

          <div className="copper-rule w-40 mx-auto mb-6" />

          <p className="max-w-2xl mx-auto text-base md:text-lg text-primary-foreground/80 font-medium">
            A rede que conecta a vida acadêmica da Medicina — cronograma, ligas,
            atlética, CAMED e IFMSA em um só lugar.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/aluno"
              className="group inline-flex items-center gap-2 rounded-full bg-copper px-6 py-3 text-sm font-bold text-accent-foreground shadow-lg transition-all hover:scale-[1.03]"
            >
              Portal do Aluno <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/ligas"
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 bg-primary-foreground/5 px-6 py-3 text-sm font-bold backdrop-blur transition-colors hover:bg-primary-foreground/15"
            >
              Explorar ligas
            </Link>
          </div>

          <HubLogos />
        </div>
      </section>

      {/* Anúncio em destaque */}
      <div className="pt-4 md:pt-6 relative z-10">
        <AdsBanner placement="home" />
      </div>

      {/* Acesso Rápido */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-copper/10 border border-copper/30 text-[10px] uppercase tracking-[0.2em] text-copper font-bold mb-3">
            Acesso Rápido
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Vá direto ao ponto</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Escolha o setor que você quer acessar agora.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACCESS.map(({ to, label, description, icon: Icon }, i) => (
            <Reveal key={to} delay={i * 90}>
              <Link
                to={to}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-copper/50 hover:shadow-[var(--shadow-elegant)]"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-copper to-primary opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary mb-4 transition-colors group-hover:bg-copper/15 group-hover:text-copper">
                  <Icon className="size-6" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-foreground">{label}</h3>
                <p className="text-xs mt-1.5 leading-relaxed text-muted-foreground">{description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-copper transition-transform group-hover:translate-x-1">
                  Acessar <ArrowRight className="size-3.5" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Faixa de destaques */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 pb-16">
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {HIGHLIGHTS.map(({ title, text, icon: Icon }) => (
              <div key={title} className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
                <Icon className="size-5 text-copper mb-3 animate-float" />
                <h3 className="font-bold tracking-tight">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <NotOfficialNotice />

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground relative">
        © {new Date().getFullYear()} MEDPLEX · Plataforma estudantil independente
      </footer>
    </div>
  );
}

