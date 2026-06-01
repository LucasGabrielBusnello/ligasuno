import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, HelpCircle, CheckCircle, XCircle, ChevronLeft, ChevronRight, Lock, Layers, BarChart2, Calendar, CalendarDays, Trophy, Sparkles, Target, Flame, BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/ligante/$slug")({ component: LigantePage });

function LigantePage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
      setLeague(data as League | null);
    })();
  }, [slug]);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (!league) return;
    supabase.from("league_memberships").select("role").eq("league_id", league.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setMyRole((data as any)?.role ?? null));
  }, [loading, user, league]);

  if (!league || !user) return <div className="p-12 text-center">Carregando...</div>;
  const allowed = myRole && ["ligante", "diretor", "presidente"].includes(myRole);
  if (!allowed && league.president_id !== user.id) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <Lock className="size-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-black">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2">Você precisa ser membro desta liga.</p>
        <Button asChild className="mt-6"><Link to="/$slug" params={{ slug }}>Voltar</Link></Button>
      </div>
    );
  }

  const initialTab = typeof window !== "undefined" ? (new URL(window.location.href).searchParams.get("tab") ?? "schedule") : "schedule";
  const initialSet = typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("set") : null;
  const isStaff = !!(myRole && ["diretor", "presidente"].includes(myRole)) || league.president_id === user.id;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/$slug" params={{ slug }} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> {league.name}</Link>
          <Badge><GraduationCap className="size-3 mr-1" />Ligante</Badge>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <h1 className="text-2xl md:text-4xl font-black mb-2">Painel do Ligante</h1>
        <p className="text-muted-foreground mb-6 text-sm md:text-base">{league.name}</p>

        <Tabs defaultValue={initialTab}>
          <TabsList className="grid grid-cols-4 w-full h-auto">
            <TabsTrigger value="schedule" className="flex-col md:flex-row gap-0.5 md:gap-1.5 py-2 px-1 md:px-3 text-[10px] md:text-sm">
              <CalendarDays className="size-4" /><span>Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="flex-col md:flex-row gap-0.5 md:gap-1.5 py-2 px-1 md:px-3 text-[10px] md:text-sm">
              <HelpCircle className="size-4" /><span>Quizzes</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex-col md:flex-row gap-0.5 md:gap-1.5 py-2 px-1 md:px-3 text-[10px] md:text-sm">
              <Calendar className="size-4" /><span className="text-center leading-tight">Frequência</span>
            </TabsTrigger>
            <TabsTrigger value="ranking" className="flex-col md:flex-row gap-0.5 md:gap-1.5 py-2 px-1 md:px-3 text-[10px] md:text-sm">
              <BarChart2 className="size-4" /><span className="text-center leading-tight">Desempenho</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="schedule" className="mt-6"><ScheduleView league={league} /></TabsContent>
          <TabsContent value="quizzes" className="mt-6"><QuizView league={league} userId={user.id} isStaff={isStaff} initialSet={initialSet} /></TabsContent>
          <TabsContent value="attendance" className="mt-6"><AttendanceView league={league} userId={user.id} /></TabsContent>
          <TabsContent value="ranking" className="mt-6"><PerformanceView userId={user.id} /></TabsContent>
        </Tabs>

      </main>
    </div>
  );
}

function QuizView({ league, userId, isStaff, initialSet }: { league: League; userId: string; isStaff: boolean; initialSet?: string | null }) {
  const [sets, setSets] = useState<any[]>([]);
  const [activeSet, setActiveSet] = useState<string | null>(initialSet ?? null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, { is_correct: boolean; selected: number }>>({});
  const [curr, setCurr] = useState(0);
  const [ans, setAns] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("league_quiz_sets").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
      setSets(data ?? []);
      const { data: a } = await supabase.from("league_quiz_answers").select("*").eq("user_id", userId);
      const m: any = {};
      (a ?? []).forEach((r: any) => { m[r.quiz_id] = { is_correct: r.is_correct, selected: r.selected }; });
      setAnswers(m);
    })();
  }, [league.id, userId]);

  useEffect(() => {
    if (!activeSet) return;
    supabase.from("league_quizzes").select("*").eq("quiz_set_id", activeSet).order("display_order").then(({ data }) => {
      setQuizzes(data ?? []);
      const first = (data ?? []).findIndex((q: any) => answers[q.id] === undefined);
      setCurr(first === -1 ? 0 : first);
      setAns(null);
      setShowReport(first === -1 && (data ?? []).length > 0);
    });
  }, [activeSet]);

  if (!activeSet) {
    if (sets.length === 0) return (
      <Card className="p-12 text-center border-dashed">
        <BookOpen className="size-16 mx-auto text-muted-foreground/40 mb-4" />
        <p className="font-bold text-lg">Nenhum caderno disponível</p>
        <p className="text-muted-foreground text-sm mt-1">Aguarde a presidência publicar conteúdo.</p>
      </Card>
    );
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sets.map((s, idx) => {
          const locked = s.is_private && !isStaff;
          const setQuizIds = quizzes.filter((q: any) => q.quiz_set_id === s.id).map((q: any) => q.id);
          // computa progresso a partir das respostas em memória contra o conjunto (best-effort: usa contagem total se carregado)
          const answeredInSet = Object.keys(answers).filter((qid) => setQuizIds.includes(qid)).length;
          return (
            <Card
              key={s.id}
              className={`group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 border-2 ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
              onClick={() => { if (!locked) setActiveSet(s.id); }}
            >
              {/* Hero gradient */}
              <div
                className="relative h-32 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${league.theme_color}, ${league.theme_color}cc 60%, ${league.theme_color}80)` }}
              >
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: "radial-gradient(circle at 20% 30%, white 0%, transparent 40%), radial-gradient(circle at 80% 70%, white 0%, transparent 40%)"
                }} />
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {s.is_private && <Badge variant="secondary" className="text-[10px] bg-white/90 text-black backdrop-blur"><Lock className="size-2.5 mr-1" />Privado</Badge>}
                </div>
                <div className="absolute bottom-3 left-4 flex items-center gap-3">
                  <div className="size-14 rounded-2xl bg-white/95 backdrop-blur flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    {locked ? <Lock className="size-7" style={{ color: league.theme_color }} /> : <Layers className="size-7" style={{ color: league.theme_color }} />}
                  </div>
                  <span className="text-white/90 text-xs font-bold uppercase tracking-widest">Caderno #{idx + 1}</span>
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="font-black text-lg leading-tight">{s.title}</h3>
                {s.description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{s.description}</p>}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5" style={{ color: league.theme_color }} />
                    {locked ? "Exclusivo Ligantes" : "Começar"}
                  </span>
                  {!locked && <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-foreground transition-all" />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  if (quizzes.length === 0) return (
    <div>
      <Button variant="ghost" onClick={() => setActiveSet(null)}><ChevronLeft className="size-4" /> Voltar</Button>
      <Card className="mt-4 p-12 text-center text-muted-foreground">Nenhuma questão neste caderno.</Card>
    </div>
  );

  if (showReport) {
    const correct = quizzes.filter((q) => answers[q.id]?.is_correct).length;
    const pct = Math.round((correct / quizzes.length) * 100);
    return (
      <div>
        <Button variant="ghost" onClick={() => setActiveSet(null)}><ChevronLeft className="size-4" /> Voltar aos cadernos</Button>
        <Card className="mt-4"><CardContent className="p-8 text-center">
          <div className={`size-32 mx-auto rounded-full flex items-center justify-center border-8 mb-4 ${pct >= 70 ? "border-emerald-400 text-emerald-600" : pct >= 50 ? "border-yellow-400 text-yellow-600" : "border-rose-400 text-rose-600"}`}>
            <span className="text-4xl font-black">{pct}%</span>
          </div>
          <h2 className="text-2xl font-black">Relatório</h2>
          <p className="text-muted-foreground mt-1">{correct} acertos de {quizzes.length}</p>
          <Button className="mt-6" onClick={() => { setShowReport(false); setCurr(0); setAns(null); }}>Revisar questões</Button>
        </CardContent></Card>
      </div>
    );
  }

  const q = quizzes[curr];
  const existing = answers[q.id];
  const isAnswered = existing !== undefined;

  async function verify() {
    if (ans === null) return;
    const ok = ans === q.correct_answer;
    const { error } = await supabase.from("league_quiz_answers").upsert(
      { user_id: userId, quiz_id: q.id, is_correct: ok, selected: ans },
      { onConflict: "user_id,quiz_id" }
    );
    if (error) return toast.error(error.message);
    setAnswers({ ...answers, [q.id]: { is_correct: ok, selected: ans } });
  }

  return (
    <div>
      <Button variant="ghost" onClick={() => setActiveSet(null)}><ChevronLeft className="size-4" /> Voltar</Button>
      <Card className="mt-4"><CardContent className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-10 rounded-full" style={{ background: league.theme_color }} />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Questão {curr + 1} de {quizzes.length}</span>
        </div>
        <h2 className="text-xl md:text-2xl font-black mb-6">{q.question}</h2>
        <div className="space-y-3">
          {(q.options as string[]).map((opt, i) => {
            let cls = "border bg-card hover:border-primary/50";
            if (isAnswered) {
              if (i === q.correct_answer) cls = "border-emerald-500 bg-emerald-500/10";
              else if (i === existing.selected) cls = "border-rose-500 bg-rose-500/10";
              else cls = "border bg-muted/40 opacity-60";
            } else if (ans === i) cls = "border-primary bg-primary/5";
            return (
              <button key={i} disabled={isAnswered} onClick={() => setAns(i)} className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${cls}`}>
                <span className="size-8 rounded-full bg-background border flex items-center justify-center font-black text-sm shrink-0">{String.fromCharCode(65 + i)}</span>
                <span className="text-sm">{opt}</span>
              </button>
            );
          })}
        </div>
        {!isAnswered && ans !== null && (
          <Button className="mt-6 w-full" style={{ background: league.theme_color }} onClick={verify}>Verificar</Button>
        )}
        {isAnswered && (
          <div className="mt-6 p-5 rounded-xl border bg-muted/30">
            <p className={`font-black mb-2 flex items-center gap-2 ${existing.is_correct ? "text-emerald-600" : "text-rose-600"}`}>
              {existing.is_correct ? <><CheckCircle className="size-5" /> Correto!</> : <><XCircle className="size-5" /> Incorreto</>}
            </p>
            {q.explanation && <p className="text-sm text-muted-foreground">{q.explanation}</p>}
            <Button className="mt-4 w-full" onClick={() => {
              setAns(null);
              if (curr === quizzes.length - 1) setShowReport(true);
              else setCurr(curr + 1);
            }}>{curr === quizzes.length - 1 ? "Ver relatório" : "Próxima"} <ChevronRight className="size-4" /></Button>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function AttendanceView({ league, userId }: { league: League; userId: string }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("league_attendance").select("*").eq("league_id", league.id).eq("user_id", userId).order("activity_date", { ascending: false })
      .then(({ data }) => setList(data ?? []));
  }, [league.id, userId]);
  if (list.length === 0) return <Card className="p-12 text-center text-muted-foreground">Sem registros de frequência ainda.</Card>;
  const presentes = list.filter((l) => l.present).length;
  return (
    <Card><CardHeader><CardTitle>Minha Frequência ({presentes}/{list.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {list.map((a) => (
          <div key={a.id} className="flex items-center justify-between p-3 rounded border">
            <div><span className="font-bold">{a.activity}</span><span className="text-xs text-muted-foreground ml-2">{new Date(a.activity_date).toLocaleDateString("pt-BR")}</span></div>
            {a.present ? <Badge className="bg-emerald-600">Presente</Badge> : <Badge variant="destructive">Faltou</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PerformanceView({ userId }: { userId: string }) {
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  useEffect(() => {
    supabase.from("league_quiz_answers").select("is_correct").eq("user_id", userId).then(({ data }) => {
      const arr = data ?? [];
      setStats({ total: arr.length, correct: arr.filter((a: any) => a.is_correct).length });
    });
  }, [userId]);
  const pct = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
  return (
    <Card><CardContent className="p-8 text-center">
      <BarChart2 className="size-12 mx-auto text-primary mb-3" />
      <p className="text-5xl font-black">{pct}%</p>
      <p className="text-muted-foreground mt-2">{stats.correct} acertos em {stats.total} questões respondidas</p>
    </CardContent></Card>
  );
}

function ScheduleView({ league }: { league: League }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("league_schedule_items").select("*").eq("league_id", league.id).order("scheduled_date").order("scheduled_time")
      .then(({ data }) => setItems(data ?? []));
  }, [league.id]);

  // Agrupa por data
  const grouped = items.reduce((acc: Record<string, any[]>, it) => {
    (acc[it.scheduled_date] ??= []).push(it);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();

  if (items.length === 0) return <Card className="p-12 text-center text-muted-foreground">Nada na agenda ainda.</Card>;

  return (
    <div className="space-y-4">
      {sortedDates.map((date) => (
        <Card key={date}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grouped[date].map((s: any) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded border">
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: s.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{s.name}</span>
                    {s.scheduled_time && <Badge variant="secondary" className="text-[10px]">{s.scheduled_time.slice(0, 5)}</Badge>}
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

