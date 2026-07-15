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
import { ArrowLeft, Plus, Trash2, Edit, Calendar, DollarSign, User as UserIcon, Building2, Users, Settings, Megaphone, UserCog, GraduationCap, BarChart3, BookOpen } from "lucide-react";
import { CurriculumAdmin } from "@/components/curriculum-admin";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

import { Switch } from "@/components/ui/switch";
import { useServerFn } from "@tanstack/react-start";
import { deleteLeagueWithCancel, cancelLeagueSubscription } from "@/lib/subscription.functions";
import { ImageUpload } from "@/components/image-upload";
import { deleteStorageFiles } from "@/lib/storage-delete.functions";

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
          <TabsList className="grid grid-cols-3 md:grid-cols-7 w-full h-auto">
            <TabsTrigger value="ligas"><Building2 className="size-4 mr-1.5" />Ligas</TabsTrigger>
            <TabsTrigger value="camed"><Users className="size-4 mr-1.5" />CAMED</TabsTrigger>
            <TabsTrigger value="coord"><UserCog className="size-4 mr-1.5" />Coordenação</TabsTrigger>
            <TabsTrigger value="curriculo"><BookOpen className="size-4 mr-1.5" />Currículo</TabsTrigger>
            <TabsTrigger value="ads"><Megaphone className="size-4 mr-1.5" />Anúncios</TabsTrigger>
            <TabsTrigger value="usuarios"><UserIcon className="size-4 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="config"><Settings className="size-4 mr-1.5" />Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="ligas" className="mt-6"><LeaguesAdmin /></TabsContent>
          <TabsContent value="camed" className="mt-6"><CamedAdmin /></TabsContent>
          <TabsContent value="coord" className="mt-6"><CoordinationAdmin /></TabsContent>
          <TabsContent value="curriculo" className="mt-6"><CurriculumAdmin /></TabsContent>
          <TabsContent value="ads" className="mt-6"><AdsAdmin /></TabsContent>
          <TabsContent value="usuarios" className="mt-6"><UsersAdmin /></TabsContent>
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
  const [form, setForm] = useState({ name: "", slug: "", description: "", icon_url: "", theme_color: "#1f5132", president_query: "" });
  useEffect(() => {
    if (league) setForm({ name: league.name, slug: league.slug, description: league.description ?? "", icon_url: league.icon_url ?? "", theme_color: league.theme_color, president_query: "" });
    else setForm({ name: "", slug: "", description: "", icon_url: "", theme_color: "#1f5132", president_query: "" });
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
    const payload: any = {
      name: form.name, slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""), description: form.description,
      icon_url: form.icon_url || null, theme_color: form.theme_color, president_id,
    };
    let err;
    if (league) { ({ error: err } = await supabase.from("leagues").update(payload).eq("id", league.id)); }
    else { ({ error: err } = await supabase.from("leagues").insert(payload)); }
    if (err) return toast.error(err.message);

    if (president_id) {
      await supabase.from("league_memberships").upsert(
        { league_id: league?.id ?? (await supabase.from("leagues").select("id").eq("slug", payload.slug).maybeSingle()).data?.id, user_id: president_id, role: "presidente" },
        { onConflict: "league_id,user_id" }
      );
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
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setUsers(data ?? []));
  }, []);
  const filtered = users.filter((u) => !q || u.username?.includes(q) || u.email?.includes(q));
  return (
    <Card>
      <CardHeader><CardTitle>Usuários cadastrados</CardTitle></CardHeader>
      <CardContent>
        <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
        <div className="space-y-2">
          {filtered.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded border">
              <div><div className="font-bold">{u.username}</div><div className="text-xs text-muted-foreground">{u.email} · {u.phone ?? "—"}</div></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
function AdsAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
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
  return (
    <div className="space-y-6">
      <AdsAnalytics ads={list} />
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Banners exibidos no topo da página inicial. Cliques e visualizações são registrados automaticamente.</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Novo anúncio</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {list.map((a) => {
          const active = a.active && (!a.end_date || new Date(a.end_date) >= new Date()) && new Date(a.start_date) <= new Date();
          return (
            <Card key={a.id}>
              <div className="aspect-[3/1] bg-muted overflow-hidden">{a.image_url && <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />}</div>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-black flex-1">{a.title}</h3>
                  {active ? <Badge className="bg-green-600">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                </div>
                {a.redirect_url && <p className="text-xs text-muted-foreground truncate mt-1">→ {a.redirect_url}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(a.start_date).toLocaleDateString("pt-BR")} → {a.end_date ? new Date(a.end_date).toLocaleDateString("pt-BR") : "sem fim"}
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
      <AdDialog open={open} setOpen={setOpen} row={editing} onSaved={reload} />
    </div>
  );
}

function AdDialog({ open, setOpen, row, onSaved }: any) {
  const [f, setF] = useState({ title: "", image_url: "", redirect_url: "", active: true, start_date: "", end_date: "" });
  useEffect(() => {
    const iso = (v: string | null | undefined) => v ? v.slice(0, 10) : "";
    if (row) setF({ title: row.title, image_url: row.image_url ?? "", redirect_url: row.redirect_url ?? "", active: !!row.active, start_date: iso(row.start_date), end_date: iso(row.end_date) });
    else setF({ title: "", image_url: "", redirect_url: "", active: true, start_date: new Date().toISOString().slice(0, 10), end_date: "" });
  }, [row, open]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.image_url) return toast.error("Envie uma imagem para o anúncio.");
    const payload: any = {
      title: f.title,
      image_url: f.image_url,
      redirect_url: f.redirect_url || null,
      active: f.active,
      start_date: f.start_date ? new Date(f.start_date).toISOString() : new Date().toISOString(),
      end_date: f.end_date ? new Date(f.end_date).toISOString() : null,
    };
    let err;
    if (row) ({ error: err } = await supabase.from("ads").update(payload).eq("id", row.id));
    else ({ error: err } = await supabase.from("ads").insert(payload));
    if (err) return toast.error(err.message);
    toast.success("Salvo"); setOpen(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{row ? "Editar anúncio" : "Novo anúncio"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><ImageUpload label="Imagem (proporção 3:1 recomendada)" folder="ads" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
          <div><Label>URL de redirecionamento (opcional)</Label><Input type="url" value={f.redirect_url} onChange={(e) => setF({ ...f, redirect_url: e.target.value })} placeholder="https://..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
            <div><Label>Término (opcional)</Label><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
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
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from("ad_analytics").select("ad_id, action, user_id, created_at").gte("created_at", since);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [range]);

  const byAd = new Map<string, { title: string; views: number; clicks: number; uniqueViews: Set<string>; uniqueClicks: Set<string> }>();
  ads.forEach((a) => byAd.set(a.id, { title: a.title || "(sem título)", views: 0, clicks: 0, uniqueViews: new Set(), uniqueClicks: new Set() }));
  rows.forEach((r) => {
    const b = byAd.get(r.ad_id); if (!b) return;
    if (r.action === "view") { b.views++; if (r.user_id) b.uniqueViews.add(r.user_id); }
    else if (r.action === "click") { b.clicks++; if (r.user_id) b.uniqueClicks.add(r.user_id); }
  });
  const chartData = Array.from(byAd.entries()).map(([, v]) => ({ name: v.title.slice(0, 20), Views: v.views, Cliques: v.clicks, "Views únicas": v.uniqueViews.size, "Cliques únicos": v.uniqueClicks.size }));
  const totals = chartData.reduce((acc, r) => ({ v: acc.v + r.Views, c: acc.c + r.Cliques, uv: acc.uv + r["Views únicas"], uc: acc.uc + r["Cliques únicos"] }), { v: 0, c: 0, uv: 0, uc: 0 });

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
      </CardContent>
    </Card>
  );
}

