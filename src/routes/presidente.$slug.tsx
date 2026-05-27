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
import { ArrowLeft, Plus, Trash2, Calendar, Settings, Users, Bell, DollarSign } from "lucide-react";

export const Route = createFileRoute("/presidente/$slug")({ component: PresidentePage });

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

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/auth" });
  }, [loading, user]);

  if (!league || !user) return <div className="p-12 text-center">Carregando...</div>;
  const isOwner = league.president_id === user.id || isAdminMaster;
  if (!isOwner) return <div className="p-12 text-center"><h1 className="text-2xl font-black">Acesso negado</h1></div>;

  const paid = league.paid_until && new Date(league.paid_until) >= new Date();

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

        {!paid && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-black text-destructive">Anuidade não está em dia</p>
                <p className="text-sm text-muted-foreground">A liga não aparecerá na página inicial até que a anuidade seja paga.</p>
              </div>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => toast.info("Integração de pagamento Stripe será ativada em uma próxima etapa")}>
                <DollarSign className="size-4" /> Pagar Anuidade
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="config">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="config"><Settings className="size-4 mr-1.5" />Configurações</TabsTrigger>
            <TabsTrigger value="eventos"><Calendar className="size-4 mr-1.5" />Eventos</TabsTrigger>
            <TabsTrigger value="membros"><Users className="size-4 mr-1.5" />Membros</TabsTrigger>
            <TabsTrigger value="avisos"><Bell className="size-4 mr-1.5" />Avisos</TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="mt-6"><ConfigTab league={league} setLeague={setLeague} paid={!!paid} /></TabsContent>
          <TabsContent value="eventos" className="mt-6"><EventsTab league={league} /></TabsContent>
          <TabsContent value="membros" className="mt-6"><MembersTab league={league} /></TabsContent>
          <TabsContent value="avisos" className="mt-6"><NotifTab league={league} /></TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader><CardTitle>Anuidade</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">Paga até: <span className="font-black">{league.paid_until ?? "—"}</span></p>
            {settings && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <Card className="border-primary"><CardContent className="p-4 text-center">
                  <Badge className="mb-2">PIX · {Math.round((1 - settings.annual_fee_pix_monthly / settings.annual_fee_credit_monthly) * 100)}% off</Badge>
                  <div className="text-3xl font-black">R$ {Number(settings.annual_fee_pix_monthly).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
                  <div className="text-xs text-muted-foreground">R$ {(Number(settings.annual_fee_pix_monthly) * 12).toFixed(2)} anual</div>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <Badge variant="secondary" className="mb-2">Crédito até 12x</Badge>
                  <div className="text-3xl font-black">R$ {Number(settings.annual_fee_credit_monthly).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
                  <div className="text-xs text-muted-foreground">R$ {(Number(settings.annual_fee_credit_monthly) * 12).toFixed(2)} anual</div>
                </CardContent></Card>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">⚠ Pagamentos não são reembolsáveis.</p>
          </CardContent>
        </Card>
      </main>
    </div>
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
    if (v && !paid) return toast.error("Você precisa realizar o pagamento para poder publicar");
    setPub(v);
    const { error } = await supabase.from("leagues").update({ published: v }).eq("id", league.id);
    if (error) { setPub(!v); return toast.error(error.message); }
    toast.success(v ? "Site publicado" : "Site despublicado");
  }
  return (
    <Card><CardContent className="p-6 space-y-4">
      <div className="flex items-center justify-between p-4 rounded border">
        <div><div className="font-black">Site publicado</div><div className="text-sm text-muted-foreground">Quando ativado, aparece na página inicial.</div></div>
        <Switch checked={pub} onCheckedChange={togglePub} />
      </div>
      <div><Label>Nome da liga</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Ícone (URL)</Label><Input value={f.icon_url} onChange={(e) => setF({ ...f, icon_url: e.target.value })} /></div>
      <div><Label>Cor tema</Label><Input type="color" value={f.theme_color} onChange={(e) => setF({ ...f, theme_color: e.target.value })} /></div>
      <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Button onClick={save}>Salvar</Button>
    </CardContent></Card>
  );
}

function EventsTab({ league }: any) {
  const [events, setEvents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", image_url: "", registration_link: "" });

  const reload = async () => {
    const { data } = await supabase.from("league_events").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setEvents(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("league_events").insert({ ...f, league_id: league.id, image_url: f.image_url || null, registration_link: f.registration_link || null });
    if (error) return toast.error(error.message);
    toast.success("Evento criado"); setOpen(false); setF({ title: "", description: "", image_url: "", registration_link: "" }); reload();
  }
  async function del(id: string) {
    if (!confirm("Excluir evento?")) return;
    await supabase.from("league_events").delete().eq("id", id); reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="size-4" /> Novo evento</Button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {events.map((e) => (
          <Card key={e.id}><CardContent className="p-4 flex gap-3">
            {e.image_url && <img src={e.image_url} className="size-16 rounded object-cover" />}
            <div className="flex-1"><h4 className="font-black">{e.title}</h4><p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p></div>
            <Button size="sm" variant="destructive" onClick={() => del(e.id)}><Trash2 className="size-3" /></Button>
          </CardContent></Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><Label>Imagem (URL)</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></div>
            <div><Label>Link de inscrição</Label><Input value={f.registration_link} onChange={(e) => setF({ ...f, registration_link: e.target.value })} /></div>
            <DialogFooter><Button type="submit">Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersTab({ league }: any) {
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ligante" | "diretor">("ligante");

  const reload = async () => {
    const { data } = await supabase.from("league_memberships").select("*, profiles!inner(username,email)").eq("league_id", league.id);
    setMembers(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);

  async function add() {
    if (!query.trim()) return;
    const q = query.trim();
    const { data: prof } = await supabase.from("profiles").select("id").or(`email.ilike.${q},username.ilike.${q}`).maybeSingle();
    if (!prof) return toast.error("Esse usuário não existe");
    const { error } = await supabase.from("league_memberships").upsert(
      { league_id: league.id, user_id: prof.id, role },
      { onConflict: "league_id,user_id" }
    );
    if (error) return toast.error(error.message);
    toast.success("Adicionado"); setQuery(""); reload();
  }
  async function remove(id: string) { await supabase.from("league_memberships").delete().eq("id", id); reload(); }

  return (
    <Card><CardContent className="p-6 space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input className="flex-1 min-w-[200px]" placeholder="Email ou usuário" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="px-3 rounded border bg-background" value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="ligante">Ligante</option><option value="diretor">Diretor</option>
        </select>
        <Button onClick={add}>Adicionar</Button>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 rounded border">
            <div><span className="font-bold">{m.profiles?.username}</span> <Badge variant="secondary" className="ml-2">{m.role}</Badge></div>
            {m.role !== "presidente" && <Button size="sm" variant="destructive" onClick={() => remove(m.id)}><Trash2 className="size-3" /></Button>}
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}

function NotifTab({ league }: any) {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ title: "", message: "" });
  const reload = async () => {
    const { data } = await supabase.from("league_notifications").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);

  async function send() {
    if (!f.title || !f.message) return;
    const { error } = await supabase.from("league_notifications").insert({ ...f, league_id: league.id });
    if (error) return toast.error(error.message);
    toast.success("Aviso enviado"); setF({ title: "", message: "" }); reload();
  }
  return (
    <Card><CardContent className="p-6 space-y-4">
      <div><Label>Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div><Label>Mensagem</Label><Textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
      <Button onClick={send}><Bell className="size-4" /> Enviar aviso global</Button>
      <div className="space-y-2 pt-4 border-t">
        {list.map((n) => (
          <div key={n.id} className="p-3 rounded border"><div className="font-bold">{n.title}</div><div className="text-sm text-muted-foreground">{n.message}</div></div>
        ))}
      </div>
    </CardContent></Card>
  );
}
