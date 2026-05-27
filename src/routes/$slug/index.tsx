import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArrowLeft, Calendar, Users, Award, Activity, LogIn, Sparkles, BookOpen, Microscope, Heart, Newspaper, HelpCircle, ChevronRight, GraduationCap, ShieldCheck } from "lucide-react";

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
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
      setLeague(data as League | null);
      if (data) {
        const [ev, nw, ac, ct] = await Promise.all([
          supabase.from("league_events").select("*").eq("league_id", data.id).order("created_at", { ascending: false }),
          supabase.from("league_news").select("*").eq("league_id", data.id).order("created_at", { ascending: false }),
          supabase.from("league_activities").select("*").eq("league_id", data.id).order("display_order"),
          supabase.from("league_content").select("content_key,content_value").eq("league_id", data.id),
        ]);
        setEvents(ev.data ?? []);
        setNews(nw.data ?? []);
        setActivities(ac.data ?? []);
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
  }, [league, user]);

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
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto p-1">
            <TabsTrigger value="sobre" className="py-2.5"><Award className="size-4 mr-1.5" />Sobre</TabsTrigger>
            <TabsTrigger value="eventos" className="py-2.5"><Calendar className="size-4 mr-1.5" />Eventos</TabsTrigger>
            <TabsTrigger value="news" className="py-2.5"><Newspaper className="size-4 mr-1.5" />Notícias</TabsTrigger>
            <TabsTrigger value="atividades" className="py-2.5"><Activity className="size-4 mr-1.5" />Atividades</TabsTrigger>
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
            {events.length === 0 ? (
              <Empty icon={<Calendar className="size-12" />} title="Nenhum evento publicado" />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((e) => (
                  <Card key={e.id} className="overflow-hidden hover:-translate-y-1 transition-all">
                    <div className="aspect-video bg-muted relative">
                      {e.image_url ? <img src={e.image_url} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0" style={{ background: league.theme_color }} />}
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-black">{e.title}</h3>
                      {e.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{e.description}</p>}
                      {e.registration_link ? (
                        <Button asChild className="w-full mt-4" style={{ background: league.theme_color }}>
                          <a href={e.registration_link} target="_blank" rel="noreferrer">Inscreva-se! <ChevronRight className="size-4" /></a>
                        </Button>
                      ) : <Button disabled className="w-full mt-4">Sem inscrição</Button>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
        </Tabs>

        {!user && (
          <Card className="mt-12 p-8 text-center">
            <p className="text-muted-foreground mb-4">Faça login para acessar áreas exclusivas, quizzes e mais.</p>
            <Button onClick={() => nav({ to: "/auth" })}><LogIn className="size-4" /> Entrar</Button>
          </Card>
        )}
      </main>
    </div>
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
