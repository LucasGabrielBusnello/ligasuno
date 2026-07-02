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

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Calendar, Users, CheckSquare, Newspaper, HelpCircle, Plus, Trash2, CalendarDays, BarChart3, Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
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
          <TabsList className="grid grid-cols-3 md:grid-cols-7 w-full h-auto">
            <TabsTrigger value="freq"><CheckSquare className="size-4 mr-1" />Frequência</TabsTrigger>
            <TabsTrigger value="agenda"><Calendar className="size-4 mr-1" />Eventos</TabsTrigger>
            <TabsTrigger value="news"><Newspaper className="size-4 mr-1" />Notícias</TabsTrigger>
            <TabsTrigger value="quiz"><HelpCircle className="size-4 mr-1" />Quizzes</TabsTrigger>
            <TabsTrigger value="perf"><BarChart3 className="size-4 mr-1" />Desempenho</TabsTrigger>
            <TabsTrigger value="schedule"><CalendarDays className="size-4 mr-1" />Agenda</TabsTrigger>
            <TabsTrigger value="caixa"><Wallet className="size-4 mr-1" />Caixa</TabsTrigger>
          </TabsList>
          <TabsContent value="freq" className="mt-6"><FreqTab league={league} /></TabsContent>
          <TabsContent value="agenda" className="mt-6"><EventsListTab league={league} /></TabsContent>
          <TabsContent value="news" className="mt-6"><NewsTab league={league} /></TabsContent>
          <TabsContent value="quiz" className="mt-6"><LeagueQuizManager league={league} /></TabsContent>
          <TabsContent value="perf" className="mt-6"><LeaguePerformanceTab league={league} /></TabsContent>
          <TabsContent value="schedule" className="mt-6"><ScheduleTab league={league} /></TabsContent>
          <TabsContent value="caixa" className="mt-6"><CaixaTab league={league} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FreqTab({ league }: { league: League }) {
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState<string>("1");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [status, setStatus] = useState<Record<string, "presente" | "ausente" | "justificada">>({});
  const [sessions, setSessions] = useState<any[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  async function loadMembers() {
    const { data: mships } = await supabase.from("league_memberships").select("user_id, role").eq("league_id", league.id);
    const list = ((mships ?? []) as any[]).filter((m: any) => ["ligante", "diretor", "presidente"].includes(m.role));
    if (league.president_id && !list.some((m: any) => m.user_id === league.president_id)) {
      list.push({ user_id: league.president_id, role: "presidente" });
    }
    const ids = list.map((m: any) => m.user_id);
    let profById = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, email").in("id", ids);
      profById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }
    setMembers(list.map((m: any) => ({ ...m, profiles: profById.get(m.user_id) ?? { username: "", email: "" } })));
  }

  async function loadSessions() {
    const { data } = await supabase.from("league_attendance").select("*").eq("league_id", league.id).order("activity_date", { ascending: false });
    const grouped: Record<string, any> = {};
    (data ?? []).forEach((r: any) => {
      const key = `${r.activity}|${r.activity_date}`;
      if (!grouped[key]) grouped[key] = { key, activity: r.activity, activity_date: r.activity_date, hours: Number(r.hours) || 0, description: r.description ?? "", rows: [] };
      grouped[key].rows.push(r);
    });
    setSessions(Object.values(grouped));
  }

  useEffect(() => { loadMembers(); loadSessions(); }, [league.id, league.president_id]);

  async function save() {
    if (!activity || !date) return toast.error("Preencha atividade e data");
    const h = Number(hours);
    if (isNaN(h) || h < 0) return toast.error("Horas inválidas");
    const rows = members.map((m) => ({
      league_id: league.id, activity, activity_date: date,
      user_id: m.user_id,
      status: status[m.user_id] ?? "ausente",
      present: (status[m.user_id] ?? "ausente") === "presente",
      hours: h,
      description: description || null,
    }));
    const { error } = await supabase.from("league_attendance").upsert(rows, { onConflict: "league_id,activity,activity_date,user_id" });
    if (error) return toast.error(error.message);
    toast.success("Frequência salva");
    setActivity(""); setDate(""); setHours("1"); setDescription(""); setStatus({}); setEditingKey(null);
    loadSessions();
  }

  function startEdit(s: any) {
    setActivity(s.activity);
    setDate(s.activity_date);
    setHours(String(s.hours ?? 0));
    setDescription(s.description ?? "");
    const st: Record<string, "presente" | "ausente" | "justificada"> = {};
    s.rows.forEach((r: any) => { st[r.user_id] = (r.status as any) ?? (r.present ? "presente" : "ausente"); });
    setStatus(st);
    setEditingKey(s.key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function delSession(s: any) {
    if (!confirm(`Excluir frequência de "${s.activity}" em ${new Date(s.activity_date).toLocaleDateString("pt-BR")}?`)) return;
    const { error } = await supabase.from("league_attendance").delete()
      .eq("league_id", league.id).eq("activity", s.activity).eq("activity_date", s.activity_date);
    if (error) return toast.error(error.message);
    toast.success("Frequência excluída");
    if (editingKey === s.key) { setActivity(""); setDate(""); setHours("1"); setDescription(""); setStatus({}); setEditingKey(null); }
    loadSessions();
  }

  function setStatusFor(uid: string, st: "presente" | "ausente" | "justificada") {
    setStatus((s) => ({ ...s, [uid]: st }));
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black">{editingKey ? "Editar frequência" : "Nova frequência"}</h3>
          {editingKey && <Button size="sm" variant="ghost" onClick={() => { setActivity(""); setDate(""); setHours("1"); setDescription(""); setStatus({}); setEditingKey(null); }}>Cancelar edição</Button>}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2"><Label>Atividade</Label><Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex: Aula de Cardio" /></div>
          <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>Horas equivalentes</Label>
            <Input type="number" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Observações sobre a atividade" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2 border-l-2 border-primary/50">
          As <strong>horas equivalentes</strong> definem quantas horas essa atividade vale no <strong>certificado oficial</strong> do semestre.
          Apenas membros marcados como <strong>Presente</strong> recebem essas horas. <strong>Justificada</strong> e <strong>Ausente</strong> contam 0 horas.
        </p>

        <div className="space-y-2">
          {members.map((m) => {
            const st = status[m.user_id] ?? "ausente";
            return (
              <div key={m.user_id} className="flex items-center justify-between p-3 rounded border gap-2 flex-wrap">
                <span><span className="font-bold">{m.profiles?.username}</span> <Badge variant="secondary" className="ml-2">{m.role}</Badge></span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant={st === "presente" ? "default" : "outline"} onClick={() => setStatusFor(m.user_id, "presente")} className={st === "presente" ? "bg-green-600 hover:bg-green-700" : ""}>Presente</Button>
                  <Button type="button" size="sm" variant={st === "justificada" ? "default" : "outline"} onClick={() => setStatusFor(m.user_id, "justificada")} className={st === "justificada" ? "bg-amber-600 hover:bg-amber-700" : ""}>Justificada</Button>
                  <Button type="button" size="sm" variant={st === "ausente" ? "destructive" : "outline"} onClick={() => setStatusFor(m.user_id, "ausente")}>Ausente</Button>
                </div>
              </div>
            );
          })}
          {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum ligante cadastrado.</p>}
        </div>
        <Button onClick={save} className="w-full"><Users className="size-4" /> {editingKey ? "Atualizar Presenças" : "Salvar Presenças"}</Button>
      </CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Frequências registradas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sessions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma frequência registrada ainda.</p>}
          {sessions.map((s) => {
            const presentes = s.rows.filter((r: any) => (r.status ?? (r.present ? "presente" : "ausente")) === "presente").length;
            const justificadas = s.rows.filter((r: any) => r.status === "justificada").length;
            const ausentes = s.rows.length - presentes - justificadas;
            return (
              <div key={s.key} className="p-3 rounded border flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.activity} <Badge variant="secondary" className="ml-1 text-[10px]">{Number(s.hours).toFixed(1).replace(".", ",")}h</Badge></div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.activity_date).toLocaleDateString("pt-BR")} · {presentes}P · {justificadas}J · {ausentes}A
                  </div>
                  {s.description && <div className="text-xs text-muted-foreground italic mt-0.5">{s.description}</div>}
                </div>
                <Button size="sm" variant="outline" onClick={() => startEdit(s)}>Editar</Button>
                <Button size="sm" variant="destructive" onClick={() => delSession(s)}><Trash2 className="size-3" /></Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const reload = async () => {
    const { data } = await supabase.from("league_news").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  function openNew() { setEditingId(null); setF(blank); setOpen(true); }
  function openEdit(n: any) {
    setEditingId(n.id);
    setF({ title: n.title ?? "", excerpt: n.excerpt ?? "", image_url: n.image_url ?? "", category: n.category ?? "Geral", link: n.link ?? "" });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, league_id: league.id, image_url: f.image_url || null, link: f.link || null };
    const { error } = editingId
      ? await supabase.from("league_news").update(payload).eq("id", editingId)
      : await supabase.from("league_news").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Notícia atualizada" : "Publicado"); setOpen(false); setF(blank); setEditingId(null); reload();
  }
  async function del(id: string) { if (!confirm("Excluir?")) return; await supabase.from("league_news").delete().eq("id", id); reload(); }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="size-4" /> Nova notícia</Button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((n) => (
          <Card key={n.id}><CardContent className="p-4 flex gap-3">
            {n.image_url && <img src={n.image_url} className="size-16 rounded object-cover" />}
            <div className="flex-1 min-w-0"><Badge variant="secondary" className="text-[10px]">{n.category}</Badge><h4 className="font-black mt-1 truncate">{n.title}</h4><p className="text-xs text-muted-foreground line-clamp-2">{n.excerpt}</p></div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => openEdit(n)}>Editar</Button>
              <Button size="sm" variant="destructive" onClick={() => del(n.id)}><Trash2 className="size-3" /></Button>
            </div>
          </CardContent></Card>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-4">Nenhuma notícia ainda.</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Notícia" : "Nova Notícia"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
            <div><Label>Resumo</Label><Textarea value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></div>
            <div><Label>Imagem (URL)</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></div>
            <div><Label>Link externo</Label><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div>
            <DialogFooter><Button type="submit">{editingId ? "Salvar" : "Publicar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
