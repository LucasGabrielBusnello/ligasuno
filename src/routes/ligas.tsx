import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { League } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowRight, Users, Star, ShieldCheck, GraduationCap, Trophy, Crown, Medal } from "lucide-react";
import { AdsBanner } from "@/components/ads-banner";

export const Route = createFileRoute("/ligas")({
  head: () => ({
    meta: [
      { title: "Ligas Acadêmicas — MEDPLEX" },
      { name: "description", content: "Conheça todas as ligas acadêmicas de medicina da Unochapecó e o ranking de pontuação." },
      { property: "og:title", content: "Ligas Acadêmicas — MEDPLEX" },
      { property: "og:description", content: "Ranking e perfil de todas as ligas acadêmicas de medicina em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LigasPage,
});

type MyLeague = League & { my_role: "presidente" | "diretor" | "ligante" };
type RankedLeague = League & { total: number; rank: number };

function LigasPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [points, setPoints] = useState<Record<string, number>>({});
  const [openActs, setOpenActs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("public_leagues").select("*").order("name").then(({ data }) => {
      setLeagues((data as League[]) ?? []);
    });
  }, []);

  useEffect(() => {
    (supabase.from("league_activities") as any)
      .select("*")
      .eq("is_open", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(6)
      .then(({ data }: any) => setOpenActs((data as any[]) ?? []));
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

  const ranked = useMemo<RankedLeague[]>(
    () =>
      leagues
        .map((l) => ({ ...l, total: points[l.id] ?? 0 }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
        .map((l, i) => ({ ...l, rank: i + 1 })),
    [leagues, points],
  );

  const hasScores = ranked.some((l) => l.total > 0);
  const podium = hasScores ? ranked.slice(0, 3) : [];
  const rest = hasScores ? ranked.slice(3) : ranked;

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
    <main className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            background:
              "radial-gradient(60% 80% at 15% 0%, var(--primary) 0%, transparent 60%), radial-gradient(50% 70% at 90% 10%, var(--accent) 0%, transparent 60%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 pt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-4">
            <Users className="size-3.5" /> Ligas Acadêmicas
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            Onde a medicina <span className="text-primary">acontece</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Explore as ligas ativas de Medicina da Unochapecó, acompanhe o ranking de pontuação e conheça o trabalho de cada uma.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Stat value={leagues.length} label="Ligas ativas" />
            {myLeagues.length > 0 && <Stat value={myLeagues.length} label="Minhas ligas" />}
          </div>
          <div className="mt-6 text-left">
            <AdsBanner placement="ligas" />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pt-8 pb-10">
        {openActs.length > 0 && (
          <section className="mb-14">
            <SectionTitle
              icon={Activity}
              kicker="Interligas"
              title="Próximas atividades abertas"
              subtitle="Atividades abertas divulgadas pelas ligas acadêmicas."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {openActs.map((a) => {
                const lg = leagues.find((l) => l.id === a.league_id);
                return (
                  <Card key={a.id} className="overflow-hidden h-full flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    {a.image_url && (
                      <img src={a.image_url} alt={a.title ?? "Atividade aberta"} className="aspect-video w-full object-cover" loading="lazy" />
                    )}
                    <CardContent className="p-4 flex-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                        Aberta
                      </span>
                      <h3 className="font-black text-base mt-2 leading-tight">{a.title ?? a.caption}</h3>
                      {a.description && (
                        <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-line line-clamp-4">{a.description}</p>
                      )}
                      {lg && (
                        <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-muted-foreground">
                          {lg.icon_url ? (
                            <img src={lg.icon_url} className="size-5 rounded object-contain" alt="" />
                          ) : (
                            <span className="size-5 rounded" style={{ background: lg.theme_color }} />
                          )}
                          <span className="truncate">{lg.name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}


        {user && myLeagues.length > 0 && (
          <section className="mb-14">
            <SectionTitle icon={Star} kicker="Acesso rápido" title="Minhas ligas" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myLeagues.map((league) => {
                const meta = roleMeta[league.my_role];
                const Icon = meta.icon;
                return (
                  <Link key={league.id} to={rolePath[league.my_role]} params={{ slug: league.slug }} className="block min-w-0 group">
                    <Card className="overflow-hidden h-full border-primary/20 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                      <div
                        className="flex items-center gap-3 p-4 min-w-0"
                        style={{ background: `linear-gradient(135deg, ${league.theme_color}22, transparent)` }}
                      >
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
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
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
            {podium.length > 0 && (
              <section className="mb-14">
                <SectionTitle
                  icon={Trophy}
                  kicker="Ranking"
                  title="Pódio das ligas"
                  subtitle="Pontuação acumulada atribuída pelo CAMED."
                />
                <div className="grid gap-4 sm:grid-cols-3 items-end">
                  {podium.map((l, i) => (
                    <PodiumCard key={l.id} league={l} place={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section>
                <SectionTitle
                  icon={Users}
                  kicker={hasScores ? "Classificação" : "Todas as ligas"}
                  title={hasScores ? "Demais ligas" : "Todas as ligas"}
                />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rest.map((l) => (
                    <LeagueCard key={l.id} league={l} showRank={hasScores} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur px-5 py-3 text-left">
      <div className="text-2xl font-black tabular-nums leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  kicker,
  title,
  subtitle,
}: {
  icon: any;
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
        <Icon className="size-3.5" /> {kicker}
      </div>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

const PODIUM_STYLE = [
  {
    icon: Crown,
    ring: "border-amber-400/70",
    badge: "bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950",
    glow: "shadow-[0_18px_40px_-18px_rgba(251,191,36,.55)]",
    lift: "sm:-mt-4",
  },
  {
    icon: Medal,
    ring: "border-slate-300/70",
    badge: "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900",
    glow: "shadow-[0_14px_34px_-18px_rgba(148,163,184,.55)]",
    lift: "",
  },
  {
    icon: Trophy,
    ring: "border-orange-400/70",
    badge: "bg-gradient-to-r from-orange-400 to-amber-600 text-orange-950",
    glow: "shadow-[0_14px_34px_-18px_rgba(251,146,60,.55)]",
    lift: "",
  },
];

function PodiumCard({ league, place }: { league: RankedLeague; place: number }) {
  const st = PODIUM_STYLE[place - 1] ?? PODIUM_STYLE[2];
  const Icon = st.icon;
  return (
    <Link to="/$slug" params={{ slug: league.slug }} className="block min-w-0 group">
      <Card className={`relative h-full overflow-hidden border-2 ${st.ring} ${st.glow} ${st.lift} p-6 text-center transition-all duration-300 group-hover:-translate-y-1.5`}>
        <div
          className="pointer-events-none absolute inset-x-0 -top-16 h-32 opacity-40 blur-2xl"
          style={{ background: league.theme_color }}
        />
        <div className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${st.badge}`}>
          <Icon className="size-3.5" /> {place}º lugar
        </div>
        <div className="relative mt-5 flex justify-center">
          {league.icon_url ? (
            <img src={league.icon_url} alt={league.name} className="size-20 rounded-2xl border-4 border-background bg-background object-contain shadow-lg" />
          ) : (
            <div className="size-20 rounded-2xl flex items-center justify-center border-4 border-background shadow-lg" style={{ background: league.theme_color }}>
              <Activity className="size-9 text-white/80" />
            </div>
          )}
        </div>
        <h3 className="relative mt-4 font-black text-lg truncate">{league.name}</h3>
        {league.description && (
          <p className="relative text-xs text-muted-foreground mt-1 line-clamp-2">{league.description}</p>
        )}
        <div className="relative mt-4 text-4xl font-black tabular-nums leading-none">{league.total}</div>
        <div className="relative text-[10px] uppercase tracking-widest text-muted-foreground mt-1">pontos</div>
        <div className="relative mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary">
          Acessar <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
        </div>
      </Card>
    </Link>
  );
}

function LeagueCard({ league, showRank }: { league: RankedLeague; showRank: boolean }) {
  return (
    <Link to="/$slug" params={{ slug: league.slug }} className="block group min-w-0">
      <Card className="overflow-hidden h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
        <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${league.theme_color}, ${league.theme_color}aa)` }}>
          {showRank && (
            <span className="absolute top-3 left-3 rounded-full bg-background/85 backdrop-blur px-2.5 py-1 text-[11px] font-black tabular-nums">
              {league.rank}º
            </span>
          )}
          <span className="absolute top-3 right-3 rounded-full bg-background/85 backdrop-blur px-2.5 py-1 text-[11px] font-black tabular-nums">
            {league.total} pts
          </span>
          {league.icon_url ? (
            <img
              src={league.icon_url}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-20 rounded-2xl border-4 border-background bg-background object-contain"
              alt={league.name}
            />
          ) : (
            <Activity className="absolute bottom-3 right-3 size-14 text-white/30" />
          )}
        </div>
        <CardContent className="pt-12 text-center">
          <h3 className="font-black text-lg truncate">{league.name}</h3>
          {league.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{league.description}</p>}
          <div className="flex items-center justify-center gap-1 mt-4 text-xs text-primary font-bold uppercase tracking-widest">
            Acessar <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
