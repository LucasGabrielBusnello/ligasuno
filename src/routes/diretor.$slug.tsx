import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Calendar, Users, CheckSquare, Newspaper, HelpCircle, Plus, Trash2, CalendarDays, BarChart3 } from "lucide-react";
import { LeagueQuizManager } from "@/components/league-quiz-manager";
import { LeaguePerformanceTab } from "@/components/league-performance-tab";

export const Route = createFileRoute("/diretor/$slug")({ component: DiretorPage });

function DiretorPage() {
  const { slug } = Route.useParams();
  const { user, isAdminMaster, loading } = useAuth();
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
  const allowed = isAdminMaster || league.president_id === user.id || myRole === "diretor";
  if (!allowed) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="text-2xl font-black">Acesso negado</h1>
      <Button asChild className="mt-6"><Link to="/$slug" params={{ slug }}>Voltar</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/$slug" params={{ slug }} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> {league.name}</Link>
          <Badge><ShieldCheck className="size-3 mr-1" />Diretor</Badge>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do Diretor</h1>
        <p className="text-muted-foreground mb-6">{league.name}</p>
        <Tabs defaultValue="freq">
          <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full h-auto">
            <TabsTrigger value="freq"><CheckSquare className="size-4 mr-1" />Frequência</TabsTrigger>
            <TabsTrigger value="agenda"><Calendar className="size-4 mr-1" />Eventos</TabsTrigger>
            <TabsTrigger value="news"><Newspaper className="size-4 mr-1" />Notícias</TabsTrigger>
            <TabsTrigger value="quiz"><HelpCircle className="size-4 mr-1" />Quizzes</TabsTrigger>
            <TabsTrigger value="schedule"><CalendarDays className="size-4 mr-1" />Agenda</TabsTrigger>
          </TabsList>
          <TabsContent value="freq" className="mt-6"><FreqTab league={league} /></TabsContent>
          <TabsContent value="agenda" className="mt-6"><EventsListTab league={league} /></TabsContent>
          <TabsContent value="news" className="mt-6"><NewsTab league={league} /></TabsContent>
          <TabsContent value="quiz" className="mt-6"><QuizTab league={league} /></TabsContent>
          <TabsContent value="schedule" className="mt-6"><ScheduleTab league={league} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FreqTab({ league }: { league: League }) {
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data: mships } = await supabase.from("league_memberships").select("user_id, role, profiles!inner(username,email)").eq("league_id", league.id);
      const list = (mships ?? []).filter((m: any) => ["ligante", "diretor"].includes(m.role));
      if (league.president_id && !list.some((m: any) => m.user_id === league.president_id)) {
        const { data: pres } = await supabase.from("profiles").select("username,email").eq("id", league.president_id).maybeSingle();
        if (pres) list.push({ user_id: league.president_id, role: "presidente", profiles: pres } as any);
      }
      setMembers(list);
    })();
  }, [league.id, league.president_id]);

  async function save() {
    if (!activity || !date) return toast.error("Preencha atividade e data");
    const rows = members.map((m) => ({
      league_id: league.id, activity, activity_date: date,
      user_id: m.user_id, present: !!presence[m.user_id],
    }));
    const { error } = await supabase.from("league_attendance").upsert(rows, { onConflict: "league_id,activity,activity_date,user_id" });
    if (error) return toast.error(error.message);
    toast.success("Frequência salva");
  }

  return (
    <Card><CardContent className="p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Atividade</Label><Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex: Aula de Cardio" /></div>
        <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <label key={m.user_id} className="flex items-center justify-between p-3 rounded border cursor-pointer hover:bg-muted/50">
            <span><span className="font-bold">{m.profiles?.username}</span> <Badge variant="secondary" className="ml-2">{m.role}</Badge></span>
            <input type="checkbox" checked={!!presence[m.user_id]} onChange={(e) => setPresence({ ...presence, [m.user_id]: e.target.checked })} />
          </label>
        ))}
        {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum ligante cadastrado.</p>}
      </div>
      <Button onClick={save} className="w-full"><Users className="size-4" /> Salvar Presenças</Button>
    </CardContent></Card>
  );
}

function EventsListTab({ league }: { league: League }) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("league_events").select("*").eq("league_id", league.id).order("created_at", { ascending: false })
      .then(({ data }) => setEvents(data ?? []));
  }, [league.id]);
  return (
    <Card><CardHeader><CardTitle>Eventos da liga (somente leitura)</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento. Apenas o presidente pode criar eventos.</p> : events.map((e) => (
          <div key={e.id} className="p-3 rounded border">
            <div className="font-bold">{e.title}</div>
            {e.event_date && <div className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString("pt-BR")}</div>}
            {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NewsTab({ league }: { league: League }) {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const blank = { title: "", excerpt: "", image_url: "", category: "Geral", link: "" };
  const [f, setF] = useState(blank);
  const reload = async () => {
    const { data } = await supabase.from("league_news").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("league_news").insert({ ...f, league_id: league.id, image_url: f.image_url || null, link: f.link || null });
    if (error) return toast.error(error.message);
    toast.success("Publicado"); setOpen(false); setF(blank); reload();
  }
  async function del(id: string) { if (!confirm("Excluir?")) return; await supabase.from("league_news").delete().eq("id", id); reload(); }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="size-4" /> Nova notícia</Button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((n) => (
          <Card key={n.id}><CardContent className="p-4 flex gap-3">
            {n.image_url && <img src={n.image_url} className="size-16 rounded object-cover" />}
            <div className="flex-1"><Badge variant="secondary" className="text-[10px]">{n.category}</Badge><h4 className="font-black mt-1">{n.title}</h4><p className="text-xs text-muted-foreground line-clamp-2">{n.excerpt}</p></div>
            <Button size="sm" variant="destructive" onClick={() => del(n.id)}><Trash2 className="size-3" /></Button>
          </CardContent></Card>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-4">Nenhuma notícia ainda.</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Notícia</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
            <div><Label>Resumo</Label><Textarea value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></div>
            <div><Label>Imagem (URL)</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></div>
            <div><Label>Link externo</Label><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div>
            <DialogFooter><Button type="submit">Publicar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuizTab({ league }: { league: League }) {
  const [sets, setSets] = useState<any[]>([]);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [newSet, setNewSet] = useState({ title: "", description: "", is_private: false });
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [nq, setNq] = useState({ question: "", options: ["", "", "", ""], correct_answer: 0, explanation: "" });

  const reload = async () => {
    const { data } = await supabase.from("league_quiz_sets").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setSets(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  useEffect(() => {
    if (!openSet) return;
    supabase.from("league_quizzes").select("*").eq("quiz_set_id", openSet).order("display_order").then(({ data }) => setQuizzes(data ?? []));
  }, [openSet]);

  async function createSet() {
    if (!newSet.title) return;
    const { error } = await supabase.from("league_quiz_sets").insert({ ...newSet, league_id: league.id });
    if (error) return toast.error(error.message);
    setNewSet({ title: "", description: "", is_private: false }); reload();
  }
  async function delSet(id: string) { if (!confirm("Excluir caderno e suas questões?")) return; await supabase.from("league_quiz_sets").delete().eq("id", id); reload(); }
  async function addQuiz() {
    if (!nq.question || nq.options.some(o => !o)) return toast.error("Preencha pergunta e 4 alternativas");
    if (!openSet) return;
    const { error } = await supabase.from("league_quizzes").insert({ ...nq, quiz_set_id: openSet, display_order: quizzes.length });
    if (error) return toast.error(error.message);
    setNq({ question: "", options: ["", "", "", ""], correct_answer: 0, explanation: "" });
    const { data } = await supabase.from("league_quizzes").select("*").eq("quiz_set_id", openSet).order("display_order");
    setQuizzes(data ?? []);
  }
  async function delQuiz(id: string) {
    await supabase.from("league_quizzes").delete().eq("id", id);
    const { data } = await supabase.from("league_quizzes").select("*").eq("quiz_set_id", openSet!).order("display_order");
    setQuizzes(data ?? []);
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-6 space-y-3">
        <h3 className="font-black">Criar novo caderno</h3>
        <Input placeholder="Título" value={newSet.title} onChange={(e) => setNewSet({ ...newSet, title: e.target.value })} />
        <Textarea placeholder="Descrição" value={newSet.description} onChange={(e) => setNewSet({ ...newSet, description: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><Switch checked={newSet.is_private} onCheckedChange={(v) => setNewSet({ ...newSet, is_private: v })} /> Privado (somente ligantes)</label>
        <Button onClick={createSet}><Plus className="size-4" /> Criar caderno</Button>
      </CardContent></Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {sets.map((s) => (
          <Card key={s.id} className={openSet === s.id ? "border-primary" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-black truncate">{s.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                  {s.is_private && <Badge variant="secondary" className="mt-1 text-[10px]">Privado</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setOpenSet(openSet === s.id ? null : s.id)}>{openSet === s.id ? "Fechar" : "Editar"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => delSet(s.id)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {openSet && (
        <Card><CardHeader><CardTitle>Questões do caderno</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {quizzes.map((q, i) => (
                <div key={q.id} className="p-3 rounded border flex justify-between gap-2">
                  <div className="text-sm"><span className="font-bold">Q{i + 1}.</span> {q.question}</div>
                  <Button size="sm" variant="destructive" onClick={() => delQuiz(q.id)}><Trash2 className="size-3" /></Button>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-2">
              <Label className="font-black">Nova questão</Label>
              <Textarea placeholder="Enunciado" value={nq.question} onChange={(e) => setNq({ ...nq, question: e.target.value })} />
              {nq.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" checked={nq.correct_answer === i} onChange={() => setNq({ ...nq, correct_answer: i })} />
                  <Input placeholder={`Alternativa ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => { const o = [...nq.options]; o[i] = e.target.value; setNq({ ...nq, options: o }); }} />
                </div>
              ))}
              <Textarea placeholder="Explicação (mostrada após responder)" value={nq.explanation} onChange={(e) => setNq({ ...nq, explanation: e.target.value })} />
              <Button onClick={addQuiz}><Plus className="size-4" /> Adicionar questão</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScheduleTab({ league }: { league: League }) {
  const [list, setList] = useState<any[]>([]);
  const blank = { name: "", description: "", scheduled_date: "", scheduled_time: "", color: league.theme_color || "#1f5132" };
  const [f, setF] = useState(blank);
  const reload = async () => {
    const { data } = await supabase.from("league_schedule_items").select("*").eq("league_id", league.id).order("scheduled_date").order("scheduled_time");
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.scheduled_date) return toast.error("Nome e data obrigatórios");
    const { error } = await supabase.from("league_schedule_items").insert({
      league_id: league.id, name: f.name, description: f.description || null,
      scheduled_date: f.scheduled_date, scheduled_time: f.scheduled_time || null, color: f.color,
    });
    if (error) return toast.error(error.message);
    setF(blank); reload();
  }
  async function del(id: string) { if (!confirm("Excluir?")) return; await supabase.from("league_schedule_items").delete().eq("id", id); reload(); }
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-6 space-y-3">
        <h3 className="font-black">Adicionar item na agenda</h3>
        <form onSubmit={add} className="space-y-3">
          <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex: Reunião semanal" /></div>
          <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Data</Label><Input type="date" required value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
            <div><Label>Hora</Label><Input type="time" value={f.scheduled_time} onChange={(e) => setF({ ...f, scheduled_time: e.target.value })} /></div>
            <div><Label>Cor</Label><Input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
          </div>
          <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
        </form>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Próximos itens</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">Nada na agenda ainda.</p>}
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded border">
              <div className="size-3 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1">
                <div className="font-bold">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.scheduled_date).toLocaleDateString("pt-BR")}
                  {s.scheduled_time && ` às ${s.scheduled_time.slice(0, 5)}`}
                </div>
                {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
              </div>
              <Button size="sm" variant="destructive" onClick={() => del(s.id)}><Trash2 className="size-3" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
