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
import { ArrowLeft, Plus, Trash2, Edit, Calendar, DollarSign, User as UserIcon, Building2, Users, Settings } from "lucide-react";

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
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="ligas"><Building2 className="size-4 mr-1.5" />Ligas</TabsTrigger>
            <TabsTrigger value="camed"><Users className="size-4 mr-1.5" />CAMED</TabsTrigger>
            <TabsTrigger value="usuarios"><UserIcon className="size-4 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="config"><Settings className="size-4 mr-1.5" />Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="ligas" className="mt-6"><LeaguesAdmin /></TabsContent>
          <TabsContent value="camed" className="mt-6"><CamedAdmin /></TabsContent>
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

  async function del(l: League) {
    if (!confirm(`Excluir liga ${l.name}?`)) return;
    const { error } = await supabase.from("leagues").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Liga excluída"); reload();
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
          <div><Label>Ícone (URL)</Label><Input value={form.icon_url} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} /></div>
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
  useEffect(() => { setDate(league?.paid_until ?? ""); }, [league]);
  if (!league) return null;
  async function save() {
    const { error } = await supabase.from("leagues").update({ paid_until: date || null }).eq("id", league.id);
    if (error) return toast.error(error.message);
    toast.success("Anuidade atualizada"); setLeague(null); onSaved();
  }
  return (
    <Dialog open={!!league} onOpenChange={(o) => !o && setLeague(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Anuidade — {league.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Define até qual data a anuidade está paga. Após essa data, a liga sai automaticamente da página inicial.</p>
        <div><Label>Paga até</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <DialogFooter><Button onClick={save}><Calendar className="size-4" /> Salvar</Button></DialogFooter>
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
  async function delMember(id: string) {
    if (!confirm("Excluir membro?")) return;
    const { error } = await supabase.from("camed_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
          <div><Label>Imagem (URL)</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></div>
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

  return (
    <div className="space-y-6">
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

      <Button onClick={save} size="lg">Salvar todas as configurações</Button>
    </div>
  );
}
