import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, GraduationCap, Calendar, BookOpen, Sparkles, LogIn } from "lucide-react";

export const Route = createFileRoute("/aluno")({
  head: () => ({
    meta: [
      { title: "Aluno — MEDUNO" },
      { name: "description", content: "Painel do estudante de Medicina da Unochapecó: cronograma, matérias, provas e eventos em um só lugar." },
      { property: "og:title", content: "Aluno — MEDUNO" },
      { property: "og:description", content: "Painel do estudante de Medicina da Unochapecó." },
    ],
  }),
  component: AlunoPage,
});

function AlunoPage() {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Carregando…</div>;

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="mx-auto size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Stethoscope className="size-8" />
        </div>
        <h1 className="text-3xl font-black">Painel do Aluno</h1>
        <p className="text-muted-foreground mt-2">Faça login para acessar seu cronograma e matérias.</p>
        <Button asChild className="mt-6"><Link to="/auth"><LogIn className="size-4" /> Entrar</Link></Button>
      </div>
    );
  }

  const isStudent = (profile as any)?.is_unochapeco_student === true;
  const classCode = (profile as any)?.class_code as string | null;

  if (!isStudent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-black">Área exclusiva para estudantes</h1>
        <p className="text-muted-foreground mt-2">
          O painel do Aluno é para estudantes de Medicina da Unochapecó. Se você é aluno(a), atualize seu cadastro no menu do usuário.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background dark:from-emerald-950/20">
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-lg">
            <Stethoscope className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Painel do Aluno</h1>
            <p className="text-sm text-muted-foreground">
              Olá, {profile?.full_name ?? profile?.username}{classCode ? ` · Turma ${classCode}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <Card className="border-emerald-200/60 dark:border-emerald-900/40">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto size-14 rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center">
              <Sparkles className="size-7" />
            </div>
            <h2 className="text-xl font-black">Em construção</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Estamos preparando seu cronograma integrado: aulas, práticas, provas, zonas verdes, eventos de liga e sincronia com o Google Agenda.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-4">
              <FeatureCard icon={<Calendar className="size-5" />} title="Cronograma" desc="Semana visual por turno" />
              <FeatureCard icon={<BookOpen className="size-5" />} title="Matérias" desc="Professores e contatos" />
              <FeatureCard icon={<GraduationCap className="size-5" />} title="Eventos" desc="Ligas e atlética integradas" />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 text-left">
      <div className="size-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center mb-2">
        {icon}
      </div>
      <div className="font-bold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
