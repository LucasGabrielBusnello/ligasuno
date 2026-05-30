import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createEventCheckout } from "@/lib/events.functions";
import { ArrowLeft, Calendar, Users, Award, Activity, LogIn, Sparkles, BookOpen, Microscope, Heart, Newspaper, HelpCircle, ChevronRight, GraduationCap, ShieldCheck, CreditCard, QrCode } from "lucide-react";

export const Route = createFileRoute("/$slug/")({ component: LeaguePage });

const PILLARS = [
  { key: "ensino", label: "Ensino", icon: BookOpen, default: "Aulas, discussões clínicas e estudos dirigidos." },
  { key: "pesquisa", label: "Pesquisa", icon: Microscope, default: "Projetos científicos e publicações." },
  { key: "extensao", label: "Extensão", icon: Heart, default: "Eventos, ações comunitárias e simpósios." },
];

function LeaguePage() {
  const { slug } = Route.useParams();
  const { user, isAdminMaster } = useAuth();
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [quizSets, setQuizSets] = useState<any[]>([]);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myLeagueIds, setMyLeagueIds] = useState<string[]>([]);
  const [registerEvent, setRegisterEvent] = useState<any | null>(null);
  const [participantEvent, setParticipantEvent] = useState<any | null>(null);
  const [myRegs, setMyRegs] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
      setLeague(data as League | null);
      if (data) {
        const [ev, nw, ac, ct, qs] = await Promise.all([
          supabase.from("league_events").select("*").eq("league_id", data.id).order("created_at", { ascending: false }),
          supabase.from("league_news").select("*").eq("league_id", data.id).order("created_at", { ascending: false }),
          supabase.from("league_activities").select("*").eq("league_id", data.id).order("display_order"),
          supabase.from("league_content").select("content_key,content_value").eq("league_id", data.id),
          supabase.from("league_quiz_sets").select("*").eq("league_id", data.id).order("created_at", { ascending: false }),
        ]);
        setEvents(ev.data ?? []);
        setNews(nw.data ?? []);
        setActivities(ac.data ?? []);
        setQuizSets(qs.data ?? []);
        const m: Record<string, string> = {};
        (ct.data ?? []).forEach((r: any) => { m[r.content_key] = r.content_value; });
        setContent(m);
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!league || !user) return;
    supabase.from("league_memberships").select("role").eq("league_id", league.id).eq("user_id", user.id).maybeSingle().then(({ data }) => setMyRole((data as any)?.role ?? null));
    supabase.from("league_memberships").select("league_id").eq("user_id", user.id).in("role", ["ligante", "diretor", "presidente"]).then(({ data }) => setMyLeagueIds((data ?? []).map((m: any) => m.league_id)));
  }, [league, user]);

  // Carrega inscrições do usuário nesta liga
  useEffect(() => {
    if (!user || events.length === 0) return;
    const ids = events.map(e => e.id);
    supabase.from("event_registrations").select("*").eq("user_id", user.id).in("event_id", ids).then(({ data }) => {
      const m: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { m[r.event_id] = r; });
      setMyRegs(m);
    });
  }, [user, events]);

  // Detecta ?event=ID&paid=1 (confirmação) ou ?event=ID (abrir registro/painel)
  useEffect(() => {
    if (typeof window === "undefined" || events.length === 0) return;
    const url = new URL(window.location.href);
    const evId = url.searchParams.get("event");
    const paid = url.searchParams.get("paid");
    if (!evId) return;
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    if (paid === "1") {
      toast.success("Inscrição confirmada! Confira no Painel do Inscrito.");
      // Atualiza status local imediato
      setMyRegs(prev => ({ ...prev, [evId]: { ...(prev[evId] ?? {}), event_id: evId, status: "paid" } }));
      setParticipantEvent(ev);
    } else if (paid === "0") {
      toast.error("Pagamento cancelado.");
    } else if (user) {
      // Se já inscrito → painel; senão → registro
      const r = myRegs[evId];
      if (r) setParticipantEvent(ev); else setRegisterEvent(ev);
    }
    // Limpa querystring
    url.searchParams.delete("event"); url.searchParams.delete("paid");
    window.history.replaceState({}, "", url.pathname + (url.search ? "?" + url.searchParams.toString() : ""));
  }, [events, user]);

  if (loading) return <div className="p-12 text-center">Carregando...</div>;
  if (!league) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="text-3xl font-black">Liga não encontrada</h1>
      <Button asChild className="mt-6"><Link to="/">Voltar</Link></Button>
    </div>
  );

  const paid = league.paid_until && new Date(league.paid_until) >= new Date();
  const visible = league.published && paid;
  const isPresident = !!(user && league.president_id === user.id);
  const isDiretor = myRole === "diretor";
  const isLigante = myRole === "ligante" || isDiretor || isPresident;

  if (!visible && !isPresident && !isAdminMaster) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <h1 className="text-3xl font-black">Liga indisponível</h1>
        <p className="text-muted-foreground mt-2">Esta liga ainda não está publicada.</p>
        <Button asChild className="mt-6"><Link to="/">Voltar</Link></Button>
      </div>
    );
  }

  const themedHero: React.CSSProperties = {
    background: `
      radial-gradient(800px 400px at 20% 20%, ${league.theme_color}55, transparent 60%),
      radial-gradient(700px 350px at 80% 60%, ${league.theme_color}40, transparent 60%),
      linear-gradient(135deg, ${league.theme_color} 0%, ${darken(league.theme_color)} 100%)`,
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Hub</Link>
          <div className="flex items-center gap-2 min-w-0">
            {league.icon_url && <img src={league.icon_url} className="size-8 rounded" alt="" />}
            <span className="font-black truncate">{league.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isLigante && <Button asChild size="sm" variant="outline"><Link to="/ligante/$slug" params={{ slug }}><GraduationCap className="size-4" /> Ligante</Link></Button>}
            {(isDiretor || isPresident) && <Button asChild size="sm" variant="outline"><Link to="/diretor/$slug" params={{ slug }}><ShieldCheck className="size-4" /> Diretor</Link></Button>}
            {isPresident && <Button asChild size="sm"><Link to="/presidente/$slug" params={{ slug }}>Presidente</Link></Button>}
          </div>
        </div>
      </header>

      {/* HERO bonito com tema da liga */}
      <section className="text-white relative overflow-hidden" style={themedHero}>
        <div className="max-w-7xl mx-auto px-4 py-24 md:py-32 text-center relative z-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-widest mb-6">
            <Sparkles className="size-3.5" /> Liga Acadêmica · Unochapecó
          </div>
          {league.icon_url && (
            <img src={league.icon_url} alt={league.name} className="mx-auto size-28 rounded-3xl border-4 border-white/20 shadow-2xl bg-white/10 backdrop-blur object-contain mb-6" />
          )}
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 drop-shadow-2xl">{league.name}</h1>
          {league.description && <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/90 font-medium">{league.description}</p>}
          {!visible && <Badge variant="destructive" className="mt-6">Preview — não publicada</Badge>}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)] pointer-events-none" />
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <Tabs defaultValue="sobre" className="w-full">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto p-1">
            <TabsTrigger value="sobre" className="py-2.5"><Award className="size-4 mr-1.5" />Sobre</TabsTrigger>
            <TabsTrigger value="eventos" className="py-2.5"><Calendar className="size-4 mr-1.5" />Eventos</TabsTrigger>
            <TabsTrigger value="news" className="py-2.5"><Newspaper className="size-4 mr-1.5" />Notícias</TabsTrigger>
            <TabsTrigger value="atividades" className="py-2.5"><Activity className="size-4 mr-1.5" />Atividades</TabsTrigger>
            <TabsTrigger value="quizzes" className="py-2.5"><HelpCircle className="size-4 mr-1.5" />Quizzes</TabsTrigger>
          </TabsList>

          <TabsContent value="sobre" className="mt-8">
            <div className="grid md:grid-cols-3 gap-6">
              {PILLARS.map((p) => {
                const Icon = p.icon;
                return (
                  <Card key={p.key} className="overflow-hidden hover:-translate-y-1 transition-all duration-300 group">
                    <div className="h-2" style={{ background: `linear-gradient(90deg, ${league.theme_color}, ${league.theme_color}88)` }} />
                    <CardContent className="p-6">
                      <div className="size-14 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform" style={{ background: league.theme_color }}>
                        <Icon className="size-7" />
                      </div>
                      <h3 className="font-black text-xl mb-2">{p.label}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{content[p.key] || p.default}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="eventos" className="mt-8">
            {(() => {
              const visibleEvents = events.filter(e => e.published !== false || isPresident || isAdminMaster);
              if (visibleEvents.length === 0) return <Empty icon={<Calendar className="size-12" />} title="Nenhum evento publicado" />;
              return (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleEvents.map((e) => (
                    <Card key={e.id} className="overflow-hidden hover:-translate-y-1 transition-all">
                      <div className="aspect-video bg-muted relative">
                        {e.image_url ? <img src={e.image_url} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0" style={{ background: league.theme_color }} />}
                      </div>
                      <CardContent className="p-5">
                        <h3 className="font-black">{e.title}</h3>
                        {e.event_date && <p className="text-xs text-muted-foreground mt-1">{new Date(e.event_date).toLocaleDateString("pt-BR")}</p>}
                        {e.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{e.description}</p>}
                        {(() => {
                          const reg = myRegs[e.id];
                          if (reg) {
                            return <Button onClick={() => setParticipantEvent(e)} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">Acessar Painel do Inscrito <ChevronRight className="size-4" /></Button>;
                          }
                          if (e.accepting_registrations === false) return <Button disabled className="w-full mt-4">Inscrições encerradas</Button>;
                          if (!user) return <Button onClick={() => nav({ to: "/auth" })} variant="outline" className="w-full mt-4"><LogIn className="size-4" /> Entrar para se inscrever</Button>;
                          return <Button onClick={() => setRegisterEvent(e)} className="w-full mt-4" style={{ background: league.theme_color }}>Inscreva-se! <ChevronRight className="size-4" /></Button>;
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="news" className="mt-8">
            {news.length === 0 ? (
              <Empty icon={<Newspaper className="size-12" />} title="Nenhuma notícia publicada" />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.map((n) => (
                  <Card key={n.id} className="overflow-hidden hover:-translate-y-1 transition-all group">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {n.image_url ? <img src={n.image_url} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="absolute inset-0" style={{ background: league.theme_color }} />}
                      <Badge className="absolute top-3 left-3" style={{ background: league.theme_color }}>{n.category}</Badge>
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-black text-lg">{n.title}</h3>
                      {n.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{n.excerpt}</p>}
                      {n.link && (
                        <Button asChild variant="outline" className="w-full mt-4">
                          <a href={n.link} target="_blank" rel="noreferrer">Ler artigo <ChevronRight className="size-4" /></a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="atividades" className="mt-8">
            {activities.length === 0 ? (
              <Empty icon={<Activity className="size-12" />} title="Nenhuma atividade registrada" />
            ) : (
              <Carousel className="w-full">
                <CarouselContent>
                  {activities.map((a) => (
                    <CarouselItem key={a.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                      <Card className="overflow-hidden h-full">
                        <div className="aspect-video bg-muted"><img src={a.image_url} className="w-full h-full object-cover" /></div>
                        {a.caption && <CardContent className="p-4"><p className="text-sm text-muted-foreground">{a.caption}</p></CardContent>}
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious /><CarouselNext />
              </Carousel>
            )}
          </TabsContent>

          <TabsContent value="quizzes" className="mt-8">
            {quizSets.length === 0 ? (
              <Empty icon={<HelpCircle className="size-12" />} title="Nenhum quiz publicado" />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizSets.map((q) => (
                  <Card key={q.id} className="overflow-hidden hover:-translate-y-1 transition-all">
                    <div className="h-2" style={{ background: league.theme_color }} />
                    <CardContent className="p-5">
                      <h3 className="font-black text-lg">{q.title}</h3>
                      {q.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{q.description}</p>}
                      {user ? (
                        isLigante ? (
                          <Button asChild className="w-full mt-4" style={{ background: league.theme_color }}>
                            <Link to="/ligante/$slug" params={{ slug }}>Acessar quiz <ChevronRight className="size-4" /></Link>
                          </Button>
                        ) : (
                          <Button disabled className="w-full mt-4">Apenas ligantes</Button>
                        )
                      ) : (
                        <Button onClick={() => nav({ to: "/auth" })} variant="outline" className="w-full mt-4">
                          <LogIn className="size-4" /> Entrar para responder
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {!user && (
          <Card className="mt-12 p-8 text-center">
            <p className="text-muted-foreground mb-4">Faça login para acessar áreas exclusivas, quizzes e mais.</p>
            <Button onClick={() => nav({ to: "/auth" })}><LogIn className="size-4" /> Entrar</Button>
          </Card>
        )}
      </main>
      <RegisterEventDialog event={registerEvent} onClose={() => setRegisterEvent(null)} myLeagueIds={myLeagueIds} leagueId={league.id} />
    </div>
  );
}

function RegisterEventDialog({ event, onClose, myLeagueIds, leagueId }: { event: any; onClose: () => void; myLeagueIds: string[]; leagueId: string }) {
  const checkout = useServerFn(createEventCheckout);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: "", social_name: "", cpf: "", course: "medicina" as const });
  const [method, setMethod] = useState<"card" | "pix">("card");

  useEffect(() => { if (event) { setStep(1); setForm({ full_name: "", social_name: "", cpf: "", course: "medicina" }); setMethod("card"); } }, [event]);

  const { price, label, discount } = useMemo(() => {
    if (!event) return { price: 0, label: "", discount: null as string | null };
    const partnerIds: string[] = event.partner_league_ids ?? [];
    const isLigante = myLeagueIds.includes(leagueId);
    const isPartner = !isLigante && myLeagueIds.some(id => partnerIds.includes(id));
    if (isLigante) return { price: Number(event.price_ligante) || 0, label: "Ligante", discount: "Desconto aplicado: Ligante" };
    if (isPartner) return { price: Number(event.price_partner) || 0, label: "Liga parceira", discount: "Desconto aplicado: Liga parceira" };
    return { price: Number(event.price_visitor) || 0, label: "Não-ligante", discount: null };
  }, [event, myLeagueIds, leagueId]);

  if (!event) return null;

  async function submit() {
    if (!form.full_name || form.full_name.length < 2) return toast.error("Informe seu nome completo");
    if (!form.cpf || form.cpf.length < 11) return toast.error("Informe um CPF válido");
    try {
      setSubmitting(true);
      const res = await checkout({ data: {
        event_id: event.id,
        full_name: form.full_name,
        social_name: form.social_name || null,
        cpf: form.cpf,
        course: form.course,
        payment_method: method,
        origin_url: window.location.origin,
      }});
      if ((res as any).free) { toast.success("Inscrição confirmada!"); onClose(); return; }
      if ((res as any).url) window.location.href = (res as any).url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar inscrição");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={!!event} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant={step === 1 ? "default" : "secondary"}>1. Dados</Badge>
            <Badge variant={step === 2 ? "default" : "secondary"}>2. Pagamento</Badge>
          </div>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Nome social (opcional)</Label><Input value={form.social_name} onChange={(e) => setForm({ ...form, social_name: e.target.value })} /></div>
            <div><Label>CPF *</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
            <div>
              <Label>Curso *</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value as any })}>
                <option value="medicina">Medicina</option>
                <option value="enfermagem">Enfermagem</option>
                <option value="egresso_medicina">Egresso de Medicina</option>
                <option value="outro">Outro curso</option>
                <option value="egresso_outro">Egresso de outro curso</option>
              </select>
            </div>
            <DialogFooter><Button onClick={() => setStep(2)}>Continuar <ChevronRight className="size-4" /></Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-4 text-center space-y-1">
                <div className="text-xs text-muted-foreground">Categoria: {label}</div>
                <div className="text-3xl font-black">R$ {price.toFixed(2)}</div>
                {discount && <Badge variant="secondary" className="mt-1">{discount}</Badge>}
              </CardContent>
            </Card>
            {price > 0 && (
              <div>
                <Label className="mb-2 block">Método de pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMethod("card")} className={`p-4 rounded border flex flex-col items-center gap-2 text-sm ${method === "card" ? "border-primary bg-primary/5" : ""}`}>
                    <CreditCard className="size-6" /> Cartão
                  </button>
                  <button type="button" onClick={() => setMethod("pix")} className={`p-4 rounded border flex flex-col items-center gap-2 text-sm ${method === "pix" ? "border-primary bg-primary/5" : ""}`}>
                    <QrCode className="size-6" /> Pix
                  </button>
                </div>
              </div>
            )}
            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Processando..." : price === 0 ? "Confirmar inscrição" : "Pagar e inscrever"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Empty({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Card className="p-12 text-center">
      <div className="mx-auto size-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">{icon}</div>
      <h3 className="text-xl font-black">{title}</h3>
    </Card>
  );
}

function darken(hex: string): string {
  try {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    const r = Math.max(0, ((n >> 16) & 255) - 50);
    const g = Math.max(0, ((n >> 8) & 255) - 50);
    const b = Math.max(0, (n & 255) - 50);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  } catch { return hex; }
}
