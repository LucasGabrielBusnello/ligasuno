import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Calendar, Users, CheckSquare } from "lucide-react";

export const Route = createFileRoute("/diretor/$slug")({ component: DiretorPage });

function DiretorPage() {
  const { slug } = Route.useParams();
  const { user, isAdminMaster, loading } = useAuth();
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
      setLeague(data as League | null);
    })();
  }, [slug]);
  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (!league) return;
    supabase.from("league_memberships").select("role").eq("league_id", league.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setMyRole((data as any)?.role ?? null));
  }, [loading, user, league]);

  if (!league || !user) return <div className="p-12 text-center">Carregando...</div>;
  const allowed = isAdminMaster || league.president_id === user.id || myRole === "diretor";
  if (!allowed) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="text-2xl font-black">Acesso negado</h1>
      <Button asChild className="mt-6"><Link to="/$slug" params={{ slug }}>Voltar</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/$slug" params={{ slug }} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> {league.name}</Link>
          <Badge><ShieldCheck className="size-3 mr-1" />Diretor</Badge>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do Diretor</h1>
        <p className="text-muted-foreground mb-6">{league.name}</p>
        <Tabs defaultValue="freq">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="freq"><CheckSquare className="size-4 mr-1.5" />Frequência</TabsTrigger>
            <TabsTrigger value="agenda"><Calendar className="size-4 mr-1.5" />Eventos da Liga</TabsTrigger>
          </TabsList>
          <TabsContent value="freq" className="mt-6"><FreqTab league={league} /></TabsContent>
          <TabsContent value="agenda" className="mt-6"><AgendaTab league={league} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FreqTab({ league }: { league: League }) {
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.from("league_memberships").select("user_id, role, profiles!inner(username,email)").eq("league_id", league.id)
      .then(({ data }) => setMembers((data ?? []).filter((m: any) => ["ligante", "diretor"].includes(m.role))));
  }, [league.id]);

  async function save() {
    if (!activity || !date) return toast.error("Preencha atividade e data");
    const rows = members.map((m) => ({
      league_id: league.id, activity, activity_date: date,
      user_id: m.user_id, present: !!presence[m.user_id],
    }));
    const { error } = await supabase.from("league_attendance").upsert(rows, { onConflict: "league_id,activity,activity_date,user_id" });
    if (error) return toast.error(error.message);
    toast.success("Frequência salva");
  }

  return (
    <Card><CardContent className="p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Atividade</Label><Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex: Aula de Cardio" /></div>
        <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <label key={m.user_id} className="flex items-center justify-between p-3 rounded border cursor-pointer hover:bg-muted/50">
            <span><span className="font-bold">{m.profiles?.username}</span> <Badge variant="secondary" className="ml-2">{m.role}</Badge></span>
            <input type="checkbox" checked={!!presence[m.user_id]} onChange={(e) => setPresence({ ...presence, [m.user_id]: e.target.checked })} />
          </label>
        ))}
        {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum ligante cadastrado.</p>}
      </div>
      <Button onClick={save} className="w-full"><Users className="size-4" /> Salvar Presenças</Button>
    </CardContent></Card>
  );
}

function AgendaTab({ league }: { league: League }) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("league_events").select("*").eq("league_id", league.id).order("created_at", { ascending: false })
      .then(({ data }) => setEvents(data ?? []));
  }, [league.id]);
  return (
    <Card><CardHeader><CardTitle>Eventos da liga</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento.</p> : events.map((e) => (
          <div key={e.id} className="p-3 rounded border"><div className="font-bold">{e.title}</div>{e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}</div>
        ))}
      </CardContent>
    </Card>
  );
}
