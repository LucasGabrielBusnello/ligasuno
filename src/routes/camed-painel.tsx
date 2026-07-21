import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit, Users as UsersIcon, Settings as SettingsIcon, Building2, AlertTriangle, Mail, MessageSquare, Calendar as CalIcon, Clock, Eye, Phone, Video, MapPin, History, Trophy, Medal, Crown, ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "@/components/image-upload";
import { useServerFn } from "@tanstack/react-start";
import { deleteStorageFiles } from "@/lib/storage-delete.functions";

export const Route = createFileRoute("/camed-painel")({ component: CamedPage });

function CamedPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [isPresident, setIsPresident] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (!profile?.email) return;
    supabase.from("camed_presidents").select("id").ilike("email", profile.email).maybeSingle()
      .then(({ data }) => setIsPresident(!!data));
  }, [loading, user, profile]);

  if (loading || isPresident === null) return <div className="p-12 text-center">Carregando...</div>;
  if (!isPresident) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="text-2xl font-black">Acesso negado</h1>
      <p className="text-muted-foreground mt-2">Apenas presidentes do CAMED têm acesso a esta área.</p>
      <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Início</Link>
          <Badge className="bg-gradient-to-r from-primary to-accent"><Building2 className="size-3 mr-1" /> CAMED</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do CAMED</h1>
        <p className="text-muted-foreground mb-6">Gerencie informações, membros e configurações de ligas.</p>
        <MultiLeagueAlert />
        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full h-auto">
            <TabsTrigger value="info" className="py-2"><SettingsIcon className="size-4 mr-1.5" />Info</TabsTrigger>
            <TabsTrigger value="membros" className="py-2"><UsersIcon className="size-4 mr-1.5" />Membros</TabsTrigger>
            <TabsTrigger value="noticias" className="py-2"><Newspaper className="size-4 mr-1.5" />Notícias</TabsTrigger>
            <TabsTrigger value="ligas" className="py-2"><Building2 className="size-4 mr-1.5" />Ligas</TabsTrigger>
            <TabsTrigger value="mensagens" className="py-2"><MessageSquare className="size-4 mr-1.5" />Mensagens</TabsTrigger>
            <TabsTrigger value="horarios" className="py-2"><CalIcon className="size-4 mr-1.5" />Horários</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-6"><InfoTab /></TabsContent>
          <TabsContent value="membros" className="mt-6"><MembersTab /></TabsContent>
          <TabsContent value="noticias" className="mt-6"><NewsTab /></TabsContent>
          <TabsContent value="ligas" className="mt-6"><LeaguesSettingsTab /></TabsContent>
          <TabsContent value="mensagens" className="mt-6"><MessagesTab /></TabsContent>
          <TabsContent value="horarios" className="mt-6"><SlotsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function InfoTab() {
  const [info, setInfo] = useState<any>({ title: "", subtitle: "", description: "", email: "" });
  useEffect(() => { supabase.from("camed_info").select("*").eq("id", 1).maybeSingle().then(({ data }) => data && setInfo({ ...data, email: (data as any).email ?? "" })); }, []);
  async function save() {
    const email = info.email?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("E-mail inválido");
    const { error } = await supabase.from("camed_info").update({ title: info.title, subtitle: info.subtitle, description: info.description, email }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Informações atualizadas");
  }
  return (
    <Card><CardHeader><CardTitle>Informações do CAMED</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Título</Label><Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} /></div>
        <div><Label>Subtítulo</Label><Input value={info.subtitle} onChange={(e) => setInfo({ ...info, subtitle: e.target.value })} /></div>
        <div><Label>Descrição</Label><Textarea rows={6} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} /></div>
        <div>
          <Label className="flex items-center gap-1.5"><Mail className="size-4" /> E-mail do CAMED</Label>
          <Input type="email" placeholder="camed@exemplo.com" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
          <p className="text-xs text-muted-foreground mt-1">Para onde o LIGASUNO envia mensagens anônimas e notificações de agendamento.</p>
        </div>
        <Button onClick={save}>Salvar</Button>
      </CardContent>
    </Card>
  );
}

function MessagesTab() {
  const [items, setItems] = useState<any[]>([]);
  async function reload() {
    const { data } = await supabase.from("camed_messages").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { reload(); }, []);
  async function del(id: string) {
    if (!confirm("Excluir mensagem?")) return;
    await supabase.from("camed_messages").delete().eq("id", id);
    reload();
  }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="size-5" /> Mensagens anônimas recebidas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
        {items.map((m) => (
          <div key={m.id} className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/30 dark:to-background p-4">
            <div className="flex justify-between items-center mb-2">
              <Badge variant="secondary" className="text-[10px]">{new Date(m.created_at).toLocaleString("pt-BR")}</Badge>
              <Button size="sm" variant="ghost" onClick={() => del(m.id)}><Trash2 className="size-3.5" /></Button>
            </div>
            <p className="text-sm whitespace-pre-wrap italic text-emerald-900 dark:text-emerald-100">“{m.message}”</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SlotsTab() {
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Record<string, any>>({});
  const [open, setOpen] = useState(false);
  const [viewBooking, setViewBooking] = useState<any | null>(null);
  const [f, setF] = useState({ date: "", time: "", allow_online: true, allow_in_person: true, attendant_name: "" });

  async function reload() {
    const { data } = await supabase.from("camed_slots").select("*").order("slot_at");
    setSlots(data ?? []);
    const { data: bks } = await supabase.from("camed_bookings").select("*");
    const userIds = Array.from(new Set((bks ?? []).map((b: any) => b.user_id).filter(Boolean)));
    const profMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, username, email").in("id", userIds);
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
    }
    const m: Record<string, any> = {};
    (bks ?? []).forEach((b: any) => { m[b.slot_id] = { ...b, profiles: profMap[b.user_id] ?? null }; });
    setBookings(m);
  }
  useEffect(() => { reload(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.date || !f.time) return toast.error("Defina data e horário");
    if (!f.allow_online && !f.allow_in_person) return toast.error("Selecione ao menos uma modalidade");
    const dt = new Date(`${f.date}T${f.time}:00`);
    const { error } = await supabase.from("camed_slots").insert({
      slot_at: dt.toISOString(),
      allow_online: f.allow_online,
      allow_in_person: f.allow_in_person,
      attendant_name: f.attendant_name || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Horário criado");
    setOpen(false);
    setF({ date: "", time: "", allow_online: true, allow_in_person: true, attendant_name: "" });
    reload();
  }

  async function del(id: string) {
    if (!confirm("Excluir este horário? Eventual agendamento também será removido.")) return;
    await supabase.from("camed_slots").delete().eq("id", id);
    reload();
  }

  const upcoming = slots.filter((s) => new Date(s.slot_at) > new Date());
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><CalIcon className="size-5" /> Horários semanais</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Novo horário</Button>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário cadastrado. Use "Novo horário" para abrir slots da semana.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {upcoming.map((s) => {
              const bk = bookings[s.id];
              const dt = new Date(s.slot_at);
              return (
                <div key={s.id} className={`rounded-xl border p-4 ${bk ? "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20" : "border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={bk ? "bg-amber-500" : "bg-emerald-500"}>{bk ? "Agendado" : "Disponível"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => del(s.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                  <div className="mt-2 font-black">{dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock className="size-3.5" /> {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {s.allow_online && <Badge variant="outline" className="text-[10px]"><Video className="size-3 mr-1" />Online</Badge>}
                    {s.allow_in_person && <Badge variant="outline" className="text-[10px]"><MapPin className="size-3 mr-1" />Presencial</Badge>}
                  </div>
                  {s.attendant_name && <div className="text-xs text-muted-foreground mt-2">Atendente: <b>{s.attendant_name}</b></div>}
                  {bk && (
                    <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => setViewBooking({ ...bk, slot: s })}><Eye className="size-3.5" /> Ver informações</Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo horário</DialogTitle></DialogHeader>
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-100">
            ℹ️ Os horários são resetados toda semana às <b>20h de sábado</b>. Horários devem ser marcados com pelo menos <b>24 horas de antecedência</b>.
          </div>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              <div><Label>Horário</Label><Input type="time" required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
            </div>
            <div className="space-y-2 p-3 rounded-lg border">
              <Label>Modalidades aceitas</Label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_online} onCheckedChange={(v) => setF({ ...f, allow_online: !!v })} /> <Video className="size-4" /> Online</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_in_person} onCheckedChange={(v) => setF({ ...f, allow_in_person: !!v })} /> <MapPin className="size-4" /> Presencial</label>
            </div>
            <div>
              <Label>Quem irá atender (opcional)</Label>
              <Input placeholder="Ex.: João Silva (Presidente)" value={f.attendant_name} onChange={(e) => setF({ ...f, attendant_name: e.target.value })} />
            </div>
            <DialogFooter><Button type="submit">Criar horário</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do agendamento</DialogTitle></DialogHeader>
          {viewBooking && (
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-muted">
                <div className="font-black">{new Date(viewBooking.slot.slot_at).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}</div>
                <Badge variant="secondary" className="mt-1">{viewBooking.modality === "online" ? "Online" : "Presencial"}</Badge>
              </div>
              <div><b>Quem marcou:</b> {viewBooking.profiles?.full_name || viewBooking.profiles?.username || "—"}<br /><span className="text-muted-foreground text-xs">{viewBooking.profiles?.email}</span></div>
              <div><b>Motivo:</b> <p className="text-muted-foreground">{viewBooking.reason}</p></div>
              {viewBooking.extra_participants && <div><b>Outros participantes:</b> <p className="text-muted-foreground">{viewBooking.extra_participants}</p></div>}
              <div>
                <b>WhatsApp:</b> {viewBooking.phone}{" "}
                <Button asChild size="sm" variant="outline" className="ml-2">
                  <a href={`https://wa.me/${viewBooking.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Phone className="size-3.5" /> Abrir</a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersTab() {
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const blank = { name: "", role: "", description: "", image_url: "", display_order: 0 };
  const [f, setF] = useState<any>(blank);
  async function reload() {
    const { data } = await supabase.from("camed_members").select("*").order("display_order");
    setMembers(data ?? []);
  }
  useEffect(() => { reload(); }, []);
  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(m: any) { setEditing(m); setF({ ...m, image_url: m.image_url ?? "", description: m.description ?? "" }); setOpen(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, image_url: f.image_url || null };
    const { error } = editing
      ? await supabase.from("camed_members").update(payload).eq("id", editing.id)
      : await supabase.from("camed_members").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setOpen(false); reload();
  }
  const deleteFiles = useServerFn(deleteStorageFiles);
  async function del(id: string) {
    if (!confirm("Excluir membro?")) return;
    const m = members.find((x: any) => x.id === id);
    const { error } = await supabase.from("camed_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (m?.image_url) { try { await deleteFiles({ data: { paths: [m.image_url] } }); } catch {} }
    reload();
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Membros</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> Novo</Button>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="aspect-square rounded-lg bg-muted mb-3 overflow-hidden">
                  {m.image_url && <img src={m.image_url} className="w-full h-full object-cover" />}
                </div>
                <Badge variant="secondary">{m.role}</Badge>
                <h4 className="font-black mt-2">{m.name}</h4>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}><Edit className="size-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => del(m.id)}><Trash2 className="size-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar membro" : "Novo membro"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input required value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><ImageUpload label="Imagem" folder="camed-members" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: +e.target.value })} /></div>
            <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function LeaguesSettingsTab() {
  const [s, setS] = useState({ league_registration_fee: 0, semestrality_fee: 0 });
  const [leagues, setLeagues] = useState<any[]>([]);
  const [pointsByLeague, setPointsByLeague] = useState<Record<string, any[]>>({});
  const [presidents, setPresidents] = useState<Record<string, any>>({});
  const [addOpen, setAddOpen] = useState<any | null>(null);
  const [histOpen, setHistOpen] = useState<Record<string, boolean>>({});
  const [addF, setAddF] = useState({ points: 0, description: "" });

  async function loadSettings() {
    const { data } = await supabase.from("camed_settings").select("*").eq("id", 1).maybeSingle();
    if (data) setS({ league_registration_fee: Number((data as any).league_registration_fee) || 0, semestrality_fee: Number((data as any).semestrality_fee) || 0 });
  }
  async function loadLeagues() {
    const { data: lg } = await supabase.from("leagues").select("id, name, slug, theme_color, icon_url, president_id");
    setLeagues(lg ?? []);
    const ids = (lg ?? []).map((l: any) => l.president_id).filter(Boolean);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, full_name, email").in("id", ids);
      const pm: Record<string, any> = {}; (profs ?? []).forEach((p: any) => pm[p.id] = p);
      setPresidents(pm);
    }
    const { data: pts } = await supabase.from("league_points").select("*").order("created_at", { ascending: false });
    const map: Record<string, any[]> = {};
    (pts ?? []).forEach((p: any) => { (map[p.league_id] ||= []).push(p); });
    setPointsByLeague(map);
  }
  useEffect(() => { loadSettings(); loadLeagues(); }, []);

  async function saveSettings() {
    const { error } = await supabase.from("camed_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  }

  async function addPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!addOpen) return;
    if (!addF.description.trim()) return toast.error("Informe uma descrição");
    if (!addF.points) return toast.error("Informe quantos pontos");
    const { error } = await supabase.from("league_points").insert({ league_id: addOpen.id, points: addF.points, description: addF.description.trim() });
    if (error) return toast.error(error.message);
    toast.success(`+${addF.points} pontos para ${addOpen.name}`);
    setAddOpen(null); setAddF({ points: 0, description: "" });
    loadLeagues();
  }

  async function removePoints(id: string) {
    if (!confirm("Remover esta pontuação? Os pontos serão descontados.")) return;
    const { error } = await supabase.from("league_points").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadLeagues();
  }

  const ranked = leagues
    .map((l) => ({ ...l, total: (pointsByLeague[l.id] ?? []).reduce((sum, p) => sum + p.points, 0) }))
    .sort((a, b) => b.total - a.total);

  function rankStyle(pos: number) {
    if (pos === 0) return { border: "border-yellow-400/70", bg: "bg-gradient-to-br from-yellow-50 to-amber-100/40 dark:from-yellow-950/40 dark:to-amber-900/20", icon: <Crown className="size-5 text-yellow-600" />, badge: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white" };
    if (pos === 1) return { border: "border-slate-400/70", bg: "bg-gradient-to-br from-slate-50 to-zinc-100/40 dark:from-slate-900/40 dark:to-zinc-800/20", icon: <Medal className="size-5 text-slate-500" />, badge: "bg-gradient-to-r from-slate-400 to-zinc-400 text-white" };
    if (pos === 2) return { border: "border-orange-400/70", bg: "bg-gradient-to-br from-orange-50 to-amber-100/40 dark:from-orange-950/40 dark:to-amber-900/20", icon: <Trophy className="size-5 text-orange-600" />, badge: "bg-gradient-to-r from-orange-500 to-amber-600 text-white" };
    return { border: "border-border", bg: "bg-card", icon: <Building2 className="size-5 text-muted-foreground" />, badge: "bg-muted text-foreground" };
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="size-5 text-yellow-600" /> Classificação das Ligas</CardTitle>
          <p className="text-sm text-muted-foreground">Ordenadas pela pontuação total atribuída pelo CAMED.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {ranked.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma liga cadastrada ainda.</p>}
          {ranked.map((l, idx) => {
            const st = rankStyle(idx);
            const pres = l.president_id ? presidents[l.president_id] : null;
            const history = pointsByLeague[l.id] ?? [];
            const open = !!histOpen[l.id];
            return (
              <div key={l.id} className={`rounded-2xl border-2 ${st.border} ${st.bg} overflow-hidden transition-all`}>
                <div className="p-4 flex items-center gap-3 flex-wrap">
                  <div className={`flex items-center justify-center size-12 rounded-xl font-black text-lg ${st.badge}`}>
                    {idx + 1}°
                  </div>
                  <div className="size-12 rounded-xl flex items-center justify-center text-white font-black overflow-hidden shrink-0" style={{ background: l.theme_color }}>
                    {l.icon_url ? <img src={l.icon_url} className="size-full object-cover" /> : l.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      {st.icon}
                      <h4 className="font-black text-base sm:text-lg">{l.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Presidente: <span className="font-semibold text-foreground">{pres?.full_name || pres?.username || "—"}</span></p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black tabular-nums">{l.total}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pontos</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => { setAddOpen(l); setAddF({ points: 0, description: "" }); }}><Plus className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setHistOpen((p) => ({ ...p, [l.id]: !p[l.id] }))}>
                      <History className="size-4" /> {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </Button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-border/50 bg-background/60 p-4 space-y-2">
                    <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Histórico de pontuação</div>
                    {history.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhuma pontuação atribuída ainda.</p>}
                    {history.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{h.description}</div>
                          <div className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                        </div>
                        <Badge className={h.points >= 0 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                          {h.points >= 0 ? "+" : ""}{h.points}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => removePoints(h.id)}><Trash2 className="size-3.5 text-rose-600" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!addOpen} onOpenChange={(o) => !o && setAddOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar pontos — {addOpen?.name}</DialogTitle></DialogHeader>
          <form onSubmit={addPoints} className="space-y-3">
            <div>
              <Label>Pontos a adicionar</Label>
              <Input type="number" required value={addF.points} onChange={(e) => setAddF({ ...addF, points: +e.target.value })} placeholder="Use número negativo para descontar" />
              <p className="text-xs text-muted-foreground mt-1">Use número negativo para descontar pontos.</p>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} required value={addF.description} onChange={(e) => setAddF({ ...addF, description: e.target.value })} placeholder="Ex.: Participação no evento X" />
            </div>
            <DialogFooter><Button type="submit">Adicionar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <details className="rounded-xl border bg-card/50">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2">
          <SettingsIcon className="size-4" /> Valores padrão das ligas
        </summary>
        <div className="p-4 pt-0 space-y-4">
          <div>
            <Label className="text-xs">Taxa de inscrição na prova de seleção (R$)</Label>
            <Input type="number" step="0.01" min="0" value={s.league_registration_fee} onChange={(e) => setS({ ...s, league_registration_fee: +e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">Valor cobrado de candidatos. Aplica-se a todas as ligas.</p>
          </div>
          <div>
            <Label className="text-xs">Semestralidade padrão (R$)</Label>
            <Input type="number" step="0.01" min="0" value={s.semestrality_fee} onChange={(e) => setS({ ...s, semestrality_fee: +e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">Valor de referência (sem cobrança automática).</p>
          </div>
          <Button size="sm" onClick={saveSettings}>Salvar valores padrão</Button>
        </div>
      </details>
    </div>
  );
}

function MultiLeagueAlert() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from("league_memberships")
        .select("user_id, league_id, role, leagues(name), profiles(full_name, username, cpf, registration_number, email)")
        .in("role", ["ligante", "diretor", "presidente"]);
      const byUser = new Map<string, any>();
      (m ?? []).forEach((row: any) => {
        const u = byUser.get(row.user_id) ?? { user_id: row.user_id, profile: row.profiles, leagues: [] };
        u.leagues.push(row.leagues?.name ?? "—");
        byUser.set(row.user_id, u);
      });
      setItems(Array.from(byUser.values()).filter((u: any) => u.leagues.length > 3));
    })();
  }, []);

  if (items.length === 0) return null;
  return (
    <>
      <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 text-amber-600" />
            <div className="text-sm">
              <div className="font-black text-amber-700 dark:text-amber-400">Existem {items.length} membro(s) em mais de 3 ligas</div>
              <div className="text-muted-foreground">Verifique a situação para garantir o cumprimento do regulamento do CAMED.</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Verificar</Button>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Membros em mais de 3 ligas</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {items.map((it: any) => (
              <div key={it.user_id} className="p-3 rounded border">
                <div className="font-bold">{it.profile?.full_name || it.profile?.username || "Membro"}</div>
                <div className="text-xs text-muted-foreground">
                  {it.profile?.email}
                  {it.profile?.cpf ? ` · CPF ${it.profile.cpf}` : ""}
                  {it.profile?.registration_number ? ` · Matrícula ${it.profile.registration_number}` : ""}
                </div>
                <div className="text-sm mt-1"><b>Ligas ({it.leagues.length}):</b> {it.leagues.join(", ")}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewsTab() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const blank = { title: "", excerpt: "", image_url: "", category: "Geral", link: "" };
  const [f, setF] = useState<any>(blank);
  const deleteFiles = useServerFn(deleteStorageFiles);
  async function reload() {
    const { data } = await supabase.from("camed_news" as any).select("*").order("created_at", { ascending: false });
    setList((data as any[]) ?? []);
  }
  useEffect(() => { reload(); }, []);
  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(n: any) { setEditing(n); setF({ title: n.title, excerpt: n.excerpt ?? "", image_url: n.image_url ?? "", category: n.category ?? "Geral", link: n.link ?? "" }); setOpen(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { title: f.title, excerpt: f.excerpt || null, image_url: f.image_url || null, category: f.category || "Geral", link: f.link || null };
    const { error } = editing
      ? await supabase.from("camed_news" as any).update(payload).eq("id", editing.id)
      : await supabase.from("camed_news" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Notícia atualizada" : "Notícia publicada");
    setOpen(false); reload();
  }
  async function del(id: string) {
    if (!confirm("Excluir notícia?")) return;
    const n = list.find((x: any) => x.id === id);
    const { error } = await supabase.from("camed_news" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (n?.image_url) { try { await deleteFiles({ data: { paths: [n.image_url] } }); } catch {} }
    reload();
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Newspaper className="size-5" /> Notícias do CAMED</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> Nova notícia</Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma notícia publicada ainda.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((n) => (
            <div key={n.id} className="rounded-xl border p-4 flex gap-3">
              {n.image_url && <img src={n.image_url} className="size-20 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{n.category ?? "Geral"}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <h4 className="font-black mt-1 truncate">{n.title}</h4>
                {n.excerpt && <p className="text-xs text-muted-foreground line-clamp-2">{n.excerpt}</p>}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(n)}><Edit className="size-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => del(n.id)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar notícia" : "Nova notícia"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
            <div><Label>Resumo</Label><Textarea rows={4} value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></div>
            <div><ImageUpload label="Imagem" folder="camed-news" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
            <div><Label>Link externo (opcional)</Label><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div>
            <DialogFooter><Button type="submit">{editing ? "Salvar" : "Publicar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
