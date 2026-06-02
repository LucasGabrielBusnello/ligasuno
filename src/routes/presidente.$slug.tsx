import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { ArrowLeft, Plus, Trash2, Calendar, Settings, Users, Bell, DollarSign, BookOpen, Newspaper, HelpCircle, Image as ImageIcon, CheckCircle2, ClipboardCheck } from "lucide-react";
import { createLeagueSubscriptionCheckout } from "@/lib/subscription.functions";
import { startMpOAuth, disconnectMp } from "@/lib/mp-oauth.functions";
import { SelectionManagerDialog } from "@/components/selection-manager";
import { SemesterDialog, StatusBadge as SemesterStatusBadge } from "@/components/semester-dialog";
import { listCyclePayments } from "@/lib/semester.functions";
import { listLeagueLeaveRequests, processLeaveRequest } from "@/lib/leave-request.functions";

export const Route = createFileRoute("/presidente/$slug")({ component: PresidentePage });

const ABOUT_KEYS = [
  { key: "ensino", label: "Ensino", placeholder: "Aulas, discussões clínicas e estudos dirigidos." },
  { key: "pesquisa", label: "Pesquisa", placeholder: "Projetos científicos e publicações." },
  { key: "extensao", label: "Extensão", placeholder: "Eventos, ações comunitárias e simpósios." },
];

function PresidentePage() {
  const { slug } = Route.useParams();
  const { user, isAdminMaster, loading } = useAuth();
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
      setLeague(data as League | null);
      const { data: s } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      setSettings(s);
    })();
  }, [slug]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user]);

  if (!league || !user) return <div className="p-12 text-center">Carregando...</div>;
  const isOwner = league.president_id === user.id || isAdminMaster;
  if (!isOwner) return <div className="p-12 text-center"><h1 className="text-2xl font-black">Acesso negado</h1></div>;

  const paid = !!(league.paid_until && new Date(league.paid_until) >= new Date());
  const paidUntilFmt = league.paid_until ? new Date(league.paid_until).toLocaleDateString("pt-BR") : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/$slug" params={{ slug }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {league.name}</Link>
          <Badge>Presidente</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do Presidente</h1>
        <p className="text-muted-foreground mb-6">{league.name}</p>

        {paid ? (
          <Card className="mb-6 border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <div>
                <p className="font-black text-emerald-700 dark:text-emerald-400">Liga ativa</p>
                <p className="text-sm text-muted-foreground">Data da próxima cobrança: <span className="font-bold">{paidUntilFmt}</span>.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <PayAnuidadeCard leagueId={league.id} settings={settings} />
        )}

        <MpConnectCard leagueId={league.id} />

        <Tabs defaultValue="config">
          <TabsList className="grid grid-cols-3 md:grid-cols-7 w-full h-auto">
            <TabsTrigger value="config"><Settings className="size-4 mr-1" />Config</TabsTrigger>
            <TabsTrigger value="about"><BookOpen className="size-4 mr-1" />Sobre</TabsTrigger>
            <TabsTrigger value="eventos"><Calendar className="size-4 mr-1" />Eventos</TabsTrigger>
            <TabsTrigger value="news"><Newspaper className="size-4 mr-1" />Notícias</TabsTrigger>
            <TabsTrigger value="quiz"><HelpCircle className="size-4 mr-1" />Quizzes</TabsTrigger>
            <TabsTrigger value="atividades"><ImageIcon className="size-4 mr-1" />Atividades</TabsTrigger>
            <TabsTrigger value="membros"><Users className="size-4 mr-1" />Membros</TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="mt-6"><ConfigTab league={league} setLeague={setLeague} paid={paid} /></TabsContent>
          <TabsContent value="about" className="mt-6"><AboutTab league={league} /></TabsContent>
          <TabsContent value="eventos" className="mt-6"><EventsTab league={league} /></TabsContent>
          <TabsContent value="news" className="mt-6"><NewsTab league={league} /></TabsContent>
          <TabsContent value="quiz" className="mt-6"><QuizTab league={league} /></TabsContent>
          <TabsContent value="atividades" className="mt-6"><ActivitiesTab league={league} /></TabsContent>
          <TabsContent value="membros" className="mt-6"><MembersTab league={league} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PayAnuidadeCard({ leagueId, settings }: { leagueId: string; settings: any }) {
  const startCheckout = useServerFn(createLeagueSubscriptionCheckout);
  const [loading, setLoading] = useState(false);
  async function pay() {
    try {
      setLoading(true);
      const res = await startCheckout({ data: { league_id: leagueId, origin_url: window.location.origin } });
      if (res?.url) window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar pagamento");
    } finally {
      setLoading(false);
    }
  }
  const value = Number(settings?.annual_fee_credit_monthly ?? 0);
  return (
    <Card className="mb-6 border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Anuidade pendente</CardTitle>
        <p className="text-sm text-muted-foreground">A liga não aparecerá na página inicial até a anuidade ser paga. Cobrança recorrente mensal no cartão.</p>
      </CardHeader>
      <CardContent>
        {settings && (
          <Card className="border-primary max-w-sm mx-auto"><CardContent className="p-4 text-center space-y-3">
            <Badge className="mb-1">Cartão</Badge>
            <div className="text-3xl font-black">R$ {value.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
            <Button className="w-full" disabled={loading} onClick={pay}>
              <DollarSign className="size-4" /> {loading ? "Abrindo..." : "Pagar com Cartão"}
            </Button>
          </CardContent></Card>
        )}
        <p className="text-xs text-muted-foreground mt-3 text-center">⚠ Cobrança mensal recorrente. Pode ser cancelada a qualquer momento. Pagamentos não são reembolsáveis.</p>
      </CardContent>
    </Card>
  );
}

function MpConnectCard({ leagueId }: { leagueId: string }) {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const startOAuth = useServerFn(startMpOAuth);
  const disconnect = useServerFn(disconnectMp);

  async function reload() {
    const { data } = await supabase.from("league_mp_accounts").select("*").eq("league_id", leagueId).maybeSingle();
    setAccount(data);
  }
  useEffect(() => { reload(); }, [leagueId]);

  // Mostra feedback do callback OAuth
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("mp_connected") === "1") { toast.success("Mercado Pago conectado!"); reload(); }
    if (p.get("mp_error")) toast.error("Falha ao conectar Mercado Pago: " + p.get("mp_error"));
  }, []);

  async function connect() {
    try {
      setLoading(true);
      const r = await startOAuth({ data: { league_id: leagueId } });
      if (r?.url) window.location.href = r.url;
    } catch (e: any) { toast.error(e?.message ?? "Falha"); } finally { setLoading(false); }
  }
  async function unlink() {
    if (!confirm("Desconectar Mercado Pago? Inscrições pagas ficarão indisponíveis até reconectar.")) return;
    try { await disconnect({ data: { league_id: leagueId } }); toast.success("Desconectado"); reload(); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  const connected = !!account;

  return (
    <Card className={`mb-6 ${connected ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-5" />
          Mercado Pago {connected && <Badge className="bg-emerald-600">Conectado</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {connected
            ? "Inscrições pagas (eventos, minicursos, processo seletivo) caem direto na sua conta Mercado Pago. A plataforma retém uma pequena taxa de repasse automaticamente."
            : "Conecte sua conta Mercado Pago para começar a receber pagamentos. Os valores caem direto na sua conta. Você precisa ter CPF cadastrado no Mercado Pago — a conta é gratuita."}
        </p>
      </CardHeader>
      <CardContent>
        {!connected ? (
          <Button onClick={connect} disabled={loading} size="lg">
            {loading ? "Abrindo..." : "Conectar Mercado Pago"}
          </Button>
        ) : (
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div className="text-sm">
              <div>ID Mercado Pago: <code className="font-mono">{account.mp_user_id}</code></div>
              <div className="text-muted-foreground text-xs">Conectado em {new Date(account.connected_at).toLocaleDateString("pt-BR")}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={connect} disabled={loading}>Reconectar</Button>
              <Button variant="destructive" onClick={unlink}>Desconectar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigTab({ league, setLeague, paid }: any) {
  const [f, setF] = useState({ name: league.name, icon_url: league.icon_url ?? "", theme_color: league.theme_color, description: league.description ?? "" });
  const [pub, setPub] = useState(league.published);
  async function save() {
    const { error } = await supabase.from("leagues").update({ ...f, icon_url: f.icon_url || null }).eq("id", league.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setLeague({ ...league, ...f });
  }
  async function togglePub(v: boolean) {
    if (v && !paid) return toast.error("Você precisa pagar a anuidade para publicar");
    setPub(v);
    const { error } = await supabase.from("leagues").update({ published: v }).eq("id", league.id);
    if (error) { setPub(!v); return toast.error(error.message); }
    toast.success(v ? "Publicado" : "Despublicado");
  }
  return (
    <Card><CardContent className="p-6 space-y-4">
      <div className="flex items-center justify-between p-4 rounded border">
        <div><div className="font-black">Site publicado</div><div className="text-sm text-muted-foreground">Aparece na página inicial quando ativo.</div></div>
        <Switch checked={pub} onCheckedChange={togglePub} />
      </div>
      <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Ícone (URL)</Label><Input value={f.icon_url} onChange={(e) => setF({ ...f, icon_url: e.target.value })} /></div>
      <div><Label>Cor tema</Label><Input type="color" value={f.theme_color} onChange={(e) => setF({ ...f, theme_color: e.target.value })} /></div>
      <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Button onClick={save}>Salvar</Button>
    </CardContent></Card>
  );
}

function AboutTab({ league }: any) {
  const [items, setItems] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("league_content").select("content_key,content_value").eq("league_id", league.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.content_key] = r.content_value; });
      setItems(map);
    })();
  }, [league.id]);
  async function save(key: string) {
    const value = items[key] ?? "";
    const { error } = await supabase.from("league_content").upsert(
      { league_id: league.id, content_key: key, content_value: value },
      { onConflict: "league_id,content_key" } as any
    );
    if (error) return toast.error(error.message);
    toast.success("Salvo");
  }
  return (
    <div className="space-y-4">
      {ABOUT_KEYS.map((k) => (
        <Card key={k.key}><CardContent className="p-6 space-y-3">
          <Label className="text-lg font-black">{k.label}</Label>
          <Textarea rows={4} placeholder={k.placeholder} value={items[k.key] ?? ""} onChange={(e) => setItems({ ...items, [k.key]: e.target.value })} />
          <Button onClick={() => save(k.key)}>Salvar {k.label}</Button>
        </CardContent></Card>
      ))}
    </div>
  );
}

function EventsTab({ league }: any) {
  const [events, setEvents] = useState<any[]>([]);
  const [allLeagues, setAllLeagues] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const blank = {
    title: "", description: "", image_url: "",
    event_date: "", schedule: "",
    price_ligante: 0, price_partner: 0, price_visitor: 0,
    partner_league_ids: [] as string[],
    max_seats: 0,
  };
  const [f, setF] = useState<any>(blank);
  const reload = async () => {
    const { data } = await supabase.from("league_events").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setEvents(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  useEffect(() => {
    supabase.from("leagues").select("id,name").neq("id", league.id).order("name").then(({ data }) => setAllLeagues(data ?? []));
  }, [league.id]);

  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(ev: any) {
    setEditing(ev);
    setF({
      title: ev.title, description: ev.description ?? "", image_url: ev.image_url ?? "",
      event_date: ev.event_date ?? "", schedule: ev.schedule ?? "",
      price_ligante: Number(ev.price_ligante) || 0,
      price_partner: Number(ev.price_partner) || 0,
      price_visitor: Number(ev.price_visitor) || 0,
      partner_league_ids: ev.partner_league_ids ?? [],
      max_seats: Number(ev.max_seats) || 0,
    });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      league_id: league.id,
      title: f.title,
      description: f.description,
      image_url: f.image_url || null,
      event_date: f.event_date || null,
      schedule: f.schedule || null,
      price_ligante: Number(f.price_ligante) || 0,
      price_partner: Number(f.price_partner) || 0,
      price_visitor: Number(f.price_visitor) || 0,
      partner_league_ids: f.partner_league_ids,
      max_seats: Number(f.max_seats) > 0 ? Number(f.max_seats) : null,
    };
    const { error } = editing
      ? await supabase.from("league_events").update(payload).eq("id", editing.id)
      : await supabase.from("league_events").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Atualizado" : "Criado"); setOpen(false); setF(blank); setEditing(null); reload();
  }
  async function del(id: string) { if (!confirm("Excluir?")) return; await supabase.from("league_events").delete().eq("id", id); reload(); }
  async function toggleField(id: string, field: "published" | "accepting_registrations", v: boolean) {
    const { error } = await supabase.from("league_events").update({ [field]: v } as any).eq("id", id);
    if (error) return toast.error(error.message);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, [field]: v } : e));
  }
  function togglePartner(id: string) {
    setF((p: any) => ({ ...p, partner_league_ids: p.partner_league_ids.includes(id) ? p.partner_league_ids.filter((x: string) => x !== id) : [...p.partner_league_ids, id] }));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="size-4" /> Novo evento</Button></div>
      <div className="space-y-3">
        {events.map((e) => (
          <EventManageCard
            key={e.id}
            event={e}
            expanded={expanded === e.id}
            onExpand={() => setExpanded(expanded === e.id ? null : e.id)}
            onToggle={toggleField}
            onEdit={() => openEdit(e)}
            onDelete={() => del(e.id)}
          />
        ))}
        {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento criado ainda.</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><Label>Data do evento</Label><Input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></div>
            <div><Label>Cronograma do evento</Label><Textarea rows={5} placeholder="Programação detalhada: horários, palestras, atividades..." value={f.schedule} onChange={(e) => setF({ ...f, schedule: e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Visível para inscritos no painel do inscrito.</p></div>
            <div><Label>Imagem (URL)</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Valor Ligante (R$)</Label><Input type="number" step="0.01" min="0" value={f.price_ligante} onChange={(e) => setF({ ...f, price_ligante: +e.target.value })} /></div>
              <div><Label className="text-xs">Valor Liga Parceira (R$)</Label><Input type="number" step="0.01" min="0" value={f.price_partner} onChange={(e) => setF({ ...f, price_partner: +e.target.value })} /></div>
              <div><Label className="text-xs">Valor Não Ligante (R$)</Label><Input type="number" step="0.01" min="0" value={f.price_visitor} onChange={(e) => setF({ ...f, price_visitor: +e.target.value })} /></div>
            </div>
            <div><Label>Número de vagas (0 = ilimitado)</Label><Input type="number" min="0" value={f.max_seats} onChange={(e) => setF({ ...f, max_seats: +e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Quando preenchidas, novos inscritos serão bloqueados automaticamente.</p></div>
            <div>
              <Label>Ligas parceiras (recebem o valor de parceiro)</Label>
              <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1 mt-1">
                {allLeagues.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma outra liga cadastrada.</p>}
                {allLeagues.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={f.partner_league_ids.includes(l.id)} onChange={() => togglePartner(l.id)} />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter><Button type="submit">{editing ? "Salvar alterações" : "Criar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventManageCard({ event, expanded, onExpand, onToggle, onEdit, onDelete }: any) {
  const [regs, setRegs] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [mcOpen, setMcOpen] = useState(false);

  useEffect(() => {
    if (!expanded || regs !== null) return;
    (async () => {
      const { data: rs } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });
      const list = rs ?? [];
      const uids = Array.from(new Set(list.map((r: any) => r.user_id)));
      let profMap: Record<string, any> = {};
      if (uids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,email,phone")
          .in("id", uids);
        (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
      }
      setRegs(list.map((r: any) => ({ ...r, profiles: profMap[r.user_id] ?? null })));
    })();
  }, [expanded]);

  const paidRegs = (regs ?? []).filter(r => r.status === "paid");
  const counts = { ligante: 0, partner: 0, visitor: 0 };
  let total = 0;
  paidRegs.forEach(r => { counts[r.category as keyof typeof counts] = (counts[r.category as keyof typeof counts] ?? 0) + 1; total += Number(r.paid_price) || 0; });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-3">
          {event.image_url && <img src={event.image_url} className="size-16 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <h4 className="font-black">{event.title}</h4>
            {event.event_date && <p className="text-xs text-muted-foreground">{new Date(event.event_date).toLocaleDateString("pt-BR")}</p>}
            <div className="text-[11px] text-muted-foreground mt-1">L: R${Number(event.price_ligante).toFixed(2)} · P: R${Number(event.price_partner).toFixed(2)} · V: R${Number(event.price_visitor).toFixed(2)}</div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>
            <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="size-3" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <label className="flex items-center justify-between gap-2 text-xs p-2 rounded border">
            <span>Publicado</span>
            <Switch checked={!!event.published} onCheckedChange={(v) => onToggle(event.id, "published", v)} />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs p-2 rounded border">
            <span>Aceitar inscrições</span>
            <Switch checked={!!event.accepting_registrations} onCheckedChange={(v) => onToggle(event.id, "accepting_registrations", v)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" className="w-full" onClick={() => setMcOpen(true)}>
            <BookOpen className="size-3 mr-1" /> Minicursos
          </Button>
          <Button size="sm" variant="ghost" className="w-full" onClick={onExpand}>
            {expanded ? "Esconder inscritos" : "Inscritos / Arrecadação"}
          </Button>
        </div>
        {expanded && (
          <div className="pt-3 border-t space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded bg-muted"><div className="text-xs text-muted-foreground">Ligantes</div><div className="font-black">{counts.ligante}</div></div>
              <div className="p-2 rounded bg-muted"><div className="text-xs text-muted-foreground">Parceiros</div><div className="font-black">{counts.partner}</div></div>
              <div className="p-2 rounded bg-muted"><div className="text-xs text-muted-foreground">Visitantes</div><div className="font-black">{counts.visitor}</div></div>
              <div className="p-2 rounded bg-primary/10"><div className="text-xs text-muted-foreground">Arrecadado</div><div className="font-black">R$ {total.toFixed(2)}</div></div>
            </div>
            {regs === null ? <p className="text-xs text-muted-foreground">Carregando inscritos...</p> :
              regs.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum inscrito ainda.</p> : (
                <div className="space-y-1">
                  {regs.map(r => (
                    <button key={r.id} onClick={() => setSelected(r)} className="w-full text-left p-2 rounded border hover:bg-accent flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate">{r.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.profiles?.email}</div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <Badge variant={r.status === "paid" ? "default" : "secondary"} className="text-[10px]">{r.status === "paid" ? "Pago" : "Pendente"}</Badge>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{r.category} · R${Number(r.paid_price).toFixed(2)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
          </div>
        )}
      </CardContent>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inscrição</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <Row k="Nome completo" v={selected.full_name} />
              {selected.social_name && <Row k="Nome social" v={selected.social_name} />}
              <Row k="CPF" v={selected.cpf} />
              <Row k="Curso" v={selected.course} />
              <Row k="Email" v={selected.profiles?.email ?? "—"} />
              <Row k="Telefone" v={selected.profiles?.phone ?? "—"} />
              <Row k="Categoria" v={selected.category} />
              <Row k="Valor pago" v={`R$ ${Number(selected.paid_price).toFixed(2)}`} />
              {selected.discount_reason && <Row k="Desconto" v={selected.discount_reason} />}
              <Row k="Status" v={selected.status} />
              <Row k="Inscrito em" v={new Date(selected.created_at).toLocaleString("pt-BR")} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <MinicoursesManager event={event} open={mcOpen} onClose={() => setMcOpen(false)} />
    </Card>
  );
}

function MinicoursesManager({ event, open, onClose }: { event: any; open: boolean; onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [regsByMc, setRegsByMc] = useState<Record<string, any[]>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const blank = { title: "", instructor: "", starts_at: "", location: "", description: "", is_free: true, price: 0, max_registrations: 20, published: false };
  const [f, setF] = useState<any>(blank);

  async function reload() {
    const { data } = await supabase.from("league_minicourses").select("*").eq("event_id", event.id).order("starts_at", { ascending: true });
    setList(data ?? []);
    const ids = (data ?? []).map((m: any) => m.id);
    if (ids.length === 0) { setRegsByMc({}); return; }
    const { data: regs } = await supabase.from("minicourse_registrations").select("*").in("minicourse_id", ids);
    const uids = Array.from(new Set((regs ?? []).map((r: any) => r.user_id)));
    let profMap: Record<string, any> = {};
    if (uids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,username,email,phone,full_name").in("id", uids);
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
    }
    const grouped: Record<string, any[]> = {};
    (regs ?? []).forEach((r: any) => {
      (grouped[r.minicourse_id] ||= []).push({ ...r, profile: profMap[r.user_id] ?? null });
    });
    setRegsByMc(grouped);
  }
  useEffect(() => { if (open) reload(); }, [open, event.id]);

  function openNew() { setEditing(null); setF(blank); setFormOpen(true); }
  function openEdit(mc: any) {
    setEditing(mc);
    setF({
      title: mc.title, instructor: mc.instructor,
      starts_at: mc.starts_at ? new Date(mc.starts_at).toISOString().slice(0, 16) : "",
      location: mc.location ?? "", description: mc.description ?? "",
      is_free: !!mc.is_free, price: Number(mc.price) || 0,
      max_registrations: Number(mc.max_registrations) || 20,
      published: !!mc.published,
    });
    setFormOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.starts_at) return toast.error("Informe data e hora");
    const payload: any = {
      event_id: event.id,
      title: f.title, instructor: f.instructor,
      starts_at: new Date(f.starts_at).toISOString(),
      location: f.location || null, description: f.description || null,
      is_free: !!f.is_free, price: f.is_free ? 0 : Number(f.price) || 0,
      max_registrations: Math.max(1, Number(f.max_registrations) || 1),
      published: !!f.published,
    };
    const { error } = editing
      ? await supabase.from("league_minicourses").update(payload).eq("id", editing.id)
      : await supabase.from("league_minicourses").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Atualizado" : "Criado"); setFormOpen(false); reload();
  }
  async function del(id: string) {
    if (!confirm("Excluir este minicurso? As inscrições serão removidas.")) return;
    await supabase.from("minicourse_registrations").delete().eq("minicourse_id", id);
    await supabase.from("league_minicourses").delete().eq("id", id);
    reload();
  }
  async function togglePublished(mc: any) {
    const { error } = await supabase.from("league_minicourses").update({ published: !mc.published }).eq("id", mc.id);
    if (error) return toast.error(error.message);
    setList(prev => prev.map(m => m.id === mc.id ? { ...m, published: !mc.published } : m));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Minicursos · {event.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={openNew}><Plus className="size-4" /> Novo minicurso</Button>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum minicurso ainda. Crie um para liberar inscrição aos participantes do evento.</p>
          ) : (
            <div className="space-y-2">
              {list.map((mc) => {
                const regs = regsByMc[mc.id] ?? [];
                const paidCount = regs.filter(r => r.status === "paid").length;
                const cap = Number(mc.max_registrations) || 0;
                const pct = cap ? Math.min(100, Math.round((paidCount / cap) * 100)) : 0;
                return (
                  <Card key={mc.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-black truncate">{mc.title}</h5>
                            <Badge variant={mc.is_free ? "secondary" : "default"} className="text-[10px]">{mc.is_free ? "Gratuito" : `R$ ${Number(mc.price).toFixed(2)}`}</Badge>
                            {!mc.published && <Badge variant="outline" className="text-[10px]">Rascunho</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{mc.instructor} · {new Date(mc.starts_at).toLocaleString("pt-BR")}</p>
                          {mc.location && <p className="text-[11px] text-muted-foreground">📍 {mc.location}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => openEdit(mc)}>Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => del(mc.id)}><Trash2 className="size-3" /></Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch checked={!!mc.published} onCheckedChange={() => togglePublished(mc)} />
                          Publicado
                        </label>
                        <button onClick={() => setViewing(mc)} className="text-xs underline text-muted-foreground">
                          {paidCount}/{cap} inscritos ({pct}%)
                        </button>
                      </div>
                      <div className="h-1 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar minicurso" : "Novo minicurso"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Lecionador</Label><Input required value={f.instructor} onChange={(e) => setF({ ...f, instructor: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Data e hora</Label><Input type="datetime-local" required value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
              <div><Label>Vagas (máx.)</Label><Input type="number" min="1" required value={f.max_registrations} onChange={(e) => setF({ ...f, max_registrations: +e.target.value })} /></div>
            </div>
            <div><Label>Local</Label><Input placeholder="Sala, prédio, link..." value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="flex items-center justify-between gap-2 p-3 rounded border">
              <div>
                <Label className="cursor-pointer">Gratuito</Label>
                <p className="text-[11px] text-muted-foreground">Se desativado, exigirá pagamento.</p>
              </div>
              <Switch checked={f.is_free} onCheckedChange={(v) => setF({ ...f, is_free: v })} />
            </div>
            {!f.is_free && (
              <div><Label>Valor adicional (R$)</Label><Input type="number" step="0.01" min="0.50" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Mínimo R$ 0,50 (limite do gateway).</p></div>
            )}
            <label className="flex items-center justify-between gap-2 p-3 rounded border">
              <div>
                <span className="text-sm font-medium">Publicar imediatamente</span>
                <p className="text-[11px] text-muted-foreground">Quando publicado, aparece para inscritos no evento.</p>
              </div>
              <Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} />
            </label>
            <DialogFooter><Button type="submit">{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Inscritos · {viewing?.title}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-1">
              {(regsByMc[viewing.id] ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum inscrito ainda.</p>}
              {(regsByMc[viewing.id] ?? []).map((r) => (
                <div key={r.id} className="p-2 rounded border flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{r.profile?.full_name ?? r.profile?.username ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.profile?.email}</div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <Badge variant={r.status === "paid" ? "default" : "secondary"} className="text-[10px]">{r.status === "paid" ? "Confirmado" : "Pendente"}</Badge>
                    <span className="text-[10px] text-muted-foreground mt-0.5">R$ {Number(r.paid_price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 border-b py-1.5"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}

function NewsTab({ league }: any) {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", excerpt: "", image_url: "", category: "Geral", link: "" });
  const reload = async () => {
    const { data } = await supabase.from("league_news").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("league_news").insert({ ...f, league_id: league.id, image_url: f.image_url || null, link: f.link || null });
    if (error) return toast.error(error.message);
    toast.success("Publicado"); setOpen(false); setF({ title: "", excerpt: "", image_url: "", category: "Geral", link: "" }); reload();
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

function ActivitiesTab({ league }: any) {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ image_url: "", caption: "" });
  const reload = async () => {
    const { data } = await supabase.from("league_activities").select("*").eq("league_id", league.id).order("display_order");
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.image_url) return toast.error("Imagem obrigatória");
    const { error } = await supabase.from("league_activities").insert({ ...f, league_id: league.id, display_order: list.length });
    if (error) return toast.error(error.message);
    setF({ image_url: "", caption: "" }); reload();
  }
  async function del(id: string) { await supabase.from("league_activities").delete().eq("id", id); reload(); }
  return (
    <Card><CardContent className="p-6 space-y-4">
      <form onSubmit={add} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <Input placeholder="URL da imagem" value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} />
        <Input placeholder="Legenda (opcional)" value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} />
        <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
      </form>
      <div className="grid sm:grid-cols-3 gap-3">
        {list.map((a) => (
          <Card key={a.id} className="overflow-hidden relative group">
            <img src={a.image_url} className="aspect-video w-full object-cover" />
            {a.caption && <p className="text-xs p-2 text-muted-foreground">{a.caption}</p>}
            <Button size="sm" variant="destructive" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => del(a.id)}><Trash2 className="size-3" /></Button>
          </Card>
        ))}
      </div>
    </CardContent></Card>
  );
}

function QuizTab({ league }: any) {
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
    const { data } = await supabase.from("league_quizzes").select("*").eq("quiz_set_id", openSet!).order("display_order");
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

function MembersTab({ league }: any) {
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ligante" | "diretor">("ligante");
  const [selOpen, setSelOpen] = useState(false);
  const [semOpen, setSemOpen] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const listPays = useServerFn(listCyclePayments);

  const reload = async () => {
    const { data } = await supabase.from("league_memberships").select("*, profiles!inner(username,email,full_name,registration_number)").eq("league_id", league.id);
    setMembers(data ?? []);
    try {
      const r = await listPays({ data: { league_id: league.id } });
      const map: Record<string, string> = {};
      (r.payments ?? []).forEach((p: any) => { map[p.user_id] = p.status; });
      setStatusMap(map);
    } catch { /* sem ciclo ainda */ }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [league.id]);
  async function add() {
    if (!query.trim()) return;
    const q = query.trim();
    const { data: prof } = await supabase.from("profiles").select("id").or(`email.ilike.${q},username.ilike.${q}`).maybeSingle();
    if (!prof?.id) return toast.error("Usuário não existe");
    const { error } = await supabase.from("league_memberships").upsert({ league_id: league.id, user_id: prof.id, role }, { onConflict: "league_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("Adicionado"); setQuery(""); reload();
  }
  async function remove(id: string) { await supabase.from("league_memberships").delete().eq("id", id); reload(); }
  return (
    <Card><CardContent className="p-6 space-y-4">
      <LeaveRequestsPanel league={league} onProcessed={reload} />
      <div className="flex justify-end gap-2 flex-wrap">
        <Button onClick={() => setSemOpen(true)} variant="outline"><DollarSign className="size-4" /> Semestralidade</Button>
        <Button onClick={() => setSelOpen(true)} variant="outline"><ClipboardCheck className="size-4" /> Processo Seletivo</Button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input className="flex-1 min-w-[200px]" placeholder="Email ou usuário" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="px-3 rounded border bg-background" value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="ligante">Ligante</option><option value="diretor">Diretor</option>
        </select>
        <Button onClick={add}>Adicionar</Button>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 rounded border gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold">{m.profiles?.full_name || m.profiles?.username}</span>
              <Badge variant="secondary">{m.role}</Badge>
              {m.profiles?.registration_number && <span className="text-xs text-muted-foreground">Mat. {m.profiles.registration_number}</span>}
              {["ligante","diretor"].includes(m.role) && statusMap[m.user_id] && (
                <SemesterStatusBadge status={statusMap[m.user_id]} />
              )}
            </div>
            {m.role !== "presidente" && <Button size="sm" variant="destructive" onClick={() => remove(m.id)}><Trash2 className="size-3" /></Button>}
          </div>
        ))}
      </div>
      <SelectionManagerDialog league={league} open={selOpen} onClose={() => setSelOpen(false)} />
      <SemesterDialog league={league} open={semOpen} onClose={() => setSemOpen(false)} onUpdated={reload} />
    </CardContent></Card>
  );
}

function LeaveRequestsPanel({ league, onProcessed }: { league: any; onProcessed: () => void }) {
  const listFn = useServerFn(listLeagueLeaveRequests);
  const processFn = useServerFn(processLeaveRequest);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    try {
      const r: any = await listFn({ data: { league_id: league.id } });
      setItems(r?.requests ?? []);
    } catch { setItems([]); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [league.id]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      await processFn({ data: { request_id: id, action } } as any);
      toast.success(action === "approve" ? "Desistência aprovada" : "Pedido rejeitado");
      await reload();
      onProcessed();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(null); }
  }

  if (items.length === 0) return null;
  return (
    <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/5 space-y-3">
      <div className="font-black text-amber-700 dark:text-amber-400 flex items-center gap-2">
        <Bell className="size-4" /> Pedidos de desistência ({items.length})
      </div>
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="p-3 rounded border bg-background flex items-start justify-between gap-3 flex-wrap">
            <div className="text-sm flex-1 min-w-[200px]">
              <div className="font-bold">{r.profile?.full_name || r.profile?.username || "Ligante"}</div>
              <div className="text-xs text-muted-foreground">
                {r.profile?.email}{r.profile?.cpf ? ` · CPF ${r.profile.cpf}` : ""}{r.profile?.registration_number ? ` · Matrícula ${r.profile.registration_number}` : ""}
              </div>
              {r.reason && <div className="text-xs mt-1 italic">"{r.reason}"</div>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "reject")}>Rejeitar</Button>
              <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>Aprovar desistência</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
