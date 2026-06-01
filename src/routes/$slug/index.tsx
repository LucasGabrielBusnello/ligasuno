import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";
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
import { verifySelectionPayment } from "@/lib/selection.functions";
import { SelectionRegisterDialog, SelectionAccessDialog } from "@/components/selection-public";
import { ArrowLeft, Calendar, Users, Award, Activity, LogIn, Sparkles, BookOpen, Microscope, Heart, Newspaper, HelpCircle, ChevronRight, GraduationCap, ShieldCheck, CreditCard, QrCode, CheckCircle, XCircle, ClipboardList } from "lucide-react";

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
  const verifySelection = useServerFn(verifySelectionPayment);
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
  const [regsLoaded, setRegsLoaded] = useState(false);
  const [activeQuizSet, setActiveQuizSet] = useState<any | null>(null);
  const [mySelectionReg, setMySelectionReg] = useState<any | null>(null);
  const [selectionRegOpen, setSelectionRegOpen] = useState(false);
  const [selectionPanelOpen, setSelectionPanelOpen] = useState(false);

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
    if (!user || events.length === 0) { setRegsLoaded(false); return; }
    const ids = events.map(e => e.id);
    supabase.from("event_registrations").select("*").eq("user_id", user.id).in("event_id", ids).then(({ data }) => {
      const m: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { m[r.event_id] = r; });
      setMyRegs(m);
      setRegsLoaded(true);
    });
  }, [user, events]);

  // Carrega inscrição do usuário no processo seletivo desta liga
  useEffect(() => {
    if (!user || !league) { setMySelectionReg(null); return; }
    supabase.from("league_selection_registrations").select("*").eq("league_id", league.id).eq("user_id", user.id).maybeSingle().then(({ data }) => setMySelectionReg(data));
  }, [user, league]);

  // Detecta ?selection_paid=1 — faz polling enquanto webhook não confirma
  const [verifyingSelection, setVerifyingSelection] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !league || !user) return;
    const url = new URL(window.location.href);
    const sp = url.searchParams.get("selection_paid");
    if (!sp) return;
    url.searchParams.delete("selection_paid");
    window.history.replaceState({}, "", url.pathname + (url.search ? "?" + url.searchParams.toString() : ""));
    if (sp === "0") { toast.error("Pagamento cancelado."); return; }
    if (sp !== "1") return;

    let cancelled = false;
    setVerifyingSelection(true);
    toast.success("Pagamento recebido! Confirmando inscrição...");
    (async () => {
      for (let i = 0; i < 12 && !cancelled; i++) {
        const { data } = await supabase.from("league_selection_registrations")
          .select("*").eq("league_id", league.id).eq("user_id", user.id).maybeSingle();
        if (data) {
          setMySelectionReg(data);
          if ((data as any).status === "paid") {
            setSelectionPanelOpen(true);
            setVerifyingSelection(false);
            return;
          }
          // Fallback: pergunta direto ao MP se já aprovou
          try {
            const r: any = await verifySelection({ data: { registration_id: (data as any).id } } as any);
            if (r?.status === "paid") {
              const { data: fresh } = await supabase.from("league_selection_registrations")
                .select("*").eq("id", (data as any).id).maybeSingle();
              if (fresh) setMySelectionReg(fresh);
              setSelectionPanelOpen(true);
              setVerifyingSelection(false);
              return;
            }
          } catch { /* ignora e segue tentando */ }
        }
        await new Promise(r => setTimeout(r, 2500));
      }
      if (!cancelled) {
        setVerifyingSelection(false);
        toast.message("Pagamento ainda em processamento. Atualize a página em alguns instantes.");
      }
    })();
    return () => { cancelled = true; };
  }, [league, user]);


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
    } else if (user && regsLoaded) {
      // Se já inscrito → painel; senão → registro
      const r = myRegs[evId];
      if (r) setParticipantEvent(ev); else setRegisterEvent(ev);
    } else {
      return;
    }
    // Limpa querystring
    url.searchParams.delete("event"); url.searchParams.delete("paid");
    window.history.replaceState({}, "", url.pathname + (url.search ? "?" + url.searchParams.toString() : ""));
  }, [events, user, myRegs, regsLoaded]);

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
          {(league as any).selection_open && !isLigante && (() => {
            const deadlinePassed = (league as any).selection_deadline && new Date((league as any).selection_deadline) < new Date();
            if (mySelectionReg && mySelectionReg.status === "paid") {
              return <Button size="lg" className="mt-8 bg-white text-foreground hover:bg-white/90" onClick={() => setSelectionPanelOpen(true)}><ClipboardList className="size-5" /> Acessar minha inscrição</Button>;
            }
            if (mySelectionReg && mySelectionReg.status !== "paid") {
              return <Button size="lg" className="mt-8 bg-white text-foreground hover:bg-white/90" disabled={verifyingSelection} onClick={async () => {
                setVerifyingSelection(true);
                try {
                  const r: any = await verifySelection({ data: { registration_id: mySelectionReg.id } } as any);
                  const { data: fresh } = await supabase.from("league_selection_registrations").select("*").eq("id", mySelectionReg.id).maybeSingle();
                  if (fresh) setMySelectionReg(fresh);
                  if (r?.status === "paid") { toast.success("Pagamento confirmado!"); setSelectionPanelOpen(true); }
                  else toast.message("Pagamento ainda não confirmado pelo Mercado Pago.");
                } catch (e: any) { toast.error(e?.message ?? "Falha ao verificar"); }
                finally { setVerifyingSelection(false); }
              }}><ClipboardList className="size-5" /> {verifyingSelection ? "Verificando pagamento..." : "Confirmar pagamento da inscrição"}</Button>;
            }
            if (deadlinePassed) return <Button size="lg" disabled className="mt-8">Inscrições encerradas</Button>;
            if (!user) return <Button size="lg" className="mt-8 bg-white text-foreground hover:bg-white/90" onClick={() => nav({ to: "/auth" })}><LogIn className="size-5" /> Entrar para se inscrever na prova</Button>;
            return <Button size="lg" className="mt-8 bg-white text-foreground hover:bg-white/90" onClick={() => setSelectionRegOpen(true)}><ClipboardList className="size-5" /> Inscreva-se no processo seletivo</Button>;
          })()}
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
                          <Button className="w-full mt-4" style={{ background: league.theme_color }} onClick={() => setActiveQuizSet(q)}>
                            Acessar quiz <ChevronRight className="size-4" />
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
      <RegisterEventDialog event={registerEvent} onClose={() => setRegisterEvent(null)} myLeagueIds={myLeagueIds} leagueId={league.id} onSuccess={(reg) => { if (reg) setMyRegs(prev => ({ ...prev, [reg.event_id]: reg })); }} />
      <ParticipantPanelDialog event={participantEvent} registration={participantEvent ? myRegs[participantEvent.id] : null} league={league} onClose={() => setParticipantEvent(null)} />
      <PublicQuizDialog quizSet={activeQuizSet} league={league} userId={user?.id ?? null} onClose={() => setActiveQuizSet(null)} />
      <SelectionRegisterDialog league={league} open={selectionRegOpen} onClose={() => setSelectionRegOpen(false)} defaultEmail={user?.email ?? undefined} onPaid={() => { supabase.from("league_selection_registrations").select("*").eq("league_id", league.id).eq("user_id", user?.id ?? "").maybeSingle().then(({ data }) => { setMySelectionReg(data); if (data) setSelectionPanelOpen(true); }); }} />
      <SelectionAccessDialog league={league} registration={mySelectionReg} open={selectionPanelOpen} onClose={() => setSelectionPanelOpen(false)} />
    </div>
  );
}

function RegisterEventDialog({ event, onClose, myLeagueIds, leagueId, onSuccess }: { event: any; onClose: () => void; myLeagueIds: string[]; leagueId: string; onSuccess?: (reg: any) => void }) {
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
    const normalizedCpf = normalizeCpf(form.cpf);
    if (!form.full_name || form.full_name.length < 2) return toast.error("Informe seu nome completo");
    if (!isValidCPF(normalizedCpf)) return toast.error("Informe um CPF válido");
    try {
      setSubmitting(true);
      const res = await checkout({ data: {
        event_id: event.id,
        full_name: form.full_name,
        social_name: form.social_name || null,
        cpf: normalizedCpf,
        course: form.course,
        payment_method: method,
        origin_url: window.location.origin,
      }});
      if ((res as any).free) { toast.success("Inscrição confirmada!"); onSuccess?.({ event_id: event.id, status: "paid", paid_price: 0, full_name: form.full_name }); onClose(); return; }
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
            <div><Label>CPF *</Label><Input inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/[^\d.-]/g, "") })} placeholder="000.000.000-00" /></div>
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
            <DialogFooter><Button onClick={() => {
              if (!form.full_name || form.full_name.length < 2) return toast.error("Informe seu nome completo");
              if (!isValidCPF(normalizeCpf(form.cpf))) return toast.error("Informe um CPF válido");
              setStep(2);
            }}>Continuar <ChevronRight className="size-4" /></Button></DialogFooter>
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


function ParticipantPanelDialog({ event, registration, league, onClose }: { event: any; registration: any; league: League; onClose: () => void }) {
  if (!event) return null;
  const reg = registration;
  return (
    <Dialog open={!!event} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Painel do Inscrito</DialogTitle>
          <Badge className="w-fit mt-1" style={{ background: league.theme_color }}>{event.title}</Badge>
        </DialogHeader>
        {event.image_url && <img src={event.image_url} className="w-full aspect-video object-cover rounded" />}
        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="info">Evento</TabsTrigger>
            <TabsTrigger value="schedule">Cronograma</TabsTrigger>
            <TabsTrigger value="mc">Minicursos</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-3 pt-3">
            {event.event_date && (
              <div className="flex items-center gap-2 text-sm"><Calendar className="size-4 text-muted-foreground" /><span><b>Data:</b> {new Date(event.event_date).toLocaleDateString("pt-BR")}</span></div>
            )}
            {event.description && <div><div className="text-xs font-black uppercase text-muted-foreground mb-1">Descrição</div><p className="text-sm whitespace-pre-line">{event.description}</p></div>}
            {reg && (
              <Card className="border-emerald-500/40 bg-emerald-500/5"><CardContent className="p-4 space-y-1">
                <div className="text-xs text-muted-foreground">Status da inscrição</div>
                <div className="flex items-center justify-between gap-2">
                  <Badge className={reg.status === "paid" ? "bg-emerald-600" : "bg-amber-600"}>{reg.status === "paid" ? "Inscrição confirmada" : "Pagamento pendente"}</Badge>
                  <div className="text-lg font-black">R$ {Number(reg.paid_price ?? 0).toFixed(2)}</div>
                </div>
                {reg.discount_reason && <div className="text-[11px] text-muted-foreground">{reg.discount_reason}</div>}
              </CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="schedule" className="pt-3">
            {event.schedule ? (
              <p className="text-sm whitespace-pre-line p-3 rounded border bg-muted/30">{event.schedule}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">O presidente ainda não publicou o cronograma.</p>
            )}
          </TabsContent>
          <TabsContent value="mc" className="pt-3">
            <ParticipantMinicourses event={event} isPaid={reg?.status === "paid"} />
          </TabsContent>
        </Tabs>
        <DialogFooter><Button onClick={onClose} variant="outline">Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantMinicourses({ event, isPaid }: { event: any; isPaid: boolean }) {
  const { user } = useAuth();
  const [list, setList] = useState<any[] | null>(null);
  const [myRegs, setMyRegs] = useState<Record<string, any>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [payOpen, setPayOpen] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { data: mcs } = await supabase
      .from("league_minicourses")
      .select("*")
      .eq("event_id", event.id)
      .eq("published", true)
      .order("starts_at", { ascending: true });
    setList(mcs ?? []);
    const ids = (mcs ?? []).map((m: any) => m.id);
    if (ids.length === 0) { setMyRegs({}); setCounts({}); return; }
    const [{ data: mine }, { data: all }] = await Promise.all([
      user ? supabase.from("minicourse_registrations").select("*").eq("user_id", user.id).in("minicourse_id", ids) : Promise.resolve({ data: [] as any[] }) as any,
      supabase.from("minicourse_registrations").select("minicourse_id,status").in("minicourse_id", ids),
    ]);
    const m: Record<string, any> = {};
    (mine ?? []).forEach((r: any) => { m[r.minicourse_id] = r; });
    setMyRegs(m);
    const c: Record<string, number> = {};
    (all ?? []).forEach((r: any) => { if (r.status === "paid" || r.status === "pending") c[r.minicourse_id] = (c[r.minicourse_id] ?? 0) + 1; });
    setCounts(c);
  }
  useEffect(() => { reload(); }, [event.id, user?.id]);

  // Detecta retorno do checkout: ?mc_paid=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("mc_paid") === "1") {
      toast.success("Inscrição no minicurso confirmada!");
      u.searchParams.delete("mc_paid");
      window.history.replaceState({}, "", u.toString());
      reload();
    }
  }, []);

  async function register(mc: any, method: "card" | "pix") {
    if (!user) { toast.error("Faça login primeiro"); return; }
    setBusy(true);
    try {
      const { createMinicourseCheckout } = await import("@/lib/minicourses.functions");
      const res: any = await createMinicourseCheckout({
        data: { minicourse_id: mc.id, payment_method: method, origin_url: window.location.origin },
      } as any);
      if (res?.free) {
        toast.success("Inscrição confirmada!");
        setPayOpen(null);
        reload();
      } else if (res?.url) {
        window.location.href = res.url;
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao inscrever");
    } finally {
      setBusy(false);
    }
  }

  if (!isPaid) {
    return <p className="text-sm text-muted-foreground italic">Confirme o pagamento da inscrição do evento para liberar os minicursos.</p>;
  }
  if (list === null) return <p className="text-sm text-muted-foreground">Carregando minicursos...</p>;
  if (list.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhum minicurso publicado ainda.</p>;

  return (
    <div className="space-y-2">
      {list.map((mc) => {
        const mine = myRegs[mc.id];
        const used = counts[mc.id] ?? 0;
        const cap = Number(mc.max_registrations) || 0;
        const full = cap > 0 && used >= cap && !mine;
        return (
          <Card key={mc.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-black">{mc.title}</h5>
                    <Badge variant={mc.is_free ? "secondary" : "default"} className="text-[10px]">
                      {mc.is_free ? "Gratuito" : `R$ ${Number(mc.price).toFixed(2)}`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">👤 {mc.instructor}</p>
                  <p className="text-xs text-muted-foreground">🗓️ {new Date(mc.starts_at).toLocaleString("pt-BR")}</p>
                  {mc.location && <p className="text-xs text-muted-foreground">📍 {mc.location}</p>}
                  {mc.description && <p className="text-xs mt-1 whitespace-pre-line">{mc.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-muted-foreground mb-1">{used}/{cap || "∞"} vagas</div>
                  {mine?.status === "paid" ? (
                    <Badge className="bg-emerald-600">Inscrito</Badge>
                  ) : mine?.status === "pending" ? (
                    <Badge variant="secondary">Pagamento pendente</Badge>
                  ) : full ? (
                    <Badge variant="outline">Esgotado</Badge>
                  ) : mc.is_free ? (
                    <Button size="sm" disabled={busy} onClick={() => register(mc, "card")}>Inscrever-se</Button>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => setPayOpen(mc)}>Inscrever-se</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!payOpen} onOpenChange={(v) => !v && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagamento · {payOpen?.title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Valor: <b>R$ {Number(payOpen?.price ?? 0).toFixed(2)}</b></p>
          <p className="text-xs text-muted-foreground">Escolha o método de pagamento:</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => register(payOpen, "pix")}>
              <QrCode className="size-4 mr-1" /> Pix
            </Button>
            <Button disabled={busy} onClick={() => register(payOpen, "card")}>
              <CreditCard className="size-4 mr-1" /> Cartão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function PublicQuizDialog({ quizSet, league, userId, onClose }: { quizSet: any; league: League; userId: string | null; onClose: () => void }) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, { is_correct: boolean; selected: number }>>({});
  const [curr, setCurr] = useState(0);
  const [ans, setAns] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!quizSet || !userId) return;
    (async () => {
      const [{ data: qs }, { data: a }] = await Promise.all([
        supabase.from("league_quizzes").select("*").eq("quiz_set_id", quizSet.id).order("display_order"),
        supabase.from("league_quiz_answers").select("*").eq("user_id", userId),
      ]);
      const answerMap: Record<string, { is_correct: boolean; selected: number }> = {};
      (a ?? []).forEach((row: any) => { answerMap[row.quiz_id] = { is_correct: row.is_correct, selected: row.selected }; });
      setQuizzes(qs ?? []);
      setAnswers(answerMap);
      const first = (qs ?? []).findIndex((q: any) => answerMap[q.id] === undefined);
      setCurr(first === -1 ? 0 : first);
      setAns(null);
      setShowReport(first === -1 && (qs ?? []).length > 0);
    })();
  }, [quizSet, userId]);

  if (!quizSet || !userId) return null;
  const currentUserId = userId;
  const q = quizzes[curr];
  const existing = q ? answers[q.id] : undefined;
  const isAnswered = existing !== undefined;

  async function verify() {
    if (!q || ans === null) return;
    const ok = ans === q.correct_answer;
    const { error } = await supabase.from("league_quiz_answers").upsert(
      { user_id: currentUserId, quiz_id: q.id, is_correct: ok, selected: ans },
      { onConflict: "user_id,quiz_id" },
    );
    if (error) return toast.error(error.message);
    setAnswers((prev) => ({ ...prev, [q.id]: { is_correct: ok, selected: ans } }));
  }

  return (
    <Dialog open={!!quizSet} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quizSet.title}</DialogTitle>
        </DialogHeader>
        {!q ? (
          <p className="text-sm text-muted-foreground">Nenhuma questão neste caderno.</p>
        ) : showReport ? (
          <div className="space-y-4 text-center">
            <div className="text-4xl font-black">{Math.round((quizzes.filter((item) => answers[item.id]?.is_correct).length / quizzes.length) * 100)}%</div>
            <p className="text-sm text-muted-foreground">{quizzes.filter((item) => answers[item.id]?.is_correct).length} acertos de {quizzes.length}</p>
            <Button onClick={() => { setShowReport(false); setCurr(0); setAns(null); }}>Revisar questões</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-black uppercase text-muted-foreground">Questão {curr + 1} de {quizzes.length}</div>
            <h3 className="text-lg font-black">{q.question}</h3>
            <div className="space-y-2">
              {(q.options as string[]).map((opt, i) => {
                let cls = "border bg-card";
                if (isAnswered) {
                  if (i === q.correct_answer) cls = "border-emerald-500 bg-emerald-500/10";
                  else if (i === existing?.selected) cls = "border-rose-500 bg-rose-500/10";
                  else cls = "border bg-muted/40 opacity-60";
                } else if (ans === i) cls = "border-primary bg-primary/5";
                return (
                  <button key={i} type="button" disabled={isAnswered} onClick={() => setAns(i)} className={`w-full rounded-xl border-2 p-4 text-left ${cls}`}>
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                );
              })}
            </div>
            {!isAnswered && ans !== null && <Button className="w-full" onClick={verify}>Verificar</Button>}
            {isAnswered && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className={`mb-2 flex items-center gap-2 font-black ${existing?.is_correct ? "text-emerald-600" : "text-rose-600"}`}>
                  {existing?.is_correct ? <><CheckCircle className="size-5" /> Correto!</> : <><XCircle className="size-5" /> Incorreto</>}
                </p>
                {q.explanation && <p className="text-sm text-muted-foreground">{q.explanation}</p>}
                <Button className="mt-4 w-full" onClick={() => {
                  setAns(null);
                  if (curr === quizzes.length - 1) setShowReport(true);
                  else setCurr((prev) => prev + 1);
                }}>{curr === quizzes.length - 1 ? "Ver relatório" : "Próxima"}</Button>
              </div>
            )}
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
