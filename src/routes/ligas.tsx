import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { League } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowRight, Users, Star, ShieldCheck, GraduationCap } from "lucide-react";
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

  useEffect(() => {
    supabase.from("public_leagues").select("*").order("name").then(({ data }) => {
      setLeagues((data as League[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (!user) { setMyLeagues([]); return; }
    (async () => {
      const [{ data: memberships }, { data: presided }] = await Promise.all([
        supabase.from("league_memberships").select("league_id, role, leagues(*)").eq("user_id", user.id),
        supabase.from("leagues").select("*").eq("president_id", user.id),
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
    </main>
  );
}
