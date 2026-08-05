import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { League } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowRight, Users, Star, ShieldCheck, GraduationCap, Trophy, Crown, Medal } from "lucide-react";
import { AdsBanner } from "@/components/ads-banner";

export const Route = createFileRoute("/ligas")({
  head: () => ({
    meta: [
      { title: "Ligas Acadêmicas — MEDUNO" },
      { name: "description", content: "Conheça todas as ligas acadêmicas de medicina da Unochapecó." },
      { property: "og:title", content: "Ligas Acadêmicas — MEDUNO" },
      { property: "og:description", content: "Todas as ligas acadêmicas de medicina em um só lugar." },
    ],
  }),
  component: LigasPage,
});

type MyLeague = League & { my_role: "presidente" | "diretor" | "ligante" };

function LigasPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [points, setPoints] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from("public_leagues").select("*").order("name").then(({ data }) => {
      setLeagues((data as League[]) ?? []);
    });
  }, []);

  useEffect(() => {
    supabase.from("league_points").select("league_id, points").then(({ data }) => {
      const map: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { map[p.league_id] = (map[p.league_id] ?? 0) + Number(p.points || 0); });
      setPoints(map);
    });
  }, []);

  useEffect(() => {
    if (!user) { setMyLeagues([]); return; }
    (async () => {
      const [{ data: memberships }, { data: presided }] = await Promise.all([
        supabase.from("league_memberships").select("league_id, role, leagues(*)").eq("user_id", user.id),
        supabase.from("leagues").select("*").or(`president_id.eq.${user.id},president2_id.eq.${user.id}`),
      ]);
      const map = new Map<string, MyLeague>();
      (memberships ?? []).forEach((m: any) => {
        if (m.leagues) map.set(m.leagues.id, { ...(m.leagues as League), my_role: m.role });
      });
      (presided ?? []).forEach((l: any) => {
        map.set(l.id, { ...(l as League), my_role: "presidente" });
      });
      setMyLeagues(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
    })();
  }, [user?.id]);

  const roleMeta: Record<MyLeague["my_role"], { label: string; icon: any; className: string }> = {
    presidente: { label: "Presidente", icon: Star, className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    diretor: { label: "Diretor", icon: ShieldCheck, className: "bg-primary/15 text-primary border-primary/30" },
    ligante: { label: "Ligante", icon: GraduationCap, className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  };
  const rolePath: Record<MyLeague["my_role"], "/presidente/$slug" | "/diretor/$slug" | "/ligante/$slug"> = {
    presidente: "/presidente/$slug",
    diretor: "/diretor/$slug",
    ligante: "/ligante/$slug",
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-10">
        <AdsBanner placement="ligas" className="" />
      </div>
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-3">
          <Users className="size-3.5" /> Ligas
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Ligas Acadêmicas</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
          Explore as ligas ativas de Medicina da Unochapecó e conheça o trabalho de cada uma.
        </p>
      </div>

      {user && myLeagues.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Star className="size-4 text-primary" />
            <h2 className="text-lg font-black tracking-tight">Minhas ligas</h2>
            <span className="text-xs text-muted-foreground">({myLeagues.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myLeagues.map((league) => {
              const meta = roleMeta[league.my_role];
              const Icon = meta.icon;
              return (
                <Link key={league.id} to={rolePath[league.my_role]} params={{ slug: league.slug }} className="block min-w-0">
                  <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 h-full border-primary/20">
                    <div className="flex items-center gap-3 p-4 min-w-0" style={{ background: `linear-gradient(135deg, ${league.theme_color}22, transparent)` }}>
                      {league.icon_url ? (
                        <img src={league.icon_url} className="size-14 shrink-0 rounded-xl border bg-background object-contain" alt={league.name} />
                      ) : (
                        <div className="size-14 shrink-0 rounded-xl flex items-center justify-center" style={{ background: league.theme_color }}>
                          <Activity className="size-7 text-white/80" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-base truncate">{league.name}</h3>
                        <span className={`mt-1 inline-flex max-w-full items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.className}`}>
                          <Icon className="size-3 shrink-0" /> <span className="truncate">{meta.label}</span>
                        </span>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

        </section>
      )}

      {leagues.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Nenhuma liga publicada ainda.</Card>
      ) : (
        <>
          {user && myLeagues.length > 0 && (
            <h2 className="text-lg font-black tracking-tight mb-4">Todas as ligas</h2>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league) => (
              <Link key={league.id} to="/$slug" params={{ slug: league.slug }}>
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
            ))}
          </div>
        </>
      )}

      <LeagueRanking leagues={leagues} points={points} />
    </main>
  );
}

function LeagueRanking({ leagues, points }: { leagues: League[]; points: Record<string, number> }) {
  if (leagues.length === 0) return null;
  const ranked = leagues
    .map((l) => ({ ...l, total: points[l.id] ?? 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const podium = [
    { icon: Crown, ring: "border-amber-400", badge: "bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950", glow: "shadow-[0_0_0_4px_rgba(251,191,36,.15)]" },
    { icon: Medal, ring: "border-slate-300", badge: "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900", glow: "shadow-[0_0_0_4px_rgba(148,163,184,.15)]" },
    { icon: Trophy, ring: "border-orange-400", badge: "bg-gradient-to-r from-orange-400 to-amber-600 text-orange-950", glow: "shadow-[0_0_0_4px_rgba(251,146,60,.15)]" },
  ];

  return (
    <section className="mt-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold uppercase tracking-widest mb-3">
          <Trophy className="size-3.5" /> Classificação
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">Ranking das Ligas</h2>
        <p className="text-muted-foreground mt-2 text-sm">Pontuação acumulada atribuída pelo CAMED.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {ranked.slice(0, 3).map((l, i) => {
          const st = podium[i];
          const Icon = st.icon;
          return (
            <Link key={l.id} to="/$slug" params={{ slug: l.slug }} className="block min-w-0">
              <Card className={`h-full p-5 text-center border-2 ${st.ring} ${st.glow} hover:-translate-y-1 transition-all`}>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${st.badge}`}>
                  <Icon className="size-3.5" /> {i + 1}º lugar
                </div>
                <div className="mt-4 flex justify-center">
                  {l.icon_url ? (
                    <img src={l.icon_url} alt={l.name} className="size-16 rounded-2xl border bg-background object-contain" />
                  ) : (
                    <div className="size-16 rounded-2xl flex items-center justify-center" style={{ background: l.theme_color }}>
                      <Activity className="size-8 text-white/80" />
                    </div>
                  )}
                </div>
                <h3 className="mt-3 font-black text-base truncate">{l.name}</h3>
                <div className="mt-1 text-3xl font-black tabular-nums">{l.total}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pontos</div>
              </Card>
            </Link>
          );
        })}
      </div>

      {ranked.length > 3 && (
        <Card className="divide-y">
          {ranked.slice(3).map((l, i) => (
            <Link key={l.id} to="/$slug" params={{ slug: l.slug }} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
              <span className="w-8 shrink-0 text-center font-black text-muted-foreground tabular-nums">{i + 4}º</span>
              {l.icon_url ? (
                <img src={l.icon_url} alt={l.name} className="size-9 rounded-lg border bg-background object-contain shrink-0" />
              ) : (
                <span className="size-9 rounded-lg shrink-0" style={{ background: l.theme_color }} />
              )}
              <span className="flex-1 min-w-0 font-semibold truncate">{l.name}</span>
              <span className="font-black tabular-nums">{l.total}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">pts</span>
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}
