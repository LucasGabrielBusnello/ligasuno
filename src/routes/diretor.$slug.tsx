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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type CashTxn = {
  id: string;
  kind: "entrada" | "saida";
  amount_cents: number;
  category: string;
  description: string;
  notes: string | null;
  occurred_at: string;
  created_at: string;
  source: "manual" | "site";
  color: "green" | "red" | "blue";
  detail?: any;
};

const BRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ENTRADA_CATS = [
  { v: "saldo_remanescente", l: "Saldo remanescente" },
  { v: "doacao", l: "Doação" },
  { v: "patrocinio", l: "Patrocínio" },
  { v: "venda", l: "Venda / arrecadação" },
  { v: "reembolso", l: "Reembolso" },
  { v: "outro", l: "Outro" },
];
const SAIDA_CATS = [
  { v: "material", l: "Material / insumos" },
  { v: "evento", l: "Despesas de evento" },
  { v: "transporte", l: "Transporte" },
  { v: "premio", l: "Premiação" },
  { v: "taxa", l: "Taxa / imposto" },
  { v: "outro", l: "Outro" },
];

function CaixaTab({ league }: { league: League }) {
  const [manual, setManual] = useState<any[]>([]);
  const [siteTxns, setSiteTxns] = useState<any[]>([]);
  const [profById, setProfById] = useState<Map<string, any>>(new Map());
  const [eventsById, setEventsById] = useState<Map<string, any>>(new Map());
  const [mcById, setMcById] = useState<Map<string, any>>(new Map());
  const [openId, setOpenId] = useState<string | null>(null);
  const [dlgOpen, setDlgOpen] = useState<null | "entrada" | "saida">(null);
  const [filter, setFilter] = useState<"todos" | "entrada" | "saida">("todos");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const monthOptions = [
    { value: "all", label: "Todos os meses" },
    ...Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, "0");
      const label = new Date(currentYear, i, 1).toLocaleDateString("pt-BR", { month: "long" });
      return { value: `${currentYear}-${month}`, label: `${label.charAt(0).toUpperCase() + label.slice(1)} de ${currentYear}` };
    }).filter((opt) => opt.value <= `${currentYear}-${currentMonth}`),
  ];

  async function reload() {
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase
        .from("league_cash_entries")
        .select("*")
        .eq("league_id", league.id)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_transactions")
        .select("*")
        .eq("league_id", league.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
    ]);
    setManual(m ?? []);
    setSiteTxns(t ?? []);

    const userIds = new Set<string>();
    const eventIds = new Set<string>();
    const mcIds = new Set<string>();
    (m ?? []).forEach((x: any) => x.created_by && userIds.add(x.created_by));
    (t ?? []).forEach((x: any) => {
      if (x.user_id) userIds.add(x.user_id);
      if (x.category === "event" && x.reference_id) eventIds.add(x.reference_id);
      if (x.category === "minicourse" && x.reference_id) mcIds.add(x.reference_id);
    });
    const [{ data: profs }, { data: evs }, { data: mcs }] = await Promise.all([
      userIds.size
        ? supabase.from("profiles").select("id, username, full_name, email").in("id", Array.from(userIds))
        : Promise.resolve({ data: [] as any[] }),
      eventIds.size
        ? supabase.from("league_events").select("id, title, price_cents, member_discount_cents").in("id", Array.from(eventIds))
        : Promise.resolve({ data: [] as any[] }),
      mcIds.size
        ? supabase.from("league_minicourses").select("id, title, price_cents").in("id", Array.from(mcIds))
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setProfById(new Map((profs ?? []).map((p: any) => [p.id, p])));
    setEventsById(new Map((evs ?? []).map((e: any) => [e.id, e])));
    setMcById(new Map((mcs ?? []).map((e: any) => [e.id, e])));
  }
  useEffect(() => {
    reload();
  }, [league.id]);

  const txns: CashTxn[] = [
    ...manual.map((m: any) => ({
      id: `m:${m.id}`,
      kind: m.kind as "entrada" | "saida",
      amount_cents: m.amount_cents,
      category: m.category,
      description: m.description,
      notes: m.notes,
      occurred_at: m.occurred_at,
      created_at: m.created_at,
      source: "manual" as const,
      color: (m.kind === "entrada" ? "green" : "red") as "green" | "red",
      detail: m,
    })),
    ...siteTxns.map((t: any) => {
      let desc = "Pagamento";
      let cat = t.category;
      if (t.category === "semester" || t.category === "anuidade_semestral") {
        desc = "Mensalidade / Semestralidade";
        cat = "mensalidade";
      } else if (t.category === "event") {
        const ev = eventsById.get(t.reference_id);
        desc = ev ? `Inscrição no Evento: ${ev.title}` : "Inscrição em evento";
      } else if (t.category === "minicourse") {
        const mc = mcById.get(t.reference_id);
        desc = mc ? `Minicurso: ${mc.title}` : "Minicurso";
      } else if (t.category === "selection") {
        desc = "Taxa de inscrição - Prova de seleção";
      } else if (t.category === "anuidade") {
        desc = "Anuidade da liga";
      }
      return {
        id: `s:${t.id}`,
        kind: "entrada" as const,
        amount_cents: Math.round((Number(t.gross_amount) - Number(t.fee_amount || 0)) * 100),
        category: cat,
        description: desc,
        notes: null,
        occurred_at: (t.created_at as string).slice(0, 10),
        created_at: t.created_at,
        source: "site" as const,
        color: "green" as const,
        detail: t,
      };
    }),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const totalIn = txns.filter((t) => t.kind === "entrada").reduce((s, t) => s + t.amount_cents, 0);
  const totalOut = txns.filter((t) => t.kind === "saida").reduce((s, t) => s + t.amount_cents, 0);
  const balance = totalIn - totalOut;

  const monthPrefix = monthFilter === "all" ? `${currentYear}-` : monthFilter;
  const monthIn = txns.filter((t) => t.kind === "entrada" && t.occurred_at.startsWith(monthPrefix)).reduce((s, t) => s + t.amount_cents, 0);
  const monthOut = txns.filter((t) => t.kind === "saida" && t.occurred_at.startsWith(monthPrefix)).reduce((s, t) => s + t.amount_cents, 0);

  const filtered = txns.filter((t) => {
    const matchesKind = filter === "todos" || t.kind === filter;
    const matchesMonth = monthFilter === "all" ? t.occurred_at.startsWith(`${currentYear}-`) : t.occurred_at.startsWith(monthFilter);
    return matchesKind && matchesMonth;
  });

  async function delManual(id: string) {
    if (!confirm("Excluir este registro? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("league_cash_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Registro excluído");
    reload();
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="p-6" style={{ background: `linear-gradient(135deg, ${league.theme_color || "#1f5132"}, ${league.theme_color || "#1f5132"}dd)` }}>
          <div className="flex items-center gap-2 text-white/80 text-sm"><Wallet className="size-4" /> Saldo atual</div>
          <div className={`text-4xl md:text-5xl font-black mt-2 ${balance < 0 ? "text-red-300" : "text-white"}`}>{BRL(balance)}</div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
            <div>
              <div className="text-xs text-white/70 flex items-center gap-1"><TrendingUp className="size-3" /> Entradas (total)</div>
              <div className="text-lg font-bold text-white">{BRL(totalIn)}</div>
            </div>
            <div>
              <div className="text-xs text-white/70 flex items-center gap-1"><TrendingDown className="size-3" /> Saídas (total)</div>
              <div className="text-lg font-bold text-white">{BRL(totalOut)}</div>
            </div>
          </div>
        </div>
        <CardContent className="p-4 grid grid-cols-2 gap-3 bg-muted/30">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Entradas do mês</div>
            <div className="font-bold text-green-600">{BRL(monthIn)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Saídas do mês</div>
            <div className="font-bold text-red-600">{BRL(monthOut)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-2">
        <Button onClick={() => setDlgOpen("entrada")} className="bg-green-600 hover:bg-green-700"><ArrowUpCircle className="size-4" /> Registrar Entrada</Button>
        <Button onClick={() => setDlgOpen("saida")} variant="destructive"><ArrowDownCircle className="size-4" /> Registrar Saída</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Histórico de transações</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "todos" ? "default" : "outline"} onClick={() => setFilter("todos")}>Todas</Button>
            <Button size="sm" variant={filter === "entrada" ? "default" : "outline"} onClick={() => setFilter("entrada")}>Entradas</Button>
            <Button size="sm" variant={filter === "saida" ? "default" : "outline"} onClick={() => setFilter("saida")}>Saídas</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação ainda. Registre a entrada inicial (saldo remanescente) para começar.</p>}
          {filtered.map((t) => {
            const isOpen = openId === t.id;
            const catLabel = [...ENTRADA_CATS, ...SAIDA_CATS].find((c) => c.v === t.category)?.l ?? t.category;
            const prof = t.source === "site" ? profById.get(t.detail?.user_id) : profById.get(t.detail?.created_by);
            // Discount info for events
            let discountLine: string | null = null;
            if (t.source === "site" && t.detail?.category === "event") {
              const ev = eventsById.get(t.detail.reference_id);
              if (ev && Number(ev.price_cents) > 0) {
                const paidCents = Math.round(Number(t.detail.gross_amount) * 100);
                const diff = Number(ev.price_cents) - paidCents;
                if (diff > 0) discountLine = `Desconto aplicado: ${BRL(diff)} (Ligante)`;
              }
            }
            return (
              <div key={t.id} className={`rounded border-l-4 ${t.kind === "entrada" ? "border-green-500 bg-green-50/40 dark:bg-green-950/20" : "border-red-500 bg-red-50/40 dark:bg-red-950/20"}`}>
                <button onClick={() => setOpenId(isOpen ? null : t.id)} className="w-full text-left p-3 flex items-center gap-3">
                  <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${t.kind === "entrada" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                    {t.kind === "entrada" ? <ArrowUpCircle className="size-5" /> : <ArrowDownCircle className="size-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{t.description}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{new Date(t.occurred_at + "T12:00").toLocaleDateString("pt-BR")}</span>
                      <Badge variant="secondary" className="text-[10px]">{catLabel}</Badge>
                      {t.source === "site" && <Badge variant="outline" className="text-[10px]">via site</Badge>}
                    </div>
                    {discountLine && <div className="text-xs text-amber-600 dark:text-amber-400 italic mt-0.5">{discountLine}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-black ${t.kind === "entrada" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {t.kind === "entrada" ? "+" : "−"} {BRL(t.amount_cents)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">{isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}</div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t bg-background/40 text-sm space-y-1">
                    {prof && (
                      <div><span className="text-muted-foreground">{t.source === "site" ? "Pago por:" : "Registrado por:"}</span> <span className="font-medium">{prof.full_name || prof.username}</span> <span className="text-xs text-muted-foreground">({prof.email})</span></div>
                    )}
                    {t.source === "site" && (
                      <>
                        <div><span className="text-muted-foreground">Origem:</span> Pagamento via Mercado Pago</div>
                        {t.detail?.payment_method && <div><span className="text-muted-foreground">Método:</span> {t.detail.payment_method}</div>}
                        <div><span className="text-muted-foreground">Valor bruto:</span> {BRL(Math.round(Number(t.detail.gross_amount) * 100))}</div>
                        {Number(t.detail.fee_amount) > 0 && <div><span className="text-muted-foreground">Taxa MP:</span> −{BRL(Math.round(Number(t.detail.fee_amount) * 100))}</div>}
                        {t.detail?.mp_payment_id && <div className="text-xs text-muted-foreground">ID MP: {t.detail.mp_payment_id}</div>}
                      </>
                    )}
                    {t.source === "manual" && (
                      <>
                        <div><span className="text-muted-foreground">Origem:</span> Registro manual</div>
                        {t.notes && <div><span className="text-muted-foreground">Observações:</span> {t.notes}</div>}
                        <div className="pt-2">
                          <Button size="sm" variant="destructive" onClick={() => delManual(t.detail.id)}><Trash2 className="size-3" /> Excluir registro</Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <CashEntryDialog
        open={dlgOpen !== null}
        kind={dlgOpen ?? "entrada"}
        leagueId={league.id}
        onClose={() => setDlgOpen(null)}
        onSaved={() => { setDlgOpen(null); reload(); }}
      />
    </div>
  );
}

function CashEntryDialog({ open, kind, leagueId, onClose, onSaved }: { open: boolean; kind: "entrada" | "saida"; leagueId: string; onClose: () => void; onSaved: () => void }) {
  const cats = kind === "entrada" ? ENTRADA_CATS : SAIDA_CATS;
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(cats[0].v);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(""); setDescription(""); setNotes("");
      setCategory((kind === "entrada" ? ENTRADA_CATS : SAIDA_CATS)[0].v);
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, kind]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) return toast.error("Valor inválido");
    if (!description.trim()) return toast.error("Descreva a transação");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("league_cash_entries").insert({
      league_id: leagueId,
      kind,
      amount_cents: Math.round(value * 100),
      category,
      description: description.trim(),
      notes: notes.trim() || null,
      occurred_at: date,
      created_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(kind === "entrada" ? "Entrada registrada" : "Saída registrada");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === "entrada" ? <ArrowUpCircle className="size-5 text-green-600" /> : <ArrowDownCircle className="size-5 text-red-600" />}
            {kind === "entrada" ? "Registrar Entrada" : "Registrar Saída"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" required placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "entrada" ? "Ex: Saldo remanescente da gestão anterior" : "Ex: Compra de material para aula prática"} />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes adicionais, número da nota, etc." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className={kind === "entrada" ? "bg-green-600 hover:bg-green-700" : ""} variant={kind === "saida" ? "destructive" : "default"}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

