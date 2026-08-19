import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CurriculumAdmin } from "@/components/curriculum-admin";

export const Route = createFileRoute("/coordenacao/curriculo")({
  head: () => ({
    meta: [
      { title: "Coordenação · Currículo — MEDHUB" },
      { name: "description", content: "Componentes curriculares e semestres letivos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoordCurriculo,
});

function CoordCurriculo() {
  const { user, isCoordination, loading } = useAuth();

  if (loading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!user) return <div className="p-10 text-center">Faça login. <Link to="/auth" className="underline">Entrar</Link></div>;
  if (!isCoordination) return <div className="p-10 text-center">Acesso restrito à coordenação.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-neutral-950 to-neutral-950 text-neutral-100 dark">
      <section className="max-w-7xl mx-auto px-4 pt-8 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Currículo · Coordenação</h1>
            <p className="text-sm text-muted-foreground">Cadastre matérias, professores, turmas e semestres letivos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/coordenacao/cronograma">Cronograma</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/coordenacao/feriados">Feriados</Link></Button>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <CurriculumAdmin />
      </section>
    </div>
  );
}
