import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { sendAnonymousMessage, bookCamedSlot } from "@/lib/camed.functions";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { GraduationCap, Users, Calendar, Shield, LogIn, LogOut, UserCircle, Plus, ArrowRight, Sparkles, Activity, Building2, MessageCircle, Send, Clock, Video, MapPin, ShieldCheck, CheckCircle2, Lock, Newspaper, ExternalLink } from "lucide-react";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";

export const Route = createFileRoute("/")({ component: HomePage });

type Event = { id: string; league_id: string; title: string; description: string | null; image_url: string | null; registration_link: string | null };
type CamedMember = { id: string; name: string; role: string; description: string | null; image_url: string | null };

function HomePage() {
  const { user, profile, isAdminMaster, loading } = useAuth();
  const nav = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [myMemberships, setMyMemberships] = useState<{ league: League; role: string }[]>([]);
  const [events, setEvents] = useState<(Event & { league?: League })[]>([]);
  const [myEventRegs, setMyEventRegs] = useState<Record<string, boolean>>({});
  const [camedInfo, setCamedInfo] = useState<any>(null);
  const [camedMembers, setCamedMembers] = useState<CamedMember[]>([]);
  const [isCamedPresident, setIsCamedPresident] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);


  useEffect(() => {
    if (!profile?.email) { setIsCamedPresident(false); return; }
    supabase.from("camed_presidents").select("id").ilike("email", profile.email).maybeSingle()
      .then(({ data }) => setIsCamedPresident(!!data));
  }, [profile?.email]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("public_leagues").select("*").order("name");
      setLeagues((data as League[]) ?? []);
      const { data: ci } = await supabase.from("camed_info").select("*").eq("id", 1).maybeSingle();
      setCamedInfo(ci);
      const { data: cm } = await supabase.from("camed_members").select("*").order("display_order");
      setCamedMembers((cm as CamedMember[]) ?? []);
      const { data: ev } = await supabase
        .from("league_events")
        .select("*, leagues!inner(*)")
        .order("created_at", { ascending: false });
      const filtered = (ev ?? []).filter((e: any) => {
        const l = e.leagues;
        return l?.published && l?.paid_until && new Date(l.paid_until) >= new Date();
      });
      setEvents(filtered.map((e: any) => ({ ...e, league: e.leagues })));
    })();
  }, []);

  useEffect(() => {
    if (!user) { setMyMemberships([]); return; }
    (async () => {
      const { data } = await supabase
        .from("league_memberships")
        .select("role, leagues(*)")
        .eq("user_id", user.id);
      const mapped = (data ?? []).map((m: any) => ({ league: m.leagues as League, role: m.role }));
      setMyMemberships(mapped.filter((m) => m.league));
    })();
  }, [user]);

  useEffect(() => {
    if (!user || events.length === 0) {
      setMyEventRegs({});
      return;
    }
    const eventIds = events.map((event) => event.id);
    supabase.from("event_registrations").select("event_id").eq("user_id", user.id).in("event_id", eventIds).then(({ data }) => {
      const mapped: Record<string, boolean> = {};
      (data ?? []).forEach((row: any) => { mapped[row.event_id] = true; });
      setMyEventRegs(mapped);
    });
  }, [user, events]);

  const myActiveMemberships = myMemberships.filter((m) => m.role !== "visitante");

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <GraduationCap className="size-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-black text-lg leading-none tracking-tight">Ligas Acadêmicas</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Unochapecó</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {loading ? null : user ? (
              <>
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-full px-3 py-1.5 transition-colors"
                  title="Editar meus dados"
                >
                  <UserCircle className="size-4" /> {profile?.username ?? user.email}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  onClick={() => setProfileOpen(true)}
                  title="Meus dados"
                >
                  <UserCircle className="size-5" />
                </Button>

                {isCamedPresident && (
                  <Button asChild variant="default" size="sm" className="bg-gradient-to-r from-primary to-accent">
                    <Link to="/camed"><Building2 className="size-4" /> CAMED</Link>
                  </Button>
                )}
                {isAdminMaster && (
                  <Button asChild variant="default" size="sm" className="bg-gradient-to-r from-primary to-accent">
                    <Link to="/admin"><Shield className="size-4" /> ADMIN</Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth"><LogIn className="size-4" /> Entrar</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hub-hero text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-28 text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-widest mb-6">
            <Sparkles className="size-3.5" /> Centro Integrado
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
            Todas as ligas.<br />
            <span className="bg-gradient-to-r from-emerald-200 to-teal-300 bg-clip-text text-transparent">Um só lugar.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/80 mb-10 font-medium">
            Conheça, participe e acompanhe as ligas acadêmicas de medicina da Unochapecó —
            ensino, pesquisa e extensão em uma plataforma unificada.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
            <Stat n={leagues.length} l="Ligas ativas" />
            <Stat n={camedMembers.length} l="Membros CAMED" />
            <Stat n={events.length} l="Eventos" />
          </div>
        </div>
      </section>

      {/* TABS */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <Tabs defaultValue="ligas" className="w-full">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto p-1">
            <TabsTrigger value="ligas" className="py-2.5"><Users className="size-4 mr-1.5" />Ligas</TabsTrigger>
            <TabsTrigger value="minhas" className="py-2.5"><GraduationCap className="size-4 mr-1.5" />Minhas Ligas</TabsTrigger>
            <TabsTrigger value="camed" className="py-2.5"><Building2 className="size-4 mr-1.5" />CAMED</TabsTrigger>
            <TabsTrigger value="eventos" className="py-2.5"><Calendar className="size-4 mr-1.5" />Eventos</TabsTrigger>
          </TabsList>

          {/* LIGAS */}
          <TabsContent value="ligas" className="mt-8">
            {leagues.length === 0 ? (
              <EmptyState icon={<Users className="size-12" />} title="Nenhuma liga publicada ainda" desc="Quando ligas forem publicadas, aparecerão aqui." />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {leagues.map((l) => <LeagueCard key={l.id} league={l} />)}
              </div>
            )}
          </TabsContent>

          {/* MINHAS LIGAS */}
          <TabsContent value="minhas" className="mt-8">
            {!user ? (
              <EmptyState icon={<LogIn className="size-12" />} title="Você deve realizar log-in para ver suas ligas"
                action={<Button onClick={() => nav({ to: "/auth" })}><LogIn className="size-4" /> Fazer login</Button>} />
            ) : myActiveMemberships.length === 0 ? (
              <div className="space-y-6">
                <EmptyState icon={<GraduationCap className="size-12" />} title="Você não participa atualmente de nenhuma liga" desc="Conheça outras ligas abaixo." />
                <div>
                  <h3 className="text-2xl font-black mb-4">Conheça Outras Ligas</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leagues.map((l) => <LeagueCard key={l.id} league={l} />)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {myActiveMemberships.map((m) => (
                  <Card key={m.league.id} className="overflow-hidden hover:-translate-y-1 transition-all">
                    <div className="h-32 relative" style={{ background: `linear-gradient(135deg, ${m.league.theme_color}, ${m.league.theme_color}aa)` }}>
                      {m.league.icon_url && <img src={m.league.icon_url} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-20 rounded-2xl border-4 border-background bg-background object-contain" />}
                    </div>
                    <CardContent className="pt-12 text-center">
                      <h3 className="font-black text-xl">{m.league.name}</h3>
                      <Badge variant="secondary" className="mt-2 uppercase text-[10px]">{m.role}</Badge>
                      <Button asChild className="w-full mt-4">
                        <Link to="/$slug" params={{ slug: m.league.slug }}>Acessar <ArrowRight className="size-4" /></Link>
                      </Button>
                      {m.role === "presidente" && (
                        <Button asChild variant="outline" className="w-full mt-2">
                          <Link to="/presidente/$slug" params={{ slug: m.league.slug }}>Painel do Presidente</Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CAMED */}
          <TabsContent value="camed" className="mt-8 space-y-8">
            <Card className="overflow-hidden">
              <div className="hub-hero text-white p-8 md:p-12">
                <Badge className="bg-white/15 text-white border-white/20 mb-4">{camedInfo?.subtitle}</Badge>
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter">{camedInfo?.title ?? "CAMED"}</h2>
                <p className="mt-4 text-white/85 max-w-3xl text-lg whitespace-pre-line">{camedInfo?.description}</p>
              </div>
            </Card>

            <Tabs defaultValue="membros" className="w-full">
              <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto">
                <TabsTrigger value="membros" className="py-2"><Users className="size-4 mr-1.5" />Membros</TabsTrigger>
                <TabsTrigger value="noticias" className="py-2"><Newspaper className="size-4 mr-1.5" />Notícias</TabsTrigger>
                <TabsTrigger value="contato" className="py-2"><MessageCircle className="size-4 mr-1.5" />Fale Conosco</TabsTrigger>
                <TabsTrigger value="horarios" className="py-2"><Clock className="size-4 mr-1.5" />Horários Semanais</TabsTrigger>
              </TabsList>

              <TabsContent value="membros" className="mt-6">
                {camedMembers.length === 0 ? (
                  <EmptyState icon={<Users className="size-12" />} title="Nenhum membro cadastrado ainda" />
                ) : (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {camedMembers.map((m) => (
                        <CarouselItem key={m.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                          <Card className="h-full overflow-hidden">
                            <div className="aspect-square bg-muted relative">
                              {m.image_url ? <img src={m.image_url} alt={m.name} className="absolute inset-0 w-full h-full object-cover" />
                                : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><UserCircle className="size-24" /></div>}
                            </div>
                            <CardContent className="p-5">
                              <Badge variant="secondary" className="uppercase text-[10px]">{m.role}</Badge>
                              <h4 className="font-black text-lg mt-2">{m.name}</h4>
                              {m.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{m.description}</p>}
                            </CardContent>
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious /><CarouselNext />
                  </Carousel>
                )}
              </TabsContent>

              <TabsContent value="noticias" className="mt-6"><CamedNewsList /></TabsContent>
              <TabsContent value="contato" className="mt-6"><FaleConoscoCard /></TabsContent>
              <TabsContent value="horarios" className="mt-6"><HorariosCard user={user} /></TabsContent>
            </Tabs>
          </TabsContent>


          {/* EVENTOS */}
          <TabsContent value="eventos" className="mt-8">
            {events.length === 0 ? (
              <EmptyState icon={<Calendar className="size-12" />} title="Nenhum evento publicado" desc="Eventos das ligas com anuidade em dia aparecerão aqui." />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((e) => (
                  <Card key={e.id} className="overflow-hidden hover:-translate-y-1 transition-all">
                    <div className="aspect-video bg-muted relative">
                      {e.image_url ? <img src={e.image_url} className="absolute inset-0 w-full h-full object-cover" alt={e.title} />
                        : <div className="absolute inset-0 hub-hero" />}
                      {e.league && <Badge className="absolute top-3 left-3" style={{ background: e.league.theme_color }}>{e.league.name}</Badge>}
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-black text-lg">{e.title}</h3>
                      {e.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{e.description}</p>}
                      {e.league ? (
                        <Button asChild className="w-full mt-4" variant={myEventRegs[e.id] ? "outline" : "default"}>
                          <Link to="/$slug" params={{ slug: e.league.slug }} search={{ event: e.id } as any}>{myEventRegs[e.id] ? "Acessar Painel do Inscrito" : "Inscreva-se!"} <ArrowRight className="size-4" /></Link>
                        </Button>
                      ) : (
                        <Button disabled className="w-full mt-4">Sem inscrição</Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border/50 mt-16 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Ligas Acadêmicas · Unochapecó
      </footer>

      {user && (
        <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} userId={user.id} />
      )}
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="px-3 py-4 rounded-xl bg-white/10 border border-white/20 backdrop-blur">
      <div className="text-3xl md:text-4xl font-black">{n}</div>
      <div className="text-[10px] uppercase tracking-widest text-white/70">{l}</div>
    </div>
  );
}

function LeagueCard({ league }: { league: League }) {
  return (
    <Link to="/$slug" params={{ slug: league.slug }}>
      <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 h-full">
        <div className="h-32 relative" style={{ background: `linear-gradient(135deg, ${league.theme_color}, ${league.theme_color}aa)` }}>
          {league.icon_url && <img src={league.icon_url} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-20 rounded-2xl border-4 border-background bg-background object-contain" alt={league.name} />}
          {!league.icon_url && <Activity className="absolute bottom-3 right-3 size-16 text-white/30" />}
        </div>
        <CardContent className="pt-12 text-center">
          <h3 className="font-black text-xl">{league.name}</h3>
          {league.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{league.description}</p>}
          <div className="flex items-center justify-center gap-1 mt-3 text-xs text-primary font-bold uppercase tracking-widest">
            Acessar <ArrowRight className="size-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <Card className="p-12 text-center">
      <div className="mx-auto size-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">{icon}</div>
      <h3 className="text-xl font-black">{title}</h3>
      {desc && <p className="text-muted-foreground mt-2">{desc}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}

function FaleConoscoCard() {
  const send = useServerFn(sendAnonymousMessage);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit() {
    const m = msg.trim();
    if (m.length < 3) return toast.error("Escreva uma mensagem maior.");
    if (m.length > 5000) return toast.error("Mensagem muito longa.");
    setSending(true);
    try {
      const r = await send({ data: { message: m } });
      if ((r as any)?.emailed === false) toast.warning("Mensagem registrada, mas o e-mail do CAMED não está configurado.");
      else toast.success("Mensagem enviada anonimamente!");
      setSent(true); setMsg("");
    } catch (e: any) { toast.error(e?.message ?? "Erro ao enviar"); }
    finally { setSending(false); }
  }
  return (
    <Card className="overflow-hidden border-emerald-300/40">
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 text-white p-7">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur"><MessageCircle className="size-6" /></div>
          <div>
            <Badge className="bg-white/20 text-white border-white/30 mb-1"><Lock className="size-3 mr-1" /> 100% Anônimo</Badge>
            <h3 className="text-2xl font-black tracking-tight">Fale Conosco</h3>
          </div>
        </div>
        <p className="text-white/85 text-sm leading-relaxed max-w-2xl">
          Canal direto para <b>denúncias, sugestões, reclamações</b> e outras manifestações.
          As mensagens são enviadas para o e-mail do CAMED em nome do <b>LIGASUNO</b>,
          <b> sem nenhuma identificação do remetente original</b>.
        </p>
      </div>
      <CardContent className="p-6 space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Sua mensagem anônima</Label>
          <Textarea rows={7} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={5000} placeholder="Escreva aqui sua mensagem... ninguém saberá que foi você." className="mt-1.5 resize-none" />
          <div className="text-xs text-muted-foreground mt-1 flex justify-between">
            <span className="flex items-center gap-1"><ShieldCheck className="size-3 text-emerald-600" /> Sem registro de identidade</span>
            <span>{msg.length}/5000</span>
          </div>
        </div>
        <Button onClick={submit} disabled={sending || msg.trim().length < 3} className="w-full bg-gradient-to-r from-emerald-700 to-emerald-600 hover:opacity-90 text-white">
          {sending ? "Enviando..." : (<><Send className="size-4" /> Enviar anonimamente</>)}
        </Button>
        {sent && <p className="text-xs text-center text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1"><CheckCircle2 className="size-3.5" /> Recebido pelo CAMED</p>}
      </CardContent>
    </Card>
  );
}

function isBlackoutNow(now = new Date()) {
  // Saturday 20:00 → Monday 07:00 (Brazil local)
  const d = now.getDay(); // 0=Sun ... 6=Sat
  const h = now.getHours();
  if (d === 6 && h >= 20) return true;
  if (d === 0) return true;
  if (d === 1 && h < 7) return true;
  return false;
}

function HorariosCard({ user }: { user: any }) {
  const book = useServerFn(bookCamedSlot);
  const [slots, setSlots] = useState<any[]>([]);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [bookOpen, setBookOpen] = useState<any | null>(null);
  const [f, setF] = useState({ modality: "presencial" as "online" | "presencial", reason: "", extras: "", phone: "" });
  const [busy, setBusy] = useState(false);

  async function reload() {
    // Hide slots less than 24h away — they can't be booked anymore
    const cutoffIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from("camed_slots").select("*").gte("slot_at", cutoffIso).order("slot_at");
    setSlots(data ?? []);
    const ids = (data ?? []).map((s: any) => s.id);
    if (ids.length) {
      const { data: bks } = await supabase.from("camed_bookings").select("slot_id").in("slot_id", ids);
      setBookedIds(new Set((bks ?? []).map((b: any) => b.slot_id)));
    } else setBookedIds(new Set());
  }
  useEffect(() => { reload(); }, []);

  async function submit() {
    if (!bookOpen) return;
    if (!f.reason.trim()) return toast.error("Diga em poucas palavras o motivo");
    if (!f.phone.trim()) return toast.error("Informe um telefone para contato");
    setBusy(true);
    try {
      await book({ data: { slot_id: bookOpen.id, modality: f.modality, reason: f.reason.trim(), extra_participants: f.extras.trim() || undefined, phone: f.phone.trim() } });
      toast.success("Horário marcado! O CAMED foi notificado.");
      setBookOpen(null); setF({ modality: "presencial", reason: "", extras: "", phone: "" });
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setBusy(false); }
  }

  const available = slots.filter((s) => !bookedIds.has(s.id));
  const taken = slots.filter((s) => bookedIds.has(s.id));

  return (
    <div className="space-y-6">
      <Card className="border-emerald-300/40 overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 text-white p-6">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center"><Clock className="size-6" /></div>
            <div>
              <h3 className="text-xl font-black">Horários Semanais</h3>
              <p className="text-white/80 text-sm">Marque um horário com o CAMED. Reseta todo <b>sábado às 20h</b>.</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm">
            ℹ️ Os horários são resetados toda semana às <b>20h de sábado</b>. Horários devem ser marcados com pelo menos <b>24 horas de antecedência</b>.
          </div>
        </div>
      </Card>

      <section>
        <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /> Disponíveis</h4>
        {available.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Nenhum horário aberto pelo CAMED.</Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map((s) => <SlotCard key={s.id} slot={s} status="open" onBook={() => { if (!user) return toast.error("Faça login para marcar"); setBookOpen(s); setF((p) => ({ ...p, modality: s.allow_in_person ? "presencial" : "online" })); }} />)}
          </div>
        )}
      </section>

      {taken.length > 0 && (
        <section>
          <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Lock className="size-4" /> Já marcados</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
            {taken.map((s) => <SlotCard key={s.id} slot={s} status="taken" />)}
          </div>
        </section>
      )}

      <Dialog open={!!bookOpen} onOpenChange={() => !busy && setBookOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar horário</DialogTitle></DialogHeader>
          {bookOpen && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="font-black text-emerald-900 dark:text-emerald-100">{new Date(bookOpen.slot_at).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}</div>
                {bookOpen.attendant_name && <div className="text-xs text-emerald-800 dark:text-emerald-300">Atendente: <b>{bookOpen.attendant_name}</b></div>}
              </div>
              <div>
                <Label>Modalidade</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {bookOpen.allow_in_person && (
                    <button type="button" onClick={() => setF({ ...f, modality: "presencial" })} className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${f.modality === "presencial" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-border"}`}>
                      <MapPin className="size-4 mx-auto mb-1" /> Presencial
                    </button>
                  )}
                  {bookOpen.allow_online && (
                    <button type="button" onClick={() => setF({ ...f, modality: "online" })} className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${f.modality === "online" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-border"}`}>
                      <Video className="size-4 mx-auto mb-1" /> Online
                    </button>
                  )}
                </div>
              </div>
              <div>
                <Label>Digite em poucas palavras o motivo de contato</Label>
                <Textarea rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={1000} />
              </div>
              <div>
                <Label>Mais pessoas irão participar? Cite aqui. <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Textarea rows={2} value={f.extras} onChange={(e) => setF({ ...f, extras: e.target.value })} maxLength={1000} />
              </div>
              <div>
                <Label>Telefone de contato (WhatsApp)</Label>
                <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(49) 9 9999-9999" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBookOpen(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={submit} disabled={busy} className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white">{busy ? "Marcando..." : "Confirmar marcação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SlotCard({ slot, status, onBook }: { slot: any; status: "open" | "taken"; onBook?: () => void }) {
  const dt = new Date(slot.slot_at);
  return (
    <Card className={`overflow-hidden ${status === "open" ? "hover:-translate-y-1 hover:shadow-xl transition-all border-emerald-300/50" : "border-amber-300/40"}`}>
      <div className={`p-1 ${status === "open" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-amber-500 to-orange-500"}`} />
      <CardContent className="p-5">
        <Badge className={status === "open" ? "bg-emerald-500" : "bg-amber-500"}>{status === "open" ? "Disponível" : "Marcado"}</Badge>
        <div className="mt-3 font-black text-lg capitalize">{dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
        <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5"><Clock className="size-3.5" /> {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}h</div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {slot.allow_online && <Badge variant="outline" className="text-[10px]"><Video className="size-3 mr-1" />Online</Badge>}
          {slot.allow_in_person && <Badge variant="outline" className="text-[10px]"><MapPin className="size-3 mr-1" />Presencial</Badge>}
        </div>
        {slot.attendant_name && <div className="text-xs text-muted-foreground mt-3 pt-3 border-t">Atende: <b className="text-foreground">{slot.attendant_name}</b></div>}
        {status === "open" && onBook && (
          <Button onClick={onBook} className="w-full mt-4 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white hover:opacity-90">Marcar este horário <ArrowRight className="size-4" /></Button>
        )}
      </CardContent>
    </Card>
  );
}

function CamedNewsList() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("camed_news" as any).select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as any[]) ?? []));
  }, []);
  if (items.length === 0) {
    return <EmptyState icon={<Newspaper className="size-12" />} title="Nenhuma notícia publicada ainda" desc="As notícias publicadas pelo CAMED aparecerão aqui." />;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((n) => (
        <Card key={n.id} className="overflow-hidden hover:-translate-y-1 transition-all">
          {n.image_url && <div className="aspect-video bg-muted"><img src={n.image_url} alt={n.title} className="w-full h-full object-cover" /></div>}
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase">{n.category ?? "Geral"}</Badge>
              <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
            <h3 className="font-black text-lg mt-2">{n.title}</h3>
            {n.excerpt && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-4 whitespace-pre-line">{n.excerpt}</p>}
            {n.link && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <a href={n.link} target="_blank" rel="noreferrer">Saiba mais <ExternalLink className="size-3.5" /></a>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
