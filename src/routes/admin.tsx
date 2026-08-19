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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit, Calendar, DollarSign, User as UserIcon, Building2, Users, Settings, Megaphone, UserCog, GraduationCap, BarChart3, BookOpen, Wrench, ScrollText } from "lucide-react";
import { CurriculumAdmin } from "@/components/curriculum-admin";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, Legend } from "recharts";

import { Switch } from "@/components/ui/switch";
import { useServerFn } from "@tanstack/react-start";
import { deleteLeagueWithCancel, cancelLeagueSubscription } from "@/lib/subscription.functions";
import { ImageUpload } from "@/components/image-upload";
import { deleteStorageFiles } from "@/lib/storage-delete.functions";
import { LOG_CATEGORY_LABEL } from "@/lib/activity-log";
import { listUsersAdmin, updateUserAdmin } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isAdminMaster, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdminMaster)) nav({ to: "/" });
  }, [loading, user, isAdminMaster]);

  if (loading || !isAdminMaster) return <div className="p-12 text-center">Carregando...</div>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Início</Link>
          <Badge className="bg-gradient-to-r from-primary to-accent">ADMIN MASTER</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-8">Painel ADMIN</h1>
        <Tabs defaultValue="ligas">
          <div className="w-full overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
            <TabsList className="inline-flex md:grid md:grid-cols-10 w-max md:w-full h-auto gap-1">
              <TabsTrigger value="ligas" className="whitespace-nowrap"><Building2 className="size-4 mr-1.5" />Ligas</TabsTrigger>
              <TabsTrigger value="camed" className="whitespace-nowrap"><Users className="size-4 mr-1.5" />CAMED</TabsTrigger>
              <TabsTrigger value="coord" className="whitespace-nowrap"><UserCog className="size-4 mr-1.5" />Coordenação</TabsTrigger>
              <TabsTrigger value="curriculo" className="whitespace-nowrap"><BookOpen className="size-4 mr-1.5" />Currículo</TabsTrigger>
              <TabsTrigger value="ads" className="whitespace-nowrap"><Megaphone className="size-4 mr-1.5" />Anúncios</TabsTrigger>
              <TabsTrigger value="logs" className="whitespace-nowrap"><ScrollText className="size-4 mr-1.5" />Logs</TabsTrigger>
              <TabsTrigger value="visitas" className="whitespace-nowrap"><BarChart3 className="size-4 mr-1.5" />Visitas</TabsTrigger>
              <TabsTrigger value="usuarios" className="whitespace-nowrap"><UserIcon className="size-4 mr-1.5" />Usuários</TabsTrigger>
              <TabsTrigger value="manutencao" className="whitespace-nowrap"><Wrench className="size-4 mr-1.5" />Manutenção</TabsTrigger>
              <TabsTrigger value="config" className="whitespace-nowrap"><Settings className="size-4 mr-1.5" />Configurações</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="ligas" className="mt-6"><LeaguesAdmin /></TabsContent>
          <TabsContent value="camed" className="mt-6"><CamedAdmin /></TabsContent>
          <TabsContent value="coord" className="mt-6"><CoordinationAdmin /></TabsContent>
          <TabsContent value="curriculo" className="mt-6"><CurriculumAdmin /></TabsContent>
          <TabsContent value="ads" className="mt-6"><AdsAdmin /></TabsContent>
          <TabsContent value="logs" className="mt-6"><LogsAdmin /></TabsContent>
          <TabsContent value="visitas" className="mt-6"><VisitsAdmin /></TabsContent>
          <TabsContent value="usuarios" className="mt-6"><UsersAdmin /></TabsContent>
          <TabsContent value="manutencao" className="mt-6"><MaintenanceAdmin /></TabsContent>
          <TabsContent value="config" className="mt-6"><SettingsAdmin /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ===================== LIGAS ===================== */
function LeaguesAdmin() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<League | null>(null);
  const [payOpen, setPayOpen] = useState<League | null>(null);
  const [presidents, setPresidents] = useState<Record<string, { username: string; email: string }>>({});

  const reload = async () => {
    const { data } = await supabase.from("leagues").select("*").order("created_at", { ascending: false });
    setLeagues((data as League[]) ?? []);
    const ids = (data ?? []).map((l: any) => l.president_id).filter(Boolean);
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id,username,email").in("id", ids);
      const map: any = {}; (p ?? []).forEach((x: any) => map[x.id] = x);
      setPresidents(map);
    }
  };
  useEffect(() => { reload(); }, []);

  const delFn = useServerFn(deleteLeagueWithCancel);
  async function del(l: League) {
    if (!confirm(`Excluir liga ${l.name}? A assinatura mensal de anuidade (se ativa) será cancelada no Mercado Pago.`)) return;
    try {
      await delFn({ data: { league_id: l.id } });
      toast.success("Liga excluída e assinatura cancelada"); reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir liga");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Crie e gerencie as ligas acadêmicas.</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Nova Liga</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {leagues.map((l) => {
          const paid = l.paid_until && new Date(l.paid_until) >= new Date();
          return (
            <Card key={l.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="size-14 rounded-xl flex items-center justify-center text-white font-black" style={{ background: l.theme_color }}>
                    {l.icon_url ? <img src={l.icon_url} className="size-full object-contain rounded-xl" /> : l.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><h3 className="font-black text-lg">{l.name}</h3>
                      {l.published ? <Badge className="bg-green-600">Publicada</Badge> : <Badge variant="secondary">Despublicada</Badge>}
                      {paid ? <Badge variant="outline" className="border-green-500 text-green-700">Paga</Badge> : <Badge variant="destructive">Sem pagamento</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">/{l.slug}</p>
                    {l.president_id && presidents[l.president_id] && (
                      <p className="text-xs mt-1">Presidente: <span className="font-bold">{presidents[l.president_id].username}</span></p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Anuidade até: {l.paid_until ?? "—"}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setPayOpen(l)}><DollarSign className="size-4" /> Anuidade</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(l); setOpen(true); }}><Edit className="size-4" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => del(l)}><Trash2 className="size-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <LeagueDialog open={open} setOpen={setOpen} league={editing} onSaved={reload} />
      <PayDialog league={payOpen} setLeague={setPayOpen} onSaved={reload} />
    </div>
  );
}

function LeagueDialog({ open, setOpen, league, onSaved }: any) {
  const [form, setForm] = useState({ name: "", slug: "", description: "", icon_url: "", theme_color: "#1f5132", president_query: "", president2_query: "" });
  useEffect(() => {
    if (league) setForm({ name: league.name, slug: league.slug, description: league.description ?? "", icon_url: league.icon_url ?? "", theme_color: league.theme_color, president_query: "", president2_query: "" });
    else setForm({ name: "", slug: "", description: "", icon_url: "", theme_color: "#1f5132", president_query: "", president2_query: "" });
  }, [league, open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let president_id: string | null = league?.president_id ?? null;
    if (form.president_query.trim()) {
      const q = form.president_query.trim();
      const { data } = await supabase.from("profiles").select("id").or(`email.ilike.${q},username.ilike.${q}`).maybeSingle();
      if (!data) return toast.error("Esse usuário não existe");
      president_id = data.id;
    }
    let president2_id: string | null = league?.president2_id ?? null;
    const q2 = form.president2_query.trim();
    if (q2) {
      if (q2 === "-") {
        president2_id = null;
      } else {
        const { data } = await supabase.from("profiles").select("id").or(`email.ilike.${q2},username.ilike.${q2}`).maybeSingle();
        if (!data) return toast.error("Esse usuário (2º presidente) não existe");
        president2_id = data.id;
      }
    }
    const payload: any = {
      name: form.name, slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""), description: form.description,
      icon_url: form.icon_url || null, theme_color: form.theme_color, president_id, president2_id,
    };
    let err;
    if (league) { ({ error: err } = await supabase.from("leagues").update(payload).eq("id", league.id)); }
    else { ({ error: err } = await supabase.from("leagues").insert(payload)); }
    if (err) return toast.error(err.message);

    const leagueId = league?.id ?? (await supabase.from("leagues").select("id").eq("slug", payload.slug).maybeSingle()).data?.id;
    for (const pid of [president_id, president2_id]) {
      if (pid && leagueId) {
        await supabase.from("league_memberships").upsert(
          { league_id: leagueId, user_id: pid, role: "presidente" },
          { onConflict: "league_id,user_id" }
        );
      }
    }
    toast.success("Liga salva"); setOpen(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{league ? "Editar Liga" : "Nova Liga"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Nome</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Slug (URL: /slug)</Label><Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="lapcit" /></div>
          <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><ImageUpload label="Ícone" folder="leagues" value={form.icon_url} onChange={(url) => setForm({ ...form, icon_url: url })} /></div>
          <div><Label>Cor tema</Label><Input type="color" value={form.theme_color} onChange={(e) => setForm({ ...form, theme_color: e.target.value })} /></div>
          <div><Label>Presidente (email ou usuário)</Label><Input value={form.president_query} onChange={(e) => setForm({ ...form, president_query: e.target.value })} placeholder={league?.president_id ? "(manter atual)" : "lucas@email.com"} /></div>
          <div><Label>2º Presidente (email ou usuário)</Label><Input value={form.president2_query} onChange={(e) => setForm({ ...form, president2_query: e.target.value })} placeholder={league?.president2_id ? "(manter atual — use - para remover)" : "opcional"} /><p className="text-[11px] text-muted-foreground mt-1">Tem os mesmos poderes do presidente. Digite "-" para remover.</p></div>
          <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ league, setLeague, onSaved }: any) {
  const [date, setDate] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const cancelFn = useServerFn(cancelLeagueSubscription);
  useEffect(() => { setDate(league?.paid_until ?? ""); }, [league]);
  if (!league) return null;
  async function save() {
    const { error } = await supabase.from("leagues").update({ paid_until: date || null }).eq("id", league.id);
    if (error) return toast.error(error.message);
    toast.success("Anuidade atualizada"); setLeague(null); onSaved();
  }
  async function cancelSub() {
    if (!confirm("Cancelar a assinatura mensal no Mercado Pago e marcar a liga como sem pagamento? Esta ação remove paid_until e despublica a liga.")) return;
    try {
      setCancelling(true);
      const r: any = await cancelFn({ data: { league_id: league.id } } as any);
      toast.success(`Assinatura cancelada${r?.mp_cancelled ? ` (${r.mp_cancelled} no MP)` : ""}.`);
      setLeague(null); onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao cancelar");
    } finally { setCancelling(false); }
  }
  return (
    <Dialog open={!!league} onOpenChange={(o) => !o && setLeague(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Anuidade — {league.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Define até qual data a anuidade está paga. Após essa data, a liga sai automaticamente da página inicial.</p>
        <div><Label>Paga até</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="destructive" onClick={cancelSub} disabled={cancelling}>
            <Trash2 className="size-4" /> {cancelling ? "Cancelando..." : "Cancelar assinatura"}
          </Button>
          <Button onClick={save}><Calendar className="size-4" /> Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== CAMED ===================== */
function CamedAdmin() {
  const [info, setInfo] = useState<any>({ title: "", subtitle: "", description: "" });
  const [members, setMembers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    const { data: i } = await supabase.from("camed_info").select("*").eq("id", 1).maybeSingle();
    if (i) setInfo(i);
    const { data: m } = await supabase.from("camed_members").select("*").order("display_order");
    setMembers(m ?? []);
  };
  useEffect(() => { reload(); }, []);

  async function saveInfo() {
    const { error } = await supabase.from("camed_info").update({ title: info.title, subtitle: info.subtitle, description: info.description }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Informações atualizadas");
  }
  const deleteFiles = useServerFn(deleteStorageFiles);
  async function delMember(id: string) {
    if (!confirm("Excluir membro?")) return;
    const m = members.find((x: any) => x.id === id);
    const { error } = await supabase.from("camed_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (m?.image_url) { try { await deleteFiles({ data: { paths: [m.image_url] } }); } catch {} }
    toast.success("Excluído"); reload();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informações do CAMED</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} /></div>
          <div><Label>Subtítulo</Label><Input value={info.subtitle} onChange={(e) => setInfo({ ...info, subtitle: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={5} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} /></div>
          <Button onClick={saveInfo}>Salvar informações</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membros do CAMED</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Novo</Button>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="aspect-square rounded-lg bg-muted mb-3 overflow-hidden">{m.image_url && <img src={m.image_url} className="w-full h-full object-cover" />}</div>
                  <Badge variant="secondary">{m.role}</Badge>
                  <h4 className="font-black mt-2">{m.name}</h4>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(m); setOpen(true); }}><Edit className="size-3" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => delMember(m.id)}><Trash2 className="size-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
      <CamedMemberDialog open={open} setOpen={setOpen} member={editing} onSaved={reload} />
      <CamedPresidentsCard />
    </div>
  );
}

function CamedPresidentsCard() {
  const [list, setList] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    const { data } = await supabase.from("camed_presidents").select("*").order("created_at", { ascending: false });
    setList(data ?? []);
  }
  useEffect(() => { reload(); }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v) return;
    setBusy(true);
    const { error } = await supabase.from("camed_presidents").insert({ email: v });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Presidente do CAMED adicionado");
    setEmail("");
    reload();
  }
  async function remove(id: string) {
    if (!confirm("Remover este presidente do CAMED?")) return;
    const { error } = await supabase.from("camed_presidents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }
  return (
    <Card>
      <CardHeader><CardTitle>Presidentes do CAMED</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Defina os e-mails dos usuários que terão acesso ao painel do CAMED. O acesso é concedido assim que o usuário fizer login com este e-mail.</p>
        <form onSubmit={add} className="flex gap-2">
          <Input type="email" required placeholder="email@unochapeco.edu.br" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" disabled={busy}><Plus className="size-4" /> Adicionar</Button>
        </form>
        <div className="space-y-1">
          {list.length === 0 && <p className="text-xs text-muted-foreground">Nenhum presidente cadastrado ainda.</p>}
          {list.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-2 rounded border text-sm">
              <span className="font-medium">{p.email}</span>
              <Button size="sm" variant="destructive" onClick={() => remove(p.id)}><Trash2 className="size-3" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CamedMemberDialog({ open, setOpen, member, onSaved }: any) {
  const [f, setF] = useState({ name: "", role: "", description: "", image_url: "", display_order: 0 });
  useEffect(() => {
    if (member) setF({ name: member.name, role: member.role, description: member.description ?? "", image_url: member.image_url ?? "", display_order: member.display_order ?? 0 });
    else setF({ name: "", role: "", description: "", image_url: "", display_order: 0 });
  }, [member, open]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, image_url: f.image_url || null };
    let err;
    if (member) ({ error: err } = await supabase.from("camed_members").update(payload).eq("id", member.id));
    else ({ error: err } = await supabase.from("camed_members").insert(payload));
    if (err) return toast.error(err.message);
    toast.success("Salvo"); setOpen(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{member ? "Editar membro" : "Novo membro"}</DialogTitle></DialogHeader>
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
  );
}

/* ===================== USUÁRIOS ===================== */
function UsersAdmin() {
  return (
    <Tabs defaultValue="cadastros">
      <TabsList>
        <TabsTrigger value="cadastros">Cadastros</TabsTrigger>
        <TabsTrigger value="termos">Termos de Uso</TabsTrigger>
      </TabsList>
      <TabsContent value="cadastros" className="mt-4"><UsersList /></TabsContent>
      <TabsContent value="termos" className="mt-4"><TermsAdmin /></TabsContent>
    </Tabs>
  );
}

function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [removing, setRemoving] = useState<any | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const listFn = useServerFn(listUsersAdmin);
  const delFn = useServerFn(deleteUserAdmin);

  const reload = async (query?: string) => {
    setLoading(true);
    try {
      const rows = await listFn({ data: { q: query ?? "" } });
      setUsers(rows as any[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar usuários");
    }
    setLoading(false);
  };
  useEffect(() => { reload(""); }, []);
  useEffect(() => {
    const t = setTimeout(() => reload(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  async function confirmDelete() {
    if (!removing) return;
    setDeleting(true);
    try {
      await delFn({ data: { user_id: removing.id } });
      toast.success("Usuário excluído");
      setRemoving(null); setConfirmText("");
      reload(q);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir usuário");
    }
    setDeleting(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Usuários cadastrados</CardTitle></CardHeader>
      <CardContent>
        <Input placeholder="Buscar por nome, usuário, e-mail, CPF ou matrícula..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
        {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
          <div className="space-y-2">
            {users.length === 0 && <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>}
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded border">
                <div className="min-w-0">
                  <div className="font-bold truncate">{u.full_name || u.username}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{u.username} · {u.email} · {u.phone ?? "sem telefone"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.is_unochapeco_student ? "Medicina Unochapecó" : (u.course || "Curso não informado")}
                    {u.class_code ? ` · ${u.class_code}` : ""}
                    {u.current_semester ? ` · ${u.current_semester}º semestre` : ""}
                    {u.cpf ? ` · CPF ${u.cpf}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditing(u)}><Edit className="size-4" /> Editar</Button>
                  <Button size="sm" variant="destructive" onClick={() => { setRemoving(u); setConfirmText(""); }}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <AdminUserDialog user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(q); }} />

        <Dialog open={!!removing} onOpenChange={(v) => { if (!v) { setRemoving(null); setConfirmText(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Excluir usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Esta ação remove a conta de login e o perfil de <strong>{removing?.full_name || removing?.username}</strong> permanentemente.
              </p>
              <div>
                <Label>Digite <strong>{removing?.username}</strong> para confirmar</Label>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setRemoving(null); setConfirmText(""); }} disabled={deleting}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting || confirmText.trim() !== (removing?.username ?? "")}>
                {deleting ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function fmtDateTime(v: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return String(v); }
}

function TermsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [cov, setCov] = useState<any>(null);
  const [q, setQ] = useState("");
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const listFn = useServerFn(listTermsAcceptancesAdmin);
  const covFn = useServerFn(getTermsCoverageAdmin);

  const load = async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        listFn({ data: { q, version: version || undefined } }),
        covFn({ data: { current_version: TERMS_VERSION } }),
      ]);
      setRows(a as any[]);
      setCov(c);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar aceites");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [q, version]);

  function exportCsv() {
    const head = ["Nome", "Usuario", "Email", "CPF", "Versao", "Data/Hora", "IP", "Navegador"];
    const lines = rows.map((r) => [
      r.profile?.full_name ?? "", r.profile?.username ?? "", r.profile?.email ?? "", r.profile?.cpf ?? "",
      r.version, fmtDateTime(r.accepted_at), r.ip ?? "", (r.user_agent ?? "").replace(/[\r\n]+/g, " "),
    ]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `aceites-termos-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const versions = Object.keys(cov?.by_version ?? {}).sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Versões e cobertura</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge className="bg-primary">Versão vigente: {TERMS_VERSION}</Badge>
            <Link to="/termos" className="text-primary underline">Ver texto público dos termos</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Usuários</div><div className="text-2xl font-black">{cov?.total_users ?? "—"}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Aceitaram a versão atual</div><div className="text-2xl font-black text-primary">{cov?.accepted_current ?? "—"}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-black text-destructive">{cov?.pending_count ?? "—"}</div></div>
            <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Versões registradas</div><div className="text-2xl font-black">{versions.length}</div></div>
          </div>
          {versions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {versions.map((v) => <Badge key={v} variant="outline">v{v}: {cov.by_version[v]} aceites</Badge>)}
            </div>
          )}
          {cov?.pending?.length ? (
            <div>
              <div className="text-sm font-bold mb-2">Pendentes da versão {TERMS_VERSION}</div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {cov.pending.map((p: any) => (
                  <div key={p.id} className="text-xs text-muted-foreground border rounded px-2 py-1">
                    {p.full_name || p.username} · @{p.username} · {p.email}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Aceites registrados</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <Input placeholder="Buscar por nome, usuário, e-mail ou CPF..." value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={version} onChange={(e) => setVersion(e.target.value)}>
              <option value="">Todas as versões</option>
              {versions.map((v) => <option key={v} value={v}>Versão {v}</option>)}
            </select>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>Exportar CSV</Button>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
            <div className="space-y-2">
              {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aceite encontrado.</p>}
              {rows.map((r) => (
                <div key={r.id} className="rounded border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.profile?.full_name || r.profile?.username || "Usuário removido"}</span>
                    <Badge variant="outline">v{r.version}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(r.accepted_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    @{r.profile?.username ?? "—"} · {r.profile?.email ?? "—"}{r.profile?.cpf ? ` · CPF ${r.profile.cpf}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground break-all">IP: {r.ip ?? "—"} · {r.user_agent ?? "navegador não informado"}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function AdminUserDialog({ user, onClose, onSaved }: { user: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const saveFn = useServerFn(updateUserAdmin);
  useEffect(() => { if (user) setF({ ...user }); }, [user]);

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: {
        user_id: user.id,
        full_name: f.full_name || null,
        username: (f.username ?? "").trim(),
        email: (f.email ?? "").trim(),
        phone: f.phone || null,
        cpf: f.cpf || null,
        course: f.course || null,
        matricula: f.matricula || null,
        registration_number: f.registration_number || null,
        current_semester: f.current_semester ? Number(f.current_semester) : null,
        class_code: f.class_code || null,
        is_unochapeco_student: !!f.is_unochapeco_student,
      } });
      toast.success("Dados do usuário atualizados");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
    setSaving(false);
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome completo</Label><Input value={f.full_name ?? ""} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Usuário</Label><Input value={f.username ?? ""} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div><Label>CPF</Label><Input value={f.cpf ?? ""} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!f.is_unochapeco_student} onCheckedChange={(v) => setF({ ...f, is_unochapeco_student: v })} />
            <Label>Aluno(a) de Medicina da Unochapecó</Label>
          </div>
          {f.is_unochapeco_student ? (
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Turma</Label><Input value={f.class_code ?? ""} onChange={(e) => setF({ ...f, class_code: e.target.value.toUpperCase() })} placeholder="ATM31" /></div>
              <div><Label>Semestre</Label><Input type="number" min={1} max={20} value={f.current_semester ?? ""} onChange={(e) => setF({ ...f, current_semester: e.target.value })} /></div>
              <div><Label>Matrícula</Label><Input value={f.matricula ?? ""} onChange={(e) => setF({ ...f, matricula: e.target.value })} /></div>
            </div>
          ) : (
            <div><Label>Curso</Label><Input value={f.course ?? ""} onChange={(e) => setF({ ...f, course: e.target.value })} /></div>
          )}
          <div><Label>Registro / Matrícula (outros)</Label><Input value={f.registration_number ?? ""} onChange={(e) => setF({ ...f, registration_number: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">A senha não pode ser visualizada nem alterada por aqui — o usuário deve usar "Esqueci minha senha".</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ===================== CONFIG ===================== */
function SettingsAdmin() {
  const [s, setS] = useState<any>({
    annual_fee_credit_monthly: 0.05,
    fee_selection_pct: 5, fee_selection_fixed: 0,
    fee_semester_pct: 5, fee_semester_fixed: 0,
    fee_event_pct: 5, fee_event_fixed: 0,
    fee_minicourse_pct: 5, fee_minicourse_fixed: 0,
    fee_atletica_event_pct: 5, fee_atletica_event_fixed: 0,
    fee_atletica_product_pct: 5, fee_atletica_product_fixed: 0,
    fee_atletica_membership_pct: 5, fee_atletica_membership_fixed: 0,
  });
  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setS({
        annual_fee_credit_monthly: Number((data as any).annual_fee_credit_monthly),
        fee_selection_pct: Number((data as any).fee_selection_pct ?? 5),
        fee_selection_fixed: Number((data as any).fee_selection_fixed ?? 0),
        fee_semester_pct: Number((data as any).fee_semester_pct ?? 5),
        fee_semester_fixed: Number((data as any).fee_semester_fixed ?? 0),
        fee_event_pct: Number((data as any).fee_event_pct ?? 5),
        fee_event_fixed: Number((data as any).fee_event_fixed ?? 0),
        fee_minicourse_pct: Number((data as any).fee_minicourse_pct ?? 5),
        fee_minicourse_fixed: Number((data as any).fee_minicourse_fixed ?? 0),
        fee_atletica_event_pct: Number((data as any).fee_atletica_event_pct ?? 5),
        fee_atletica_event_fixed: Number((data as any).fee_atletica_event_fixed ?? 0),
        fee_atletica_product_pct: Number((data as any).fee_atletica_product_pct ?? 5),
        fee_atletica_product_fixed: Number((data as any).fee_atletica_product_fixed ?? 0),
        fee_atletica_membership_pct: Number((data as any).fee_atletica_membership_pct ?? 5),
        fee_atletica_membership_fixed: Number((data as any).fee_atletica_membership_fixed ?? 0),
      });
    });
  }, []);
  async function save() {
    const { error } = await supabase.from("app_settings").update({
      annual_fee_credit_monthly: s.annual_fee_credit_monthly,
      annual_fee_pix_monthly: s.annual_fee_credit_monthly,
      fee_selection_pct: s.fee_selection_pct, fee_selection_fixed: s.fee_selection_fixed,
      fee_semester_pct: s.fee_semester_pct, fee_semester_fixed: s.fee_semester_fixed,
      fee_event_pct: s.fee_event_pct, fee_event_fixed: s.fee_event_fixed,
      fee_minicourse_pct: s.fee_minicourse_pct, fee_minicourse_fixed: s.fee_minicourse_fixed,
      fee_atletica_event_pct: s.fee_atletica_event_pct, fee_atletica_event_fixed: s.fee_atletica_event_fixed,
      fee_atletica_product_pct: s.fee_atletica_product_pct, fee_atletica_product_fixed: s.fee_atletica_product_fixed,
      fee_atletica_membership_pct: s.fee_atletica_membership_pct, fee_atletica_membership_fixed: s.fee_atletica_membership_fixed,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  }

  const feeRow = (label: string, pctKey: string, fixKey: string, hint: string) => (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px] gap-3 items-end p-4 rounded-lg border bg-card/40">
      <div>
        <div className="font-bold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div><Label className="text-xs">Percentual (%)</Label><Input type="number" step="0.01" min="0" value={s[pctKey]} onChange={(e) => setS({ ...s, [pctKey]: +e.target.value })} /></div>
      <div><Label className="text-xs">Valor fixo (R$)</Label><Input type="number" step="0.01" min="0" value={s[fixKey]} onChange={(e) => setS({ ...s, [fixKey]: +e.target.value })} /></div>
    </div>
  );

  async function advanceSemester() {
    if (!confirm("Avançar 1 semestre para TODOS os alunos Unochapecó? (limite 20)")) return;
    const { data, error } = await (supabase as any).rpc("advance_semester");
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} alunos avançaram de semestre.`);
  }

  return (
    <div className="space-y-6">
      <Card className="border-orange-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GraduationCap className="size-5 text-orange-500" /> Virada de Semestre</CardTitle>
          <p className="text-sm text-muted-foreground">Incrementa em +1 o semestre de todos os alunos Unochapecó cadastrados (limite 20). Ideal executar no início de cada semestre letivo.</p>
        </CardHeader>
        <CardContent>
          <Button onClick={advanceSemester} variant="destructive">Avançar todos em +1 semestre</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Anuidade das Ligas (100% da plataforma)</CardTitle></CardHeader>

        <CardContent className="space-y-3">
          <div><Label>Valor mensal no cartão (R$)</Label><Input type="number" step="0.01" value={s.annual_fee_credit_monthly} onChange={(e) => setS({ ...s, annual_fee_credit_monthly: +e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Cobrança recorrente mensal via Mercado Pago. Valor lido em tempo real no checkout.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas de repasse por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">Taxa retida pela plataforma em cada transação. O restante vai direto pra conta Mercado Pago do presidente da liga. Fórmula: <code>taxa = preço × (%) + valor fixo</code>.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {feeRow("Processo Seletivo", "fee_selection_pct", "fee_selection_fixed", "Cobrada em cada inscrição na prova seletiva")}
          {feeRow("Semestralidade", "fee_semester_pct", "fee_semester_fixed", "Mensalidades/semestralidades cobradas dos ligantes (quando aplicável)")}
          {feeRow("Eventos", "fee_event_pct", "fee_event_fixed", "Cobrada em cada inscrição paga em eventos")}
          {feeRow("Minicursos", "fee_minicourse_pct", "fee_minicourse_fixed", "Cobrada em cada inscrição paga em minicursos")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas da Atlética</CardTitle>
          <p className="text-sm text-muted-foreground">Taxas retidas pela plataforma sobre vendas online da Atlética (ingressos, produtos e associações).</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {feeRow("Eventos da Atlética", "fee_atletica_event_pct", "fee_atletica_event_fixed", "Cobrada em cada ingresso de evento/festa vendido online")}
          {feeRow("Produtos da Atlética", "fee_atletica_product_pct", "fee_atletica_product_fixed", "Cobrada em cada pedido de produto vendido online")}
          {feeRow("Associações da Atlética", "fee_atletica_membership_pct", "fee_atletica_membership_fixed", "Cobrada quando um novo sócio paga a associação online")}
        </CardContent>
      </Card>

      <Button onClick={save} size="lg">Salvar todas as configurações</Button>
    </div>
  );
}

/* ===================== COORDENAÇÃO ===================== */
function CoordinationAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const deleteFiles = useServerFn(deleteStorageFiles);
  const reload = async () => {
    const { data } = await supabase.from("coordination_staff").select("*").order("display_order");
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, []);
  async function del(row: any) {
    if (!confirm(`Excluir ${row.name}?`)) return;
    const { error } = await supabase.from("coordination_staff").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    if (row.image_url) { try { await deleteFiles({ data: { paths: [row.image_url] } }); } catch {} }
    toast.success("Removido"); reload();
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Cadastro do corpo de coordenação do curso de Medicina.</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Novo</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="aspect-square rounded-lg bg-muted mb-3 overflow-hidden">{c.image_url && <img src={c.image_url} className="w-full h-full object-cover" />}</div>
              <Badge variant="secondary" className="text-[10px] uppercase">{c.role_key}</Badge>
              <h4 className="font-black mt-1">{c.name}</h4>
              <p className="text-xs text-muted-foreground">{c.title}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}><Edit className="size-3" /></Button>
                <Button size="sm" variant="destructive" onClick={() => del(c)}><Trash2 className="size-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <CoordDialog open={open} setOpen={setOpen} row={editing} onSaved={reload} />
    </div>
  );
}

function CoordDialog({ open, setOpen, row, onSaved }: any) {
  const [f, setF] = useState({ role_key: "coordenador", name: "", title: "", bio: "", email: "", image_url: "", display_order: 0 });
  useEffect(() => {
    if (row) setF({ role_key: row.role_key, name: row.name, title: row.title ?? "", bio: row.bio ?? "", email: row.email ?? "", image_url: row.image_url ?? "", display_order: row.display_order ?? 0 });
    else setF({ role_key: "coordenador", name: "", title: "", bio: "", email: "", image_url: "", display_order: 0 });
  }, [row, open]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, image_url: f.image_url || null, email: f.email || null };
    let err;
    if (row) ({ error: err } = await supabase.from("coordination_staff").update(payload).eq("id", row.id));
    else ({ error: err } = await supabase.from("coordination_staff").insert(payload));
    if (err) return toast.error(err.message);
    toast.success("Salvo"); setOpen(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{row ? "Editar" : "Novo membro"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Papel (único)</Label>
            <select className="w-full h-10 border rounded-md bg-background px-3" value={f.role_key} onChange={(e) => setF({ ...f, role_key: e.target.value })}>
              <option value="coordenador">Coordenador(a)</option>
              <option value="adjunta">Coordenação Adjunta</option>
              <option value="assistente">Assistente</option>
            </select>
          </div>
          <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Cargo/Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>Bio</Label><Textarea rows={4} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
          <div><Label>E-mail</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><ImageUpload label="Foto" folder="coordination" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
          <div><Label>Ordem</Label><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: +e.target.value })} /></div>
          <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== ANÚNCIOS ===================== */
type AdPlacement = "home" | "ligas" | "logos" | "parceiros";
const AD_PLACEMENTS: { key: AdPlacement; label: string; hint: string }[] = [
  { key: "home", label: "Hub Inicial", hint: "Carrossel de banners no topo do hub inicial." },
  { key: "ligas", label: "Página Ligas", hint: "Carrossel de banners na página de Ligas." },
  { key: "logos", label: "Logos (Hub)", hint: "Pequenas logos horizontais logo abaixo do título MEDHUB." },
  { key: "parceiros", label: "Parceiros", hint: "Cards clicáveis exibidos na página /parceiros." },
];

function AdsAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [placement, setPlacement] = useState<AdPlacement>("home");
  const deleteFiles = useServerFn(deleteStorageFiles);
  const reload = async () => {
    const { data } = await supabase.from("ads").select("*").order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, []);
  async function toggle(row: any) {
    const { error } = await supabase.from("ads").update({ active: !row.active }).eq("id", row.id);
    if (error) return toast.error(error.message);
    reload();
  }
  async function del(row: any) {
    if (!confirm(`Excluir "${row.title}"?`)) return;
    const { error } = await supabase.from("ads").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    if (row.image_url) { try { await deleteFiles({ data: { paths: [row.image_url] } }); } catch {} }
    toast.success("Removido"); reload();
  }
  const filtered = list
    .filter((a) => (a.placement ?? "home") === placement)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const meta = AD_PLACEMENTS.find((p) => p.key === placement)!;
  return (
    <div className="space-y-6">
      <AdsAnalytics ads={list} />
      <Tabs value={placement} onValueChange={(v) => setPlacement(v as AdPlacement)}>
        <TabsList className="flex overflow-x-auto">
          {AD_PLACEMENTS.map((p) => (
            <TabsTrigger key={p.key} value={p.key} className="whitespace-nowrap">{p.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <p className="text-muted-foreground text-sm">
          <strong>{meta.label}</strong> — {meta.hint} Cliques e visualizações são registrados automaticamente.
        </p>
        <Button onClick={() => { setEditing({ placement }); setOpen(true); }}><Plus className="size-4" /> Novo</Button>
      </div>


      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nada cadastrado em {meta.label}.</Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((a) => {
            const active = a.active && (!a.end_date || new Date(a.end_date) >= new Date()) && new Date(a.start_date) <= new Date();
            return (
              <Card key={a.id}>
                <div className={`${placement === "logos" ? "aspect-[3/1] flex items-center justify-center p-4" : "aspect-[3/1]"} bg-muted overflow-hidden`}>
                  {a.image_url && <img src={a.image_url} alt={a.title} className={placement === "logos" ? "max-h-full max-w-full object-contain" : "w-full h-full object-cover"} />}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black flex-1">{a.title}</h3>
                    {active ? <Badge className="bg-green-600">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>}
                  {a.cta_label && <p className="text-xs text-muted-foreground mt-1">Botão: <strong>{a.cta_label}</strong></p>}
                  {a.redirect_url && <p className="text-xs text-muted-foreground truncate mt-1">→ {a.redirect_url}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Ordem {a.display_order ?? 0} · {new Date(a.start_date).toLocaleDateString("pt-BR")} → {a.end_date ? new Date(a.end_date).toLocaleDateString("pt-BR") : "sem fim"}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <div className="flex items-center gap-2"><Switch checked={a.active} onCheckedChange={() => toggle(a)} /><span className="text-xs">Ligado</span></div>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(a); setOpen(true); }}><Edit className="size-3" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => del(a)}><Trash2 className="size-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <AdDialog open={open} setOpen={setOpen} row={editing} defaultPlacement={placement} onSaved={reload} />
    </div>
  );
}

function AdDialog({ open, setOpen, row, defaultPlacement, onSaved }: any) {
  const [f, setF] = useState({ title: "", image_url: "", redirect_url: "", description: "", cta_label: "", display_order: 0, active: true, start_date: "", end_date: "", placement: "home" as AdPlacement });
  useEffect(() => {
    const iso = (v: string | null | undefined) => v ? v.slice(0, 10) : "";
    if (row && row.id) setF({ title: row.title, image_url: row.image_url ?? "", redirect_url: row.redirect_url ?? "", description: row.description ?? "", cta_label: row.cta_label ?? "", display_order: row.display_order ?? 0, active: !!row.active, start_date: iso(row.start_date), end_date: iso(row.end_date), placement: (row.placement ?? "home") as AdPlacement });
    else setF({ title: "", image_url: "", redirect_url: "", description: "", cta_label: "", display_order: 0, active: true, start_date: new Date().toISOString().slice(0, 10), end_date: "", placement: (row?.placement ?? defaultPlacement ?? "home") as AdPlacement });
  }, [row, open, defaultPlacement]);
  const isPartner = f.placement === "parceiros";
  const isLogo = f.placement === "logos";
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.image_url) return toast.error("Envie uma imagem.");
    const payload: any = {
      title: f.title,
      image_url: f.image_url,
      redirect_url: f.redirect_url || null,
      description: isPartner ? (f.description || null) : null,
      cta_label: isPartner ? (f.cta_label || null) : null,
      display_order: f.display_order || 0,
      active: f.active,
      placement: f.placement,
      start_date: f.start_date ? new Date(f.start_date).toISOString() : new Date().toISOString(),
      end_date: f.end_date ? new Date(f.end_date).toISOString() : null,
    };
    let err;
    if (row && row.id) ({ error: err } = await supabase.from("ads").update(payload).eq("id", row.id));
    else ({ error: err } = await supabase.from("ads").insert(payload));
    if (err) return toast.error(err.message);
    toast.success("Salvo"); setOpen(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{row && row.id ? "Editar" : "Novo"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label>Local de exibição</Label>
            <Tabs value={f.placement} onValueChange={(v) => setF({ ...f, placement: v as AdPlacement })} className="mt-1.5">
              <TabsList className="grid grid-cols-4 w-full">
                {AD_PLACEMENTS.map((p) => (
                  <TabsTrigger key={p.key} value={p.key} className="text-[11px] px-1">{p.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div><Label>{isPartner ? "Nome do parceiro" : "Título"}</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div>
            <ImageUpload
              label={isLogo ? "Logo (PNG com fundo transparente recomendado)" : isPartner ? "Imagem do card (16:9)" : "Imagem (proporção 3:1 recomendada)"}
              folder="ads"
              value={f.image_url}
              onChange={(url) => setF({ ...f, image_url: url })}
            />
          </div>
          {isPartner && (
            <>
              <div><Label>Descrição</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="O que o parceiro oferece..." /></div>
              <div><Label>Texto do botão</Label><Input value={f.cta_label} onChange={(e) => setF({ ...f, cta_label: e.target.value })} placeholder="Saiba mais!" /></div>
            </>
          )}
          <div><Label>URL de redirecionamento {isPartner ? "(do botão)" : "(opcional)"}</Label><Input type="url" value={f.redirect_url} onChange={(e) => setF({ ...f, redirect_url: e.target.value })} placeholder="https://..." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Ordem</Label><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: +e.target.value })} /></div>
            <div><Label>Início</Label><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
            <div><Label>Término</Label><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /><Label>Ativo</Label></div>
          <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

}

function AdsAnalytics({ ads }: { ads: any[] }) {
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const [placementFilter, setPlacementFilter] = useState<"all" | AdPlacement>("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any).rpc("get_ad_analytics_summary", { _since: since });
      setRows((data as any[]) ?? []);
      setLoading(false);
    })();
  }, [range]);

  const allowedAdIds = new Set(
    ads.filter((a) => placementFilter === "all" ? true : (a.placement ?? "home") === placementFilter).map((a) => a.id)
  );
  const filteredRows = rows.filter((r) => allowedAdIds.has(r.ad_id));

  const byAd = new Map<string, { title: string; views: number; clicks: number; uniqueViews: number; uniqueClicks: number }>();
  ads.filter((a) => allowedAdIds.has(a.id)).forEach((a) => byAd.set(a.id, { title: a.title || "(sem título)", views: 0, clicks: 0, uniqueViews: 0, uniqueClicks: 0 }));
  filteredRows.forEach((r: any) => {
    const b = byAd.get(r.ad_id); if (!b) return;
    const cnt = Number(r.cnt ?? 0);
    const uq = Number(r.unique_users ?? 0);
    if (r.action === "view") { b.views += cnt; b.uniqueViews += uq; }
    else if (r.action === "click") { b.clicks += cnt; b.uniqueClicks += uq; }
  });
  const chartData = Array.from(byAd.entries()).map(([, v]) => ({ name: v.title.slice(0, 20), Views: v.views, Cliques: v.clicks, "Views únicas": v.uniqueViews, "Cliques únicos": v.uniqueClicks }));
  const totals = chartData.reduce((acc, r) => ({ v: acc.v + r.Views, c: acc.c + r.Cliques, uv: acc.uv + r["Views únicas"], uc: acc.uc + r["Cliques únicos"] }), { v: 0, c: 0, uv: 0, uc: 0 });

  // Per-day breakdown for the selected range
  const days = Number(range);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const perDay = new Map<string, { label: string; Views: number; Cliques: number; ts: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    const label = diff === 0 ? "Hoje" : diff === 1 ? "Ontem" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    perDay.set(key, { label, Views: 0, Cliques: 0, ts: d.getTime() });
  }
  rows.forEach((r: any) => {
    if (!allowedAdIds.has(r.ad_id)) return;
    const key = String(r.day).slice(0, 10);
    const b = perDay.get(key); if (!b) return;
    const cnt = Number(r.cnt ?? 0);
    if (r.action === "view") b.Views += cnt; else if (r.action === "click") b.Cliques += cnt;
  });
  const perDayData = Array.from(perDay.values()).sort((a, b) => a.ts - b.ts);


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-orange-500" /> Analytics de Anúncios</CardTitle>
          <div className="flex gap-1">
            {(["7", "30", "90"] as const).map((r) => (
              <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>{r}d</Button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {([
            { k: "all", label: "Todos" },
            { k: "home", label: "Hub Inicial" },
            { k: "ligas", label: "Página Ligas" },
            { k: "logos", label: "Logos (Hub)" },
            { k: "parceiros", label: "Parceiros" },
          ] as const).map((o) => (
            <Button key={o.k} size="sm" variant={placementFilter === o.k ? "default" : "outline"} onClick={() => setPlacementFilter(o.k)}>{o.label}</Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Views totais</div><div className="text-2xl font-black">{totals.v}</div></div>
          <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Views únicas</div><div className="text-2xl font-black">{totals.uv}</div></div>
          <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Cliques totais</div><div className="text-2xl font-black">{totals.c}</div></div>
          <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Cliques únicos</div><div className="text-2xl font-black">{totals.uc}</div></div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Carregando dados...</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum anúncio cadastrado ainda.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="Views" fill="#f97316" />
                <Bar dataKey="Cliques" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && perDayData.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Cliques por dia</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perDayData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(perDayData.length / 12) - 1)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="Cliques" fill="#22c55e" />
                  <Bar dataKey="Views" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ===================== VISITAS ===================== */
function VisitsAdmin() {
  const [granularity, setGranularity] = useState<"hour" | "day" | "week" | "month">("day");
  const [range, setRange] = useState<number>(30); // days back
  const [data, setData] = useState<{ label: string; unique: number; total: number }[]>([]);
  const [totals, setTotals] = useState({ users: 0, uniqueVisitors: 0, totalVisits: 0, adClicks: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const since = new Date(now.getTime() - range * 24 * 60 * 60 * 1000).toISOString();
      const [{ data: summary }, { data: tot }, { count: userCount }, { count: adClicks }] = await Promise.all([
        (supabase as any).rpc("get_visits_summary", { _since: since, _granularity: granularity }),
        (supabase as any).rpc("get_visits_totals", { _since: since }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("ad_analytics").select("*", { count: "exact", head: true }).eq("action", "click").gte("created_at", since),
      ]);
      const totalsRow = (tot as any[])?.[0] ?? { unique_visitors: 0, total_visits: 0 };
      setTotals({
        users: userCount ?? 0,
        uniqueVisitors: Number(totalsRow.unique_visitors ?? 0),
        totalVisits: Number(totalsRow.total_visits ?? 0),
        adClicks: adClicks ?? 0,
      });
      const chart = ((summary as any[]) ?? []).map((r) => ({
        label: r.label,
        unique: Number(r.unique_count ?? 0),
        total: Number(r.total ?? 0),
      }));
      setData(chart);
      setLoading(false);
    })();
  }, [granularity, range]);


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Usuários cadastrados" value={totals.users} />
        <MetricCard label="Visitantes únicos" value={totals.uniqueVisitors} />
        <MetricCard label="Visitas totais" value={totals.totalVisits} />
        <MetricCard label="Cliques em anúncios" value={totals.adClicks} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2"><BarChart3 className="size-5" /> Visitas ao longo do tempo</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 rounded-lg border p-1">
              {(["hour", "day", "week", "month"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGranularity(g)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${granularity === g ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {g === "hour" ? "Horas" : g === "day" ? "Dias" : g === "week" ? "Semanas" : "Meses"}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg border p-1">
              {[1, 7, 30, 90, 365].map((r) => (
                <button key={r} type="button" onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${range === r ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {r === 1 ? "24h" : r === 365 ? "1 ano" : `${r}d`}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-72 flex items-center justify-center opacity-60">Carregando...</div>
          ) : data.length === 0 ? (
            <div className="h-72 flex items-center justify-center opacity-60">Sem visitas neste período</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gUnique" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" name="Visitas totais" stroke="#f97316" strokeWidth={2.5} fill="url(#gTotal)" />
                  <Area type="monotone" dataKey="unique" name="Visitantes únicos" stroke="#22c55e" strokeWidth={2.5} fill="url(#gUnique)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-3xl font-black mt-1">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}

function MaintenanceAdmin() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [list, setList] = useState<Array<{ id: string; email: string; note: string | null }>>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: s }, { data: al }] = await Promise.all([
      supabase.from("app_settings").select("maintenance_enabled").eq("id", 1).maybeSingle(),
      supabase.from("maintenance_allowlist" as any).select("id, email, note").order("created_at", { ascending: false }),
    ]);
    setEnabled(!!(s as any)?.maintenance_enabled);
    setList(((al as any) ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    const { error } = await supabase.from("app_settings").update({ maintenance_enabled: next } as any).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    setEnabled(next);
    toast.success(next ? "Modo manutenção ativado" : "Modo manutenção desativado");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v) return;
    const { error } = await supabase.from("maintenance_allowlist" as any).insert({ email: v, note: note.trim() || null } as any);
    if (error) return toast.error(error.message);
    setEmail(""); setNote(""); load();
    toast.success("E-mail adicionado");
  }

  async function remove(id: string) {
    if (!confirm("Remover este e-mail da lista?")) return;
    const { error } = await supabase.from("maintenance_allowlist" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4 text-emerald-500" /> Modo manutenção</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Quando ativado, apenas você (administrador master) e os e-mails na lista abaixo conseguem acessar o site. Os demais veem a tela de manutenção com opção de login.
          </div>
          <Button onClick={() => toggle(!enabled)} disabled={busy} variant={enabled ? "destructive" : "default"}>
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">E-mails com acesso à versão teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={add} className="grid md:grid-cols-[1fr_1fr_auto] gap-2">
            <Input placeholder="email@exemplo.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
          </form>
          <div className="divide-y border rounded-md">
            {list.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Nenhum e-mail cadastrado.</div>}
            {list.map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.email}</div>
                  {r.note && <div className="text-xs text-muted-foreground truncate">{r.note}</div>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


/* ---------- LOGS ---------- */
type LogRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  category: string;
  action: string;
  target: string | null;
  details: any;
  path: string | null;
};

function LogsAdmin() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("todas");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(200);

  const load = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (category !== "todas") query = query.eq("category", category);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [category, limit]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const hay = [r.user_name, r.user_email, r.action, r.target, r.path, JSON.stringify(r.details)]
      .join(" ").toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const cats = ["todas", ...Object.keys(LOG_CATEGORY_LABEL)];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ScrollText className="size-5" /> Logs do site</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Buscar por usuário, ação, página…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "default" : "outline"}
                onClick={() => setCategory(c)}
              >
                {c === "todas" ? "Todas" : LOG_CATEGORY_LABEL[c]}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={load} className="ml-auto">Atualizar</Button>
          <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + 200)}>Carregar mais</Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>}

        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{LOG_CATEGORY_LABEL[r.category] ?? r.category}</Badge>
                <span className="font-semibold">
                  {r.user_name || r.user_email || "Visitante não identificado"}
                </span>
                <span>{r.action}</span>
                {r.target && <span className="text-muted-foreground truncate">· {r.target}</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground break-all">
                {r.user_email && <>{r.user_email} · </>}
                {r.path && <>página {r.path} · </>}
                {r.details && Object.keys(r.details).length > 0 && JSON.stringify(r.details)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
