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
import { createEventPix, getEventPaymentStatus } from "@/lib/event-pix.functions";
import { verifySelectionPayment } from "@/lib/selection.functions";
import { SelectionRegisterDialog, SelectionAccessDialog } from "@/components/selection-public";
import { ArrowLeft, Calendar, Users, Award, Activity, LogIn, Sparkles, BookOpen, Microscope, Heart, Newspaper, HelpCircle, ChevronRight, GraduationCap, ShieldCheck, CreditCard, QrCode, CheckCircle, XCircle, ClipboardList, Zap, Star } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { QrImage, downloadQrPng } from "@/components/qr-image";
import { LeagueHeartButton } from "@/components/league-heart-button";
import { PixPaymentDialog, type PixPaymentData } from "@/components/pix-payment-dialog";

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
  const [quizCounts, setQuizCounts] = useState<Record<string, number>>({});
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
        const setIds = (qs.data ?? []).map((s: any) => s.id);
        if (setIds.length > 0) {
          const { data: qzs } = await supabase.from("league_quizzes").select("quiz_set_id").in("quiz_set_id", setIds);
          const cnt: Record<string, number> = {};
          (qzs ?? []).forEach((r: any) => { cnt[r.quiz_set_id] = (cnt[r.quiz_set_id] ?? 0) + 1; });
          setQuizCounts(cnt);
        }
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
  const isPresident = !!(user && (league.president_id === user.id || (league as any).president2_id === user.id));
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

  const tc = league.theme_color;
  const tcDark = darken(tc);
  const themedHero: React.CSSProperties = {
    background: `
      radial-gradient(900px 500px at 15% 20%, ${tc}66, transparent 60%),
      radial-gradient(700px 400px at 85% 75%, ${tcDark}88, transparent 60%),
      radial-gradient(600px 300px at 50% 100%, ${tc}55, transparent 70%),
      linear-gradient(135deg, ${tc} 0%, ${tcDark} 100%)`,
  };

  const stats = [
    { icon: Calendar, label: "Eventos", value: events.length },
    { icon: Newspaper, label: "Notícias", value: news.length },
    { icon: Activity, label: "Momentos", value: activities.length },
    { icon: HelpCircle, label: "Quizzes", value: quizSets.length },
  ];

  return (
    <div className="min-h-screen" style={{ ["--league-color" as any]: tc, ["--league-color-dark" as any]: tcDark }}>
      <header className="sticky top-0 z-30 backdrop-blur bg-background/85 border-b" style={{ borderColor: `${tc}22` }}>
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="size-4" /> Hub</Link>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {league.icon_url && <img src={league.icon_url} className="size-9 shrink-0 rounded-lg object-cover ring-2 ring-offset-1" style={{ ["--tw-ring-color" as any]: `${tc}55` }} alt="" />}
            <span className="font-black truncate">{league.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isLigante && <Button asChild size="sm" variant="outline"><Link to="/ligante/$slug" params={{ slug }}><GraduationCap className="size-4" /> Ligante</Link></Button>}
            {(isDiretor || isPresident) && <Button asChild size="sm" variant="outline"><Link to="/diretor/$slug" params={{ slug }}><ShieldCheck className="size-4" /> Diretor</Link></Button>}
            {isPresident && <Button asChild size="sm" style={{ background: tc }}><Link to="/presidente/$slug" params={{ slug }}>Presidente</Link></Button>}
          </div>
        </div>
      </header>

      {/* HERO: gradiente rico (sem animações infinitas pesadas) */}
      <section className="text-white relative overflow-hidden" style={themedHero}>
        {/* Grid sutil estático */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />

        <div className="max-w-7xl mx-auto px-4 pt-20 pb-28 md:pt-28 md:pb-36 text-center relative z-10 animate-fade-up">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-widest shadow-lg shadow-black/10">
              <Sparkles className="size-3.5" /> Liga Acadêmica · Unochapecó
            </div>
          </div>
          {league.icon_url && (
            <div className="flex justify-center mb-6">
              <img src={league.icon_url} alt={league.name} className="size-32 rounded-3xl border-4 border-white/30 shadow-2xl bg-white/15 object-contain" />
            </div>
          )}
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 drop-shadow-2xl">{league.name}</h1>
          {league.description && <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/90 font-medium leading-relaxed">{league.description}</p>}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LeagueHeartButton leagueId={league.id} userId={user?.id ?? null} themeColor="#ffffff" />

            {(league as any).selection_open && !isLigante && (() => {
              const deadlinePassed = (league as any).selection_deadline && new Date((league as any).selection_deadline) < new Date();
              if (mySelectionReg && mySelectionReg.status === "paid") {
                return <Button size="lg" className="bg-white text-foreground hover:bg-white/90 shadow-xl" onClick={() => setSelectionPanelOpen(true)}><ClipboardList className="size-5" /> Acessar minha inscrição</Button>;
              }
              if (mySelectionReg && mySelectionReg.status !== "paid") {
                return <Button size="lg" className="bg-white text-foreground hover:bg-white/90 shadow-xl" disabled={verifyingSelection} onClick={async () => {
                  setVerifyingSelection(true);
                  try {
                    const r: any = await verifySelection({ data: { registration_id: mySelectionReg.id } } as any);
                    const { data: fresh } = await supabase.from("league_selection_registrations").select("*").eq("id", mySelectionReg.id).maybeSingle();
                    if (fresh) setMySelectionReg(fresh);
                    if (r?.status === "paid") { toast.success("Pagamento confirmado!"); setSelectionPanelOpen(true); }
                    else toast.message("Pagamento ainda não confirmado pelo Mercado Pago.");
                  } catch (e: any) { toast.error(e?.message ?? "Falha ao verificar"); }
                  finally { setVerifyingSelection(false); }
                }}><ClipboardList className="size-5" /> {verifyingSelection ? "Verificando pagamento..." : "Confirmar pagamento"}</Button>;
              }
              if (deadlinePassed) return <Button size="lg" disabled>Inscrições encerradas</Button>;
              if (!user) return <Button size="lg" className="bg-white text-foreground hover:bg-white/90 shadow-xl" onClick={() => nav({ to: "/auth" })}><LogIn className="size-5" /> Entrar para se inscrever</Button>;
              return <Button size="lg" className="bg-white text-foreground hover:bg-white/90 shadow-xl" onClick={() => setSelectionRegOpen(true)}><Zap className="size-5" /> Inscreva-se no processo seletivo</Button>;
            })()}
          </div>

          {!visible && <Badge variant="destructive" className="mt-6">Preview — não publicada</Badge>}

          {/* Stats themed cards */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.label} delay={i * 80}>
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md hover:bg-white/15 hover:-translate-y-0.5 transition-all">
                    <Icon className="size-5 mx-auto mb-2 opacity-90" />
                    <div className="text-3xl font-black tabular-nums">{s.value}</div>
                    <div className="text-xs uppercase tracking-wider text-white/80">{s.label}</div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Wave separator suave para a próxima seção */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-12 md:h-20" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,60 C240,100 480,0 720,40 C960,80 1200,20 1440,60 L1440,100 L0,100 Z" fill="var(--background)" />
        </svg>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <Tabs defaultValue="sobre" className="w-full">
          <div className="w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex md:grid md:grid-cols-5 w-max md:w-full h-auto p-1 gap-1">
              <TabsTrigger value="sobre" className="py-2.5 whitespace-nowrap"><Award className="size-4 mr-1.5" />Sobre</TabsTrigger>
              <TabsTrigger value="eventos" className="py-2.5 whitespace-nowrap"><Calendar className="size-4 mr-1.5" />Eventos</TabsTrigger>
              <TabsTrigger value="news" className="py-2.5 whitespace-nowrap"><Newspaper className="size-4 mr-1.5" />Notícias</TabsTrigger>
              <TabsTrigger value="atividades" className="py-2.5 whitespace-nowrap"><Activity className="size-4 mr-1.5" />Atividades</TabsTrigger>
              <TabsTrigger value="quizzes" className="py-2.5 whitespace-nowrap"><HelpCircle className="size-4 mr-1.5" />Quizzes</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sobre" className="mt-8">
            <div className="grid md:grid-cols-3 gap-6">
              {PILLARS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <Reveal key={p.key} delay={i * 100}>
                    <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group h-full" style={{ boxShadow: `0 1px 0 ${tc}11` }}>
                      <div className="h-2" style={{ background: `linear-gradient(90deg, ${tc}, ${tc}88)` }} />
                      <CardContent className="p-6">
                        <div className="size-14 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg" style={{ background: `linear-gradient(135deg, ${tc}, ${tcDark})` }}>
                          <Icon className="size-7" />
                        </div>
                        <h3 className="font-black text-xl mb-2">{p.label}</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{content[p.key] || p.default}</p>
                      </CardContent>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="eventos" className="mt-8">
            <SectionHeader icon={Calendar} title="Eventos" subtitle="Inscreva-se, salve datas, participe de simpósios e jornadas." tc={tc} tcDark={tcDark} count={events.filter(e => e.published !== false || isPresident || isAdminMaster).length} />
            {(() => {
              const visibleEvents = events.filter(e => e.published !== false || isPresident || isAdminMaster);
              if (visibleEvents.length === 0) return <Empty icon={<Calendar className="size-12" />} title="Nenhum evento publicado" />;
              return (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleEvents.map((e, i) => (
                    <Reveal key={e.id} delay={i * 70}>
                      <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group h-full relative">
                        <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ background: `linear-gradient(90deg, ${tc}, ${tcDark})` }} />
                        <div className="aspect-video bg-muted relative overflow-hidden">
                          {e.image_url ? <img loading="lazy" src={e.image_url} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tc}, ${tcDark})` }}><Calendar className="size-16 text-white/40" /></div>}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                          {e.event_date && (
                            <div className="absolute top-3 right-3 px-3 py-2 rounded-xl bg-background/95 backdrop-blur shadow-lg text-center">
                              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tc }}>{new Date(e.event_date).toLocaleDateString("pt-BR", { month: "short" })}</div>
                              <div className="text-lg font-black leading-none">{new Date(e.event_date).getDate()}</div>
                            </div>
                          )}
                          <Badge className="absolute bottom-3 left-3 text-white border-0 shadow-lg" style={{ background: tc }}><Calendar className="size-3 mr-1" /> Evento</Badge>
                        </div>
                        <CardContent className="p-5">
                          <h3 className="font-black text-lg leading-tight">{e.title}</h3>
                          {e.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{e.description}</p>}
                          {(() => {
                            const reg = myRegs[e.id];
                            if (reg) {
                              return <Button onClick={() => setParticipantEvent(e)} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">Acessar Painel do Inscrito <ChevronRight className="size-4" /></Button>;
                            }
                            if (e.accepting_registrations === false) return <Button disabled className="w-full mt-4">Inscrições encerradas</Button>;
                            if (e.registration_deadline && new Date(e.registration_deadline) < new Date()) return <Button disabled className="w-full mt-4">Inscrições encerradas</Button>;
                            if (!user) return <Button onClick={() => nav({ to: "/auth" })} variant="outline" className="w-full mt-4"><LogIn className="size-4" /> Entrar para se inscrever</Button>;
                            return <Button onClick={() => setRegisterEvent(e)} className="w-full mt-4 text-white hover:opacity-90" style={{ background: `linear-gradient(135deg, ${tc}, ${tcDark})` }}>Inscreva-se! <ChevronRight className="size-4" /></Button>;
                          })()}
                        </CardContent>
                      </Card>
                    </Reveal>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="news" className="mt-8">
            <SectionHeader icon={Newspaper} title="Notícias" subtitle="Atualizações, artigos publicados e conquistas da liga." tc={tc} tcDark={tcDark} count={news.length} />
            {news.length === 0 ? (
              <Empty icon={<Newspaper className="size-12" />} title="Nenhuma notícia publicada" />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.map((n, i) => (
                  <Reveal key={n.id} delay={i * 70}>
                    <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group h-full relative">
                      <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ background: `linear-gradient(90deg, ${tc}, ${tcDark})` }} />
                      <div className="aspect-video bg-muted relative overflow-hidden">
                        {n.image_url ? <img loading="lazy" src={n.image_url} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tc}, ${tcDark})` }}><Newspaper className="size-16 text-white/40" /></div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        <Badge className="absolute top-3 left-3 text-white border-0 shadow-lg" style={{ background: tc }}>{n.category}</Badge>
                      </div>
                      <CardContent className="p-5">
                        <h3 className="font-black text-lg leading-tight">{n.title}</h3>
                        {n.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{n.excerpt}</p>}
                        {n.link && (
                          <Button asChild variant="outline" className="w-full mt-4">
                            <a href={n.link} target="_blank" rel="noreferrer">Ler artigo <ChevronRight className="size-4" /></a>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </Reveal>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="atividades" className="mt-8">
            <SectionHeader icon={Activity} title="Atividades" subtitle="Galeria de momentos: aulas, projetos e bastidores da liga." tc={tc} tcDark={tcDark} count={activities.length} />
            {activities.length === 0 ? (
              <Empty icon={<Activity className="size-12" />} title="Nenhuma atividade registrada" />
            ) : (
              <Carousel className="w-full">
                <CarouselContent>
                  {activities.map((a, i) => (
                    <CarouselItem key={a.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                      <Reveal delay={i * 60}>
                        <Card className="overflow-hidden h-full group hover:shadow-xl transition-all relative">
                          <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ background: `linear-gradient(90deg, ${tc}, ${tcDark})` }} />
                          <div className="aspect-video bg-muted overflow-hidden relative">
                            <img loading="lazy" src={a.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Badge className="absolute top-3 left-3 text-white border-0 shadow-lg" style={{ background: tc }}><Activity className="size-3 mr-1" /> Atividade</Badge>
                          </div>
                          {a.caption && <CardContent className="p-4"><p className="text-sm text-muted-foreground italic">"{a.caption}"</p></CardContent>}
                        </Card>
                      </Reveal>
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
                {quizSets.map((q, i) => {
                  const qCount = quizCounts[q.id] ?? 0;
                  const createdAt = q.created_at ? new Date(q.created_at) : null;
                  const isPrivate = !!q.is_private;
                  return (
                    <Reveal key={q.id} delay={i * 70}>
                      <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 h-full relative flex flex-col">
                        {/* Cabeçalho colorido com ícone grande */}
                        <div className="relative p-6 pb-8 text-white" style={{ background: `linear-gradient(135deg, ${tc}, ${tcDark})` }}>
                          <div className="absolute inset-0 opacity-20" style={{
                            backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.5) 1px, transparent 1px)",
                            backgroundSize: "18px 18px",
                          }} />
                          <div className="relative flex items-start justify-between gap-3">
                            <div className="size-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shadow-lg">
                              <HelpCircle className="size-9" />
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              {isPrivate && <Badge className="bg-white/25 text-white border-white/30 backdrop-blur">🔒 Privado</Badge>}
                              <Badge className="bg-white text-foreground font-black border-0">
                                <Sparkles className="size-3" /> {qCount} {qCount === 1 ? "questão" : "questões"}
                              </Badge>
                            </div>
                          </div>
                          <h3 className="relative font-black text-xl mt-4 leading-tight drop-shadow">{q.title}</h3>
                        </div>

                        <CardContent className="p-5 flex flex-col flex-1">
                          {q.description ? (
                            <p className="text-sm text-muted-foreground line-clamp-3">{q.description}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Teste seus conhecimentos com este quiz.</p>
                          )}

                          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5"><Star className="size-3.5" style={{ color: tc }} /> Quiz</div>
                            {createdAt && (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="size-3.5" />
                                {createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                              </div>
                            )}
                          </div>

                          <div className="mt-auto pt-4">
                            {user ? (
                              isLigante ? (
                                <Button className="w-full text-white hover:opacity-90" style={{ background: `linear-gradient(135deg, ${tc}, ${tcDark})` }} onClick={() => setActiveQuizSet(q)}>
                                  <Zap className="size-4" /> Começar quiz <ChevronRight className="size-4" />
                                </Button>
                              ) : (
                                <Button disabled className="w-full">🔒 Apenas ligantes</Button>
                              )
                            ) : (
                              <Button onClick={() => nav({ to: "/auth" })} variant="outline" className="w-full">
                                <LogIn className="size-4" /> Entrar para responder
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Reveal>
                  );
                })}
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
      <ParticipantPanelDialog event={participantEvent} registration={participantEvent ? myRegs[participantEvent.id] : null} league={league} onClose={() => setParticipantEvent(null)} onUpdate={(reg) => { if (participantEvent) setMyRegs(prev => ({ ...prev, [participantEvent.id]: { ...(prev[participantEvent.id] ?? {}), ...reg } })); }} />
      <PublicQuizDialog quizSet={activeQuizSet} league={league} userId={user?.id ?? null} onClose={() => setActiveQuizSet(null)} />
      <SelectionRegisterDialog league={league} open={selectionRegOpen} onClose={() => setSelectionRegOpen(false)} defaultEmail={user?.email ?? undefined} onPaid={() => { supabase.from("league_selection_registrations").select("*").eq("league_id", league.id).eq("user_id", user?.id ?? "").maybeSingle().then(({ data }) => { setMySelectionReg(data); if (data) setSelectionPanelOpen(true); }); }} />
      <SelectionAccessDialog league={league} registration={mySelectionReg} open={selectionPanelOpen} onClose={() => setSelectionPanelOpen(false)} />
    </div>
  );
}

function RegisterEventDialog({ event, onClose, myLeagueIds, leagueId, onSuccess }: { event: any; onClose: () => void; myLeagueIds: string[]; leagueId: string; onSuccess?: (reg: any) => void }) {
  const createPix = useServerFn(createEventPix);
  const checkStatus = useServerFn(getEventPaymentStatus);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: "", social_name: "", cpf: "", course: "medicina" as const });
  const [pix, setPix] = useState<PixPaymentData | null>(null);

  useEffect(() => {
    if (event) {
      setStep(1);
      setForm({ full_name: "", social_name: "", cpf: "", course: "medicina" });
      setPix(null);
      // Prefill com dados do perfil
      supabase.auth.getUser().then(({ data: u }) => {
        if (!u.user) return;
        supabase.from("profiles").select("full_name, cpf").eq("id", u.user.id).maybeSingle().then(({ data: p }) => {
          if (!p) return;
          setForm((f) => ({
            ...f,
            full_name: f.full_name || (p as any).full_name || "",
            cpf: f.cpf || (p as any).cpf || "",
          }));
        });
      });
    }
  }, [event]);

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
      const res: any = await createPix({ data: {
        event_id: event.id,
        full_name: form.full_name,
        social_name: form.social_name || null,
        cpf: normalizedCpf,
        course: form.course,
      }});
      if (res.free) {
        toast.success("Inscrição confirmada!");
        onSuccess?.({ event_id: event.id, status: "paid", paid_price: 0, full_name: form.full_name });
        onClose();
        return;
      }
      setPix({
        registration_id: res.registration_id,
        payment_id: res.payment_id,
        amount: res.amount,
        qr_code: res.qr_code,
        qr_code_base64: res.qr_code_base64,
        ticket_url: res.ticket_url,
        expires_at: res.expires_at,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar inscrição");
    } finally { setSubmitting(false); }
  }

  return (
    <>
      <Dialog open={!!event && !pix} onOpenChange={(v) => !v && onClose()}>
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
              <div>
                <Label>Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">Será usado para emitir seu certificado — digite o nome completo, sem abreviações.</p>
              </div>
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
                <div className="p-3 rounded border bg-muted/30 flex items-center gap-3">
                  <QrCode className="size-6" />
                  <div className="text-sm">
                    <div className="font-black">Pagamento via Pix</div>
                    <div className="text-xs text-muted-foreground">Confirmação automática em segundos.</div>
                  </div>
                </div>
              )}
              <DialogFooter className="flex-row gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={submit} disabled={submitting}>{submitting ? "Gerando Pix..." : price === 0 ? "Confirmar inscrição" : "Gerar Pix"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PixPaymentDialog
        open={!!pix}
        data={pix}
        onClose={() => { setPix(null); onClose(); }}
        checkStatus={async (rid) => checkStatus({ data: { registration_id: rid } } as any) as any}
        onPaid={() => {
          onSuccess?.({ event_id: event.id, status: "paid", paid_price: price, full_name: form.full_name });
          setPix(null);
          onClose();
        }}
      />
    </>
  );
}


function ParticipantPanelDialog({ event, registration, league, onClose, onUpdate }: { event: any; registration: any; league: League; onClose: () => void; onUpdate?: (reg: any) => void }) {
  if (!event) return null;
  const reg = registration;
  const createPix = useServerFn(createEventPix);
  const checkStatus = useServerFn(getEventPaymentStatus);
  const [pix, setPix] = useState<PixPaymentData | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  async function payNow() {
    if (!reg) return;
    setGenBusy(true);
    try {
      const res: any = await createPix({ data: {
        event_id: event.id,
        full_name: reg.full_name || "Aluno",
        social_name: reg.social_name || null,
        cpf: reg.cpf || "00000000000",
        course: reg.course || "medicina",
      }});
      if (res.free) {
        onUpdate?.({ ...reg, status: "paid" });
        return;
      }
      setPix({
        registration_id: res.registration_id,
        payment_id: res.payment_id,
        amount: res.amount,
        qr_code: res.qr_code,
        qr_code_base64: res.qr_code_base64,
        ticket_url: res.ticket_url,
        expires_at: res.expires_at,
      });
    } catch (e: any) { toast.error(e?.message ?? "Falha ao gerar Pix"); }
    finally { setGenBusy(false); }
  }
  return (
    <Dialog open={!!event} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Painel do Inscrito</DialogTitle>
          <Badge className="w-fit mt-1" style={{ background: league.theme_color }}>{event.title}</Badge>
        </DialogHeader>
        {event.image_url && <img src={event.image_url} className="w-full aspect-video object-cover rounded" />}
        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="info">Evento</TabsTrigger>
            <TabsTrigger value="badge">Crachá</TabsTrigger>
            <TabsTrigger value="schedule">Cronograma</TabsTrigger>
            <TabsTrigger value="mc">Minicursos</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-3 pt-3">
            {event.event_date && (
              <div className="flex items-center gap-2 text-sm"><Calendar className="size-4 text-muted-foreground" /><span>
                <b>{event.end_date ? "Período:" : "Data:"}</b>{" "}
                {new Date(event.event_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                {event.end_date ? ` até ${new Date(event.end_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
              </span></div>
            )}

            {Number(event.total_hours) > 0 && (
              <div className="text-xs text-muted-foreground">Carga horária do certificado: <b>{Number(event.total_hours)}h</b></div>
            )}
            {event.description && <div><div className="text-xs font-black uppercase text-muted-foreground mb-1">Descrição</div><p className="text-sm whitespace-pre-line">{event.description}</p></div>}
            {Array.isArray(event.checkin_schedule) && event.checkin_schedule.length > 0 && (
              <div>
                <div className="text-xs font-black uppercase text-muted-foreground mb-1">Credenciamentos</div>
                <div className="space-y-1">
                  {event.checkin_schedule.map((s: any, i: number) => (
                    <div key={i} className="text-xs p-2 rounded border bg-muted/30">
                      <b>{s.label || `${i + 1}° Credenciamento`}</b>
                      {s.starts_at && <> · {new Date(s.starts_at).toLocaleString("pt-BR")}</>}
                      {s.interval_min && <> · janela de {s.interval_min} min</>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {reg && (
              <Card className={reg.status === "paid" ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}><CardContent className="p-4 space-y-2">
                <div className="text-xs text-muted-foreground">Status da inscrição</div>
                <div className="flex items-center justify-between gap-2">
                  <Badge className={reg.status === "paid" ? "bg-emerald-600" : "bg-amber-600"}>{reg.status === "paid" ? "Inscrição confirmada" : "Pagamento pendente"}</Badge>
                  <div className="text-lg font-black">R$ {Number(reg.paid_price ?? 0).toFixed(2)}</div>
                </div>
                {reg.discount_reason && <div className="text-[11px] text-muted-foreground">{reg.discount_reason}</div>}
                {reg.status !== "paid" && Number(reg.paid_price) > 0 && (
                  <Button className="w-full mt-2" onClick={payNow} disabled={genBusy}>
                    <QrCode className="size-4 mr-1" /> {genBusy ? "Gerando Pix..." : "Realizar pagamento via Pix"}
                  </Button>
                )}
              </CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="badge" className="pt-3">
            <BadgeTab event={event} registration={reg} themeColor={league.theme_color} />
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
      <PixPaymentDialog
        open={!!pix}
        data={pix}
        onClose={() => setPix(null)}
        checkStatus={async (rid) => checkStatus({ data: { registration_id: rid } } as any) as any}
        onPaid={() => { setPix(null); onUpdate?.({ ...(reg ?? {}), status: "paid" }); }}
      />
    </Dialog>
  );
}

function BadgeTab({ event, registration, themeColor }: { event: any; registration: any; themeColor?: string }) {
  if (!registration || registration.status !== "paid") {
    return <p className="text-sm text-muted-foreground italic p-3 rounded border bg-muted/30">O crachá será liberado após a confirmação do pagamento.</p>;
  }
  const code = registration.checkin_code || "------";
  return (
    <div className="space-y-3 text-center">
      <div className="p-5 rounded-xl border-2" style={{ borderColor: themeColor || "var(--primary)" }}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Crachá de credenciamento</div>
        <div className="font-black text-lg mt-1">{registration.full_name || "—"}</div>
        <div className="text-xs text-muted-foreground mb-3">{event.title}</div>
        <div className="flex justify-center"><QrImage value={code} size={220} /></div>
        <div className="font-mono text-2xl font-black mt-3 tracking-widest">{code}</div>
        <div className="text-[10px] text-muted-foreground mt-1">Apresente este código no credenciamento</div>
      </div>
      <Button variant="outline" size="sm" onClick={() => downloadQrPng(code, `cracha-${code}.png`)}>
        Baixar QR Code (PNG)
      </Button>
    </div>
  );
}

function ParticipantMinicourses({ event, isPaid }: { event: any; isPaid: boolean }) {
  const { user } = useAuth();
  const [list, setList] = useState<any[] | null>(null);
  const [myRegs, setMyRegs] = useState<Record<string, any>>({});
  const [counts, setCounts] = useState<Record<string, { total: number; general: number; byLeague: Record<string, number> }>>({});
  const [slotsByMc, setSlotsByMc] = useState<Record<string, Array<{ league_id: string; seats: number }>>>({});
  const [leaguesById, setLeaguesById] = useState<Record<string, { name: string; icon_url?: string | null }>>({});
  const [busy, setBusy] = useState(false);
  const [isLigante, setIsLigante] = useState(false);
  const [pix, setPix] = useState<PixPaymentData | null>(null);

  async function reload() {
    if (user) {
      const { data: mem } = await supabase
        .from("league_memberships").select("id").eq("user_id", user.id).eq("league_id", event.league_id).maybeSingle();
      setIsLigante(!!mem);
    } else setIsLigante(false);
    const { data: mcs } = await supabase
      .from("league_minicourses")
      .select("*")
      .eq("event_id", event.id)
      .eq("published", true)
      .order("starts_at", { ascending: true });
    setList(mcs ?? []);
    const ids = (mcs ?? []).map((m: any) => m.id);
    if (ids.length === 0) { setMyRegs({}); setCounts({}); setSlotsByMc({}); return; }
    const [{ data: mine }, { data: all }, slotsRes] = await Promise.all([
      user ? supabase.from("minicourse_registrations").select("*").eq("user_id", user.id).in("minicourse_id", ids) : Promise.resolve({ data: [] as any[] }) as any,
      (supabase as any).from("minicourse_registrations").select("minicourse_id,status,exclusive_league_id").in("minicourse_id", ids),
      (supabase as any).from("minicourse_exclusive_slots").select("*").in("minicourse_id", ids),
    ]);
    const m: Record<string, any> = {};
    (mine ?? []).forEach((r: any) => { m[r.minicourse_id] = r; });
    setMyRegs(m);
    const c: Record<string, { total: number; general: number; byLeague: Record<string, number> }> = {};
    (all ?? []).forEach((r: any) => {
      if (r.status !== "paid" && r.status !== "pending") return;
      const cur = c[r.minicourse_id] ||= { total: 0, general: 0, byLeague: {} };
      cur.total++;
      if (r.exclusive_league_id) cur.byLeague[r.exclusive_league_id] = (cur.byLeague[r.exclusive_league_id] ?? 0) + 1;
      else cur.general++;
    });
    setCounts(c);
    const slotsMap: Record<string, any[]> = {};
    ((slotsRes?.data ?? []) as any[]).forEach((s: any) => { (slotsMap[s.minicourse_id] ||= []).push(s); });
    setSlotsByMc(slotsMap);
    const lgIds = Array.from(new Set([event.league_id, ...((slotsRes?.data ?? []) as any[]).map((s: any) => s.league_id)].filter(Boolean)));
    if (lgIds.length) {
      const { data: lgs } = await supabase.from("leagues").select("id, name, icon_url").in("id", lgIds);
      const map: Record<string, any> = {};
      (lgs ?? []).forEach((l: any) => { map[l.id] = l; });
      setLeaguesById(map);
    }
  }
  useEffect(() => { reload(); }, [event.id, user?.id]);

  async function register(mc: any) {
    if (!user) { toast.error("Faça login primeiro"); return; }
    setBusy(true);
    try {
      const { createMinicoursePix } = await import("@/lib/event-pix.functions");
      const res: any = await createMinicoursePix({ data: { minicourse_id: mc.id } } as any);
      if (res?.free) {
        toast.success("Inscrição confirmada!");
        reload();
      } else {
        setPix({
          registration_id: res.registration_id,
          payment_id: res.payment_id,
          amount: res.amount,
          qr_code: res.qr_code,
          qr_code_base64: res.qr_code_base64,
          ticket_url: res.ticket_url,
          expires_at: res.expires_at,
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao inscrever");
    } finally {
      setBusy(false);
    }
  }

  async function checkMcStatus(rid: string) {
    const { getMinicoursePaymentStatus } = await import("@/lib/event-pix.functions");
    return getMinicoursePaymentStatus({ data: { registration_id: rid } } as any) as any;
  }

  if (!isPaid) {
    return <p className="text-sm text-muted-foreground italic">Confirme o pagamento da inscrição do evento para liberar os minicursos.</p>;
  }
  if (list === null) return <p className="text-sm text-muted-foreground">Carregando minicursos...</p>;
  if (list.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhum minicurso publicado ainda.</p>;

  const quota = Number((event as any).free_minicourse_quota) || 0;
  const quotaUsed = Object.values(myRegs).filter((r: any) => r?.quota_used && (r.status === "paid" || r.status === "pending")).length;

  return (
    <div className="space-y-2">
      {quota > 0 && (
        <div className="rounded-md border border-emerald-600/40 bg-emerald-600/10 p-3 text-xs text-emerald-100">
          Sua inscrição inclui <strong>{quota}</strong> minicurso{quota > 1 ? "s" : ""} gratuito{quota > 1 ? "s" : ""}.
          {" "}Você já usou <strong>{Math.min(quotaUsed, quota)}</strong> de {quota}. Após esgotar, os próximos minicursos são cobrados normalmente.
        </div>
      )}

      {list.map((mc) => {
        const mine = myRegs[mc.id];
        const cnt = counts[mc.id] ?? { total: 0, general: 0, byLeague: {} };
        const cap = Number(mc.max_registrations) || 0;
        const slots = slotsByMc[mc.id] ?? [];
        const totalExcl = slots.reduce((a, s) => a + Number(s.seats || 0), 0);
        const generalCap = Math.max(0, cap - totalExcl);
        const full = cap > 0 && cnt.total >= cap && !mine;
        return (
          <Card key={mc.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-black">{mc.title}</h5>
                    {(() => {
                      const hasLig = !mc.is_free && mc.price_ligante !== null && mc.price_ligante !== undefined;
                      const effective = hasLig && isLigante ? Number(mc.price_ligante) : Number(mc.price);
                      return (
                        <>
                          <Badge variant={mc.is_free || effective <= 0 ? "secondary" : "default"} className="text-[10px]">
                            {mc.is_free || effective <= 0 ? "Gratuito" : `R$ ${effective.toFixed(2)}`}
                          </Badge>
                          {hasLig && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-400">
                              {isLigante
                                ? `Valor de ligante · não ligantes R$ ${Number(mc.price).toFixed(2)}`
                                : `Ligantes: ${Number(mc.price_ligante) <= 0 ? "Gratuito" : `R$ ${Number(mc.price_ligante).toFixed(2)}`}`}
                            </Badge>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">👤 {mc.instructor}</p>
                  <p className="text-xs text-muted-foreground">🗓️ {new Date(mc.starts_at).toLocaleString("pt-BR")}</p>
                  {mc.location && <p className="text-xs text-muted-foreground">📍 {mc.location}</p>}
                  {mc.description && <p className="text-xs mt-1 whitespace-pre-line">{mc.description}</p>}
                  {slots.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {slots.map((s: any) => {
                        const used = cnt.byLeague[s.league_id] ?? 0;
                        const remaining = Math.max(0, Number(s.seats) - used);
                        const name = leaguesById[s.league_id]?.name ?? "liga";
                        const hasPrice = s.price !== null && s.price !== undefined && !mc.is_free;
                        return (
                          <Badge key={s.league_id} variant="outline" className={`text-[10px] ${hasPrice && remaining > 0 ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : ""}`}>
                            {hasPrice
                              ? `${name}: R$ ${Number(s.price).toFixed(2)} — ${remaining} de ${s.seats} vagas`
                              : `${remaining} de ${s.seats} vagas exclusivas para ${name}`}
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                </div>
                <div className="shrink-0 text-right space-y-1">
                  <div className="text-[10px] text-muted-foreground">{cnt.total}/{cap || "∞"} vagas</div>
                  {totalExcl > 0 && cap > 0 && (
                    <div className="text-[10px] text-muted-foreground">{Math.max(0, generalCap - cnt.general)} abertas</div>
                  )}
                  {mine?.status === "paid" ? (
                    <Badge className="bg-emerald-600">Inscrito</Badge>
                  ) : mine?.status === "pending" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => register(mc)}>
                      <QrCode className="size-3 mr-1" /> Pagar Pix
                    </Button>
                  ) : full ? (
                    <Badge variant="outline">Esgotado</Badge>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => register(mc)}>Inscrever-se</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}


      <PixPaymentDialog
        open={!!pix}
        data={pix}
        onClose={() => setPix(null)}
        checkStatus={checkMcStatus}
        onPaid={() => { setPix(null); reload(); }}
      />
    </div>
  );
}



function PublicQuizDialog({ quizSet, league, userId, onClose }: { quizSet: any; league: League; userId: string | null; onClose: () => void }) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, { is_correct: boolean; selected: number; correct_answer?: number; explanation?: string }>>({});
  const [curr, setCurr] = useState(0);
  const [ans, setAns] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!quizSet || !userId) return;
    (async () => {
      const [{ data: qs }, { data: a }] = await Promise.all([
        supabase.from("league_quizzes").select("id, quiz_set_id, question, options, display_order").eq("quiz_set_id", quizSet.id).order("display_order"),
        (supabase as any).rpc("my_quiz_answers", { _set_id: quizSet.id }),
      ]);
      const answerMap: Record<string, { is_correct: boolean; selected: number; correct_answer?: number; explanation?: string }> = {};
      (a ?? []).forEach((row: any) => { answerMap[row.quiz_id] = { is_correct: row.is_correct, selected: row.selected, correct_answer: row.correct_answer, explanation: row.explanation }; });
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
    const { data, error } = await (supabase as any).rpc("submit_quiz_answer", { _quiz_id: q.id, _answer: ans });
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const ok = !!row?.is_correct;
    setAnswers((prev) => ({ ...prev, [q.id]: { is_correct: ok, selected: ans, correct_answer: row?.correct_answer, explanation: row?.explanation } }));
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
                const correctIdx = existing?.correct_answer;
                if (isAnswered) {
                  if (i === correctIdx) cls = "border-emerald-500 bg-emerald-500/10";
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
                {existing?.explanation && <p className="text-sm text-muted-foreground">{existing.explanation}</p>}
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

function SectionHeader({ icon: Icon, title, subtitle, tc, tcDark, count }: { icon: any; title: string; subtitle: string; tc: string; tcDark: string; count?: number }) {
  return (
    <div className="mb-8 flex items-center gap-4 flex-wrap">
      <div className="size-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0" style={{ background: `linear-gradient(135deg, ${tc}, ${tcDark})` }}>
        <Icon className="size-7" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter">{title}</h2>
          {typeof count === "number" && count > 0 && (
            <Badge className="text-white border-0 shadow" style={{ background: tc }}>{count}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="hidden md:block h-1 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${tc}, transparent)` }} />
    </div>
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
  } catch (e) { return hex; }
}
