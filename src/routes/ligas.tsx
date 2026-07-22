import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { League } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowRight, Users } from "lucide-react";
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

function LigasPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  useEffect(() => {
    supabase.from("public_leagues").select("*").order("name").then(({ data }) => {
      setLeagues((data as League[]) ?? []);
    });
  }, []);
  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-3">
          <Users className="size-3.5" /> Ligas
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Ligas Acadêmicas</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
          Explore as ligas ativas de Medicina da Unochapecó e conheça o trabalho de cada uma.
        </p>
      </div>
      {leagues.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Nenhuma liga publicada ainda.</Card>
      ) : (
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
      )}
    </main>
  );
}
