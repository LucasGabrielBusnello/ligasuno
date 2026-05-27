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
import { ArrowLeft, Plus, Trash2, Calendar, Settings, Users, Bell, DollarSign, BookOpen, Newspaper, HelpCircle, Image as ImageIcon, CheckCircle2 } from "lucide-react";

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
                <p className="font-black text-emerald-700 dark:text-emerald-400">Anuidade ativa</p>
                <p className="text-sm text-muted-foreground">Sua liga está publicada até <span className="font-bold">{paidUntilFmt}</span>.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-black text-destructive">Anuidade não está em dia</p>
                <p className="text-sm text-muted-foreground">A liga não aparecerá na página inicial até a anuidade ser paga.</p>
              </div>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => toast.info("Integração de pagamento Stripe em breve")}>
                <DollarSign className="size-4" /> Pagar Anuidade
              </Button>
            </CardContent>
          </Card>
        )}

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

        <Card className="mt-6">
          <CardHeader><CardTitle>Valores da anuidade</CardTitle></CardHeader>
          <CardContent>
            {settings && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Card className="border-primary"><CardContent className="p-4 text-center">
                  <Badge className="mb-2">PIX</Badge>
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
    toast.success("Criado"); setOpen(false); setF({ title: "", description: "", image_url: "", registration_link: "" }); reload();
  }
  async function del(id: string) { if (!confirm("Excluir?")) return; await supabase.from("league_events").delete().eq("id", id); reload(); }
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
  const reload = async () => {
    const { data } = await supabase.from("league_memberships").select("*, profiles!inner(username,email)").eq("league_id", league.id);
    setMembers(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
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
