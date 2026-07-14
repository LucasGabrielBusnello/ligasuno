import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User as UserIcon, GraduationCap, Users2, Trophy, CalendarDays, BookOpen, ShieldCheck, Sparkles, ClipboardList } from "lucide-react";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";

export const Route = createFileRoute("/painel")({ component: PainelPage });

type Section = "perfil" | "ligas" | "atletica" | "eventos" | "quizzes" | "materias";

function PainelPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [section, setSection] = useState<Section>("perfil");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user]);

  if (loading || !user) return <div className="p-12 text-center text-muted-foreground">Carregando...</div>;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-neutral-950">
        <PanelSidebar section={section} setSection={setSection} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/50 bg-background/60 backdrop-blur sticky top-0 z-30 flex items-center gap-3 px-4">
            <SidebarTrigger />
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> Início</Link>
            <div className="ml-auto text-xs text-muted-foreground truncate max-w-[50%]">
              {profile?.full_name || profile?.username || user.email}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
            {section === "perfil" && <PerfilSection />}
            {section === "ligas" && <MinhasLigasSection />}
            {section === "atletica" && <AtleticaSection />}
            {section === "eventos" && <MeusEventosSection />}
            {section === "quizzes" && <MeusQuizzesSection />}
            {section === "materias" && <MateriasSection />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function PanelSidebar({ section, setSection }: { section: Section; setSection: (s: Section) => void }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const items: Array<{ id: Section; label: string; icon: any }> = [
    { id: "perfil", label: "Perfil", icon: UserIcon },
    { id: "ligas", label: "Minhas Ligas", icon: Users2 },
    { id: "atletica", label: "Atlética", icon: Trophy },
    { id: "eventos", label: "Meus Eventos", icon: CalendarDays },
    { id: "quizzes", label: "Meus Quizzes", icon: ClipboardList },
    { id: "materias", label: "Matérias", icon: BookOpen },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Painel do Aluno</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.id}>
                  <SidebarMenuButton onClick={() => setSection(it.id)} isActive={section === it.id}>
                    <it.icon className="size-4" />
                    {!collapsed && <span>{it.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

/* ============= PERFIL ============= */
function PerfilSection() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => { /* trigger re-render */ }, [reload]);
  if (!user) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black flex items-center gap-2"><UserIcon className="size-7 text-orange-500" /> Meu Perfil</h1>
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-20 rounded-full object-cover" />
          ) : (
            <div className="size-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-black text-primary">
              {(profile?.username || user.email || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg truncate">{profile?.full_name || profile?.username}</div>
            <div className="text-sm text-muted-foreground truncate">{user.email}</div>
            {profile?.phone && <div className="text-xs text-muted-foreground mt-0.5">{profile.phone}</div>}
          </div>
          <Button onClick={() => setOpen(true)}>Editar perfil</Button>
        </CardContent>
      </Card>
      <ProfileEditDialog open={open} onOpenChange={setOpen} userId={user.id} />
    </div>
  );
}

/* ============= MINHAS LIGAS ============= */
function MinhasLigasSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: mem }, { data: presLeagues }] = await Promise.all([
        supabase.from("league_memberships").select("role, leagues(*)").eq("user_id", user.id),
        supabase.from("leagues").select("*").eq("president_id", user.id),
      ]);
      const map = new Map<string, any>();
      (mem ?? []).forEach((m: any) => { if (m.leagues) map.set(m.leagues.id, { league: m.leagues, role: m.role }); });
      (presLeagues ?? []).forEach((l: any) => { map.set(l.id, { league: l, role: "presidente" }); });
      setRows(Array.from(map.values()));
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black flex items-center gap-2"><Users2 className="size-7 text-orange-500" /> Minhas Ligas</h1>
      {rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você ainda não faz parte de nenhuma liga. Explore no <Link to="/" className="underline">início</Link>.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {rows.map(({ league, role }) => {
            const routeByRole = role === "presidente" ? `/presidente/${league.slug}` : role === "diretor" ? `/diretor/${league.slug}` : `/ligante/${league.slug}`;
            return (
              <Card key={league.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex gap-3 items-center">
                  {league.icon_url ? <img src={league.icon_url} alt="" className="size-12 rounded-lg object-cover" /> : <div className="size-12 rounded-lg" style={{ background: league.theme_color }} />}
                  <div className="flex-1 min-w-0">
                    <div className="font-black truncate">{league.name}</div>
                    <Badge variant="outline" className="text-[10px] mt-1">{role}</Badge>
                  </div>
                  <Button asChild size="sm"><Link to={routeByRole as any}>Acessar</Link></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============= ATLÉTICA ============= */
function AtleticaSection() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<any>(null);
  const [sports, setSports] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ath } = await supabase.from("athletics").select("id, name, president_id").limit(1).maybeSingle();
      if (!ath) return;
      const { data: mem } = await supabase.from("athletic_memberships").select("*").eq("user_id", user.id).eq("athletic_id", (ath as any).id).maybeSingle();
      setMembership(mem);
      const { data: enrols } = await supabase.from("athletic_sport_enrollments").select("sport_id, athletic_sports(*)").eq("user_id", user.id);
      setSports((enrols ?? []).map((e: any) => e.athletic_sports).filter(Boolean));
    })();
  }, [user]);

  const active = membership?.active && (!membership?.member_until || new Date(membership.member_until) >= new Date());
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black flex items-center gap-2"><Trophy className="size-7 text-orange-500" /> Atlética</h1>
      <Card>
        <CardContent className="p-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-black">Status de sócio</div>
            {active ? (
              <Badge className="bg-green-600 mt-1"><ShieldCheck className="size-3 mr-1" /> Ativo até {new Date(membership.member_until).toLocaleDateString("pt-BR")}</Badge>
            ) : (
              <Badge variant="secondary" className="mt-1">Não sócio</Badge>
            )}
          </div>
          <Button asChild><Link to="/atletica">Abrir Atlética</Link></Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Meus esportes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sports.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma inscrição em esportes.</p>}
          {sports.map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg border">
              <Trophy className="size-4 text-orange-500" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{s.name}</div>
                {s.gender && <div className="text-[10px] uppercase text-muted-foreground">{s.gender}</div>}
              </div>
              {s.whatsapp_url && (
                <a href={s.whatsapp_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md hover:opacity-90">WhatsApp</a>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============= EVENTOS ============= */
function MeusEventosSection() {
  const { user } = useAuth();
  const [regs, setRegs] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("event_registrations").select("*, league_events(*, leagues(name, slug))").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRegs(data ?? []));
  }, [user]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black flex items-center gap-2"><CalendarDays className="size-7 text-orange-500" /> Meus Eventos</h1>
      {regs.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma inscrição em eventos.</CardContent></Card>}
      <div className="space-y-2">
        {regs.map((r) => {
          const ev = r.league_events;
          if (!ev) return null;
          return (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <CalendarDays className="size-5 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{ev.title}</div>
                  <div className="text-xs text-muted-foreground">{ev.leagues?.name} · {ev.event_date ? new Date(ev.event_date).toLocaleDateString("pt-BR") : "sem data"}</div>
                </div>
                <Badge variant={r.status === "paid" || r.status === "confirmed" ? "default" : "secondary"}>{r.status ?? "inscrito"}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============= QUIZZES ============= */
function MeusQuizzesSection() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ answered: 0, correct: 0 });
  useEffect(() => {
    if (!user) return;
    supabase.from("league_quiz_answers").select("is_correct").eq("user_id", user.id).then(({ data }) => {
      const arr = data ?? [];
      setStats({ answered: arr.length, correct: arr.filter((a: any) => a.is_correct).length });
    });
  }, [user]);
  const pct = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black flex items-center gap-2"><ClipboardList className="size-7 text-orange-500" /> Meus Quizzes</h1>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-6 text-center"><div className="text-3xl font-black">{stats.answered}</div><div className="text-xs text-muted-foreground uppercase">Respondidas</div></CardContent></Card>
        <Card><CardContent className="p-6 text-center"><div className="text-3xl font-black text-emerald-500">{stats.correct}</div><div className="text-xs text-muted-foreground uppercase">Acertos</div></CardContent></Card>
        <Card><CardContent className="p-6 text-center"><div className="text-3xl font-black text-orange-500">{pct}%</div><div className="text-xs text-muted-foreground uppercase">Aproveitamento</div></CardContent></Card>
      </div>
      <p className="text-sm text-muted-foreground">Acesse os cadernos de quiz na página de cada liga que você faz parte.</p>
    </div>
  );
}

/* ============= MATÉRIAS ============= */
function MateriasSection() {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachersMap, setTeachersMap] = useState<Record<string, any[]>>({});
  const sem = (profile as any)?.current_semester ?? null;


  useEffect(() => {
    if (!sem) return;
    (async () => {
      const { data: subs } = await supabase.from("subjects").select("*").eq("semester", sem).order("name");
      setSubjects(subs ?? []);
      const ids = (subs ?? []).map((s: any) => s.id);
      if (ids.length) {
        const { data: rel } = await supabase.from("subject_teachers").select("subject_id, teachers(*)").in("subject_id", ids);
        const map: Record<string, any[]> = {};
        (rel ?? []).forEach((r: any) => {
          if (!map[r.subject_id]) map[r.subject_id] = [];
          if (r.teachers) map[r.subject_id].push(r.teachers);
        });
        setTeachersMap(map);
      }
    })();
  }, [sem]);

  if (!(profile as any)?.is_unochapeco_student) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-black flex items-center gap-2"><BookOpen className="size-7 text-orange-500" /> Matérias</h1>
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Disponível apenas para alunos da Unochapecó. Atualize seu perfil se for aluno.</CardContent></Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black flex items-center gap-2"><BookOpen className="size-7 text-orange-500" /> Matérias</h1>
      <Card><CardContent className="p-4 flex items-center gap-2"><Sparkles className="size-4 text-orange-500" /><span className="text-sm">Você está no <b>{sem}º semestre</b>.</span></CardContent></Card>
      {subjects.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma matéria cadastrada para este semestre.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {subjects.map((s) => (
            <Card key={s.id}>
              <CardHeader><CardTitle className="text-base">{s.name}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                {(teachersMap[s.id] ?? []).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50">
                    {teachersMap[s.id].map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        {t.photo_url && <img src={t.photo_url} alt="" className="size-6 rounded-full object-cover" />}
                        <span>{t.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
