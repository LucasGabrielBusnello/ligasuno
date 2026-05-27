import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Award, Activity, LogIn } from "lucide-react";

export const Route = createFileRoute("/$slug/")({ component: LeaguePage });

function LeaguePage() {
  const { slug } = Route.useParams();
  const { user, isAdminMaster } = useAuth();
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
      setLeague(data as League | null);
      if (data) {
        const { data: ev } = await supabase.from("league_events").select("*").eq("league_id", data.id).order("created_at", { ascending: false });
        setEvents(ev ?? []);
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
      <p className="text-muted-foreground mt-2">A liga "/{slug}" não existe.</p>
      <Button asChild className="mt-6"><Link to="/">Voltar ao início</Link></Button>
    </div>
  );

  const paid = league.paid_until && new Date(league.paid_until) >= new Date();
  const visible = league.published && paid;
  const isPresident = user && league.president_id === user.id;

  if (!visible && !isPresident && !isAdminMaster) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <h1 className="text-3xl font-black">Liga indisponível</h1>
        <p className="text-muted-foreground mt-2">Esta liga ainda não está publicada.</p>
        <Button asChild className="mt-6"><Link to="/">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Hub</Link>
          <div className="flex items-center gap-2">
            {league.icon_url && <img src={league.icon_url} className="size-8 rounded" />}
            <span className="font-black">{league.name}</span>
          </div>
          {isPresident && <Button asChild size="sm"><Link to="/presidente/$slug" params={{ slug }}>Painel Presidente</Link></Button>}
        </div>
      </header>

      <section className="text-white" style={{ background: `linear-gradient(135deg, ${league.theme_color}, ${league.theme_color}cc 60%, #000)` }}>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <Badge className="bg-white/15 border-white/20 mb-6">Unochapecó</Badge>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6">{league.name}</h1>
          {league.description && <p className="max-w-2xl mx-auto text-xl text-white/85">{league.description}</p>}
          {!visible && <Badge variant="destructive" className="mt-6">Preview — não publicada</Badge>}
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <FeatureCard icon={<Award />} title="Ensino" desc="Aulas, discussões clínicas e estudos dirigidos." color={league.theme_color} />
          <FeatureCard icon={<Activity />} title="Pesquisa" desc="Projetos científicos e publicações." color={league.theme_color} />
          <FeatureCard icon={<Users />} title="Extensão" desc="Eventos, ações comunitárias e simpósios." color={league.theme_color} />
        </div>

        <section>
          <h2 className="text-3xl font-black mb-6 flex items-center gap-2"><Calendar /> Eventos</h2>
          {events.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhum evento publicado.</Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((e) => (
                <Card key={e.id} className="overflow-hidden">
                  {e.image_url && <img src={e.image_url} className="aspect-video w-full object-cover" />}
                  <CardContent className="p-5">
                    <h3 className="font-black">{e.title}</h3>
                    {e.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{e.description}</p>}
                    {e.registration_link && <Button asChild className="w-full mt-4"><a href={e.registration_link} target="_blank" rel="noreferrer">Inscreva-se!</a></Button>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {!user && (
          <Card className="mt-12 p-8 text-center">
            <p className="text-muted-foreground mb-4">Faça login para acessar áreas exclusivas desta liga.</p>
            <Button onClick={() => nav({ to: "/auth" })}><LogIn className="size-4" /> Entrar</Button>
          </Card>
        )}
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }: any) {
  return (
    <Card className="hover:-translate-y-1 transition-all">
      <CardContent className="p-6">
        <div className="size-12 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: color }}>{icon}</div>
        <h3 className="font-black text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </CardContent>
    </Card>
  );
}
