import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Stethoscope, LogIn, BookOpen, Mail, Plus, Trash2, Calendar as CalIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarPlus } from "lucide-react";
import { buildIcs, downloadIcs, type IcsEvent } from "@/lib/ics";
import { listSubjects, listPersonalItems, upsertPersonalItem, deletePersonalItem } from "@/lib/curriculum.functions";
import { listScheduleWeek } from "@/lib/schedule.functions";
import { ScheduleGrid, ScheduleLegend, getMonday, toISODate, type ExtraEvent } from "@/components/schedule-grid";


export const Route = createFileRoute("/aluno")({
  head: () => ({
    meta: [
      { title: "Aluno — MEDUNO" },
      { name: "description", content: "Painel do estudante de Medicina da Unochapecó: matérias, professores e agenda pessoal." },
      { property: "og:title", content: "Aluno — MEDUNO" },
      { property: "og:description", content: "Painel do estudante de Medicina da Unochapecó." },
    ],
  }),
  component: AlunoGate,
});

function AlunoGate() {
  const { isAdminMaster, loading } = useAuth();
  if (loading) return null;
  if (!isAdminMaster) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gradient-to-b from-emerald-950 via-neutral-950 to-neutral-950">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="size-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30">
            <Stethoscope className="size-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Aba em manutenção</h1>
          <p className="text-sm text-neutral-400">
            A área do Aluno está temporariamente em manutenção. Voltaremos em breve com novidades.
          </p>
          <Button asChild variant="outline" className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <AlunoPage />;
}

type Subject = {
  id: string; name: string; class_codes: string[]; subdivisions: string[];
  professor: string | null; professor_contact: string | null; workload_hours: number | null;
};
type PersonalItem = {
  id: string; title: string; date: string;
  start_time: string | null; end_time: string | null; color: string; notes: string | null;
};

function AlunoPage() {
  const { user, profile, loading } = useAuth();
  const listSubj = useServerFn(listSubjects);
  const listItems = useServerFn(listPersonalItems);
  const deleteItem = useServerFn(deletePersonalItem);
  const loadWeek = useServerFn(listScheduleWeek);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<PersonalItem[]>([]);
  const [mySub, setMySub] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalItem | null>(null);
  const [view, setView] = useState<"day" | "week">("week");
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [weekEntries, setWeekEntries] = useState<any[]>([]);
  const [weekHolidays, setWeekHolidays] = useState<any[]>([]);
  const [otherEntries, setOtherEntries] = useState<any[]>([]);
  const [extraEvents, setExtraEvents] = useState<ExtraEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [extraWeeks, setExtraWeeks] = useState<{ monday: Date; entries: any[]; holidays: any[] }[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  const classCode = (profile as any)?.class_code as string | null;

  // Persist per-subject subdivision selection in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("meduno:mySub");
      if (raw) setMySub(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("meduno:mySub", JSON.stringify(mySub)); } catch { /* ignore */ }
  }, [mySub]);

  const reload = async () => {
    const [s, i] = await Promise.all([listSubj(), listItems({ data: {} })]);
    setSubjects((s as any[]) ?? []);
    setItems((i as any[]) ?? []);
  };
  const reloadWeek = async () => {
    const weekStart = toISODate(monday);
    const weekEnd = toISODate(new Date(monday.getTime() + 6 * 86400000));
    const r = await loadWeek({ data: { weekStart } });
    const all = ((r as any).entries ?? []) as any[];
    setWeekEntries(classCode ? all.filter((e) => e.class_code === classCode) : []);
    setOtherEntries(all);
    setWeekHolidays((r as any).holidays ?? []);

    // Registered events (atlética + ligas)
    if (user) {
      const [{ data: eventRegs }, { data: leagueEvts }, { data: atlEvts }, { data: myLeagues }] = await Promise.all([
        supabase.from("event_registrations").select("event_id").eq("user_id", user.id),
        supabase.from("league_events").select("id, league_id, title, event_date").gte("event_date", weekStart).lte("event_date", weekEnd),
        supabase.from("athletic_events").select("id, title, starts_at, ends_at").gte("starts_at", weekStart + "T00:00:00").lte("starts_at", weekEnd + "T23:59:59"),
        supabase.from("league_memberships").select("league_id").eq("user_id", user.id),
      ]);
      const regIds = new Set((eventRegs ?? []).map((r: any) => r.event_id));
      const leagueIds = new Set((myLeagues ?? []).map((m: any) => m.league_id));
      const extras: ExtraEvent[] = [];
      for (const ev of (atlEvts ?? []) as any[]) {
        if (regIds.has(ev.id)) {
          const d = new Date(ev.starts_at);
          extras.push({
            id: `atl-${ev.id}`, title: ev.title, date: d.toISOString().slice(0, 10),
            start_time: d.toTimeString().slice(0, 5),
            end_time: ev.ends_at ? new Date(ev.ends_at).toTimeString().slice(0, 5) : null,
            source: "atletica",
          });
        }
      }
      for (const ev of (leagueEvts ?? []) as any[]) {
        if (!ev.event_date) continue;
        if (regIds.has(ev.id) || leagueIds.has(ev.league_id)) {
          extras.push({ id: `lg-${ev.id}`, title: ev.title, date: ev.event_date, start_time: null, end_time: null, source: "liga" });
        }
      }
      setExtraEvents(extras);
    }
  };

  useEffect(() => { if (user) reload(); }, [user]);
  useEffect(() => { if (user && view === "week") reloadWeek(); }, [user, view, monday, classCode]);

  // Semanas extras (expandir: +4 semanas na vertical)
  useEffect(() => {
    if (!user || !expanded || view !== "week") { setExtraWeeks([]); return; }
    let cancelled = false;
    (async () => {
      const weeks: { monday: Date; entries: any[]; holidays: any[] }[] = [];
      for (let i = 1; i <= 4; i++) {
        const m = new Date(monday); m.setDate(m.getDate() + i * 7);
        const r: any = await loadWeek({ data: { weekStart: toISODate(m) } });
        const all = (r.entries ?? []) as any[];
        weeks.push({ monday: m, entries: classCode ? all.filter((e) => e.class_code === classCode) : [], holidays: r.holidays ?? [] });
      }
      if (!cancelled) setExtraWeeks(weeks);
    })();
    return () => { cancelled = true; };
  }, [user, expanded, view, monday, classCode]);


  const mySubjects = useMemo(
    () => subjects.filter((s) => !classCode || s.class_codes?.includes(classCode)),
    [subjects, classCode]
  );

  // Filter week entries by student's subdivision per subject
  const filteredWeekEntries = useMemo(() => {
    return weekEntries.filter((e) => {
      if (!e.subject_id) return true;
      const subj = subjects.find((s) => s.id === e.subject_id);
      if (!subj || (subj.subdivisions?.length ?? 1) <= 1) return true;
      const chosen = mySub[e.subject_id] ?? "A";
      return e.subdivision === chosen;
    });
  }, [weekEntries, subjects, mySub]);

  const weekPersonalItems = useMemo(() => {
    const start = toISODate(monday);
    const end = toISODate(new Date(monday.getTime() + 6 * 86400000));
    return items.filter((i) => i.date >= start && i.date <= end);
  }, [items, monday]);

  const today = new Date().toISOString().slice(0, 10);
  const todayItems = items.filter((i) => i.date === today);
  const upcoming = items.filter((i) => i.date > today).slice(0, 5);

  const onDeleteItem = async (id: string) => {
    if (!confirm("Excluir esse item?")) return;
    try { await deleteItem({ data: { id } }); toast.success("Excluído"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const applySubFilter = (list: any[]) => list.filter((e) => {
    if (!e.subject_id) return true;
    const subj = subjects.find((s) => s.id === e.subject_id);
    if (!subj || (subj.subdivisions?.length ?? 1) <= 1) return true;
    return e.subdivision === (mySub[e.subject_id] ?? "A");
  });

  const doExportAgenda = () => {
    const all = [{ entries: filteredWeekEntries }, ...extraWeeks.map((w) => ({ entries: applySubFilter(w.entries) }))];
    const events: IcsEvent[] = [];
    for (const w of all) {
      for (const e of w.entries as any[]) {
        if (e.rescheduled_to_date) continue;
        events.push({
          uid: `entry-${e.id}`,
          title: e.kind === "green_zone" ? "Zona verde" : (e.subject?.name ?? "Aula"),
          date: e.date,
          start: e.start_time,
          end: e.end_time,
          description: [e.subject?.professor ? `Prof. ${e.subject.professor}` : null, `Turma ${e.class_code}`, e.notes].filter(Boolean).join(" · "),
        });
      }
    }
    for (const p of items) {
      events.push({ uid: `personal-${p.id}`, title: p.title, date: p.date, start: p.start_time, end: p.end_time, description: p.notes });
    }
    for (const ev of extraEvents) {
      events.push({ uid: `extra-${ev.id}`, title: ev.title, date: ev.date, start: ev.start_time, end: ev.end_time, description: ev.source === "atletica" ? "Atlética" : "Liga" });
    }
    if (events.length === 0) { toast.error("Nada para exportar nesse período."); setExportOpen(false); return; }
    downloadIcs(buildIcs(events));
    setExportOpen(false);
    toast.success("Cronograma exportado! Importe o arquivo na sua agenda Google.");
    window.open("https://calendar.google.com/calendar/u/0/r/settings/export", "_blank", "noopener");
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Carregando…</div>;

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="mx-auto size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4"><Stethoscope className="size-8" /></div>
        <h1 className="text-3xl font-black">Painel do Aluno</h1>
        <p className="text-muted-foreground mt-2">Faça login para acessar seu cronograma e matérias.</p>
        <Button asChild className="mt-6"><Link to="/auth"><LogIn className="size-4" /> Entrar</Link></Button>
      </div>
    );
  }

  const isStudent = (profile as any)?.is_unochapeco_student === true;
  if (!isStudent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-black">Área exclusiva para estudantes</h1>
        <p className="text-muted-foreground mt-2">O painel do Aluno é para estudantes de Medicina da Unochapecó. Se você é aluno(a), atualize seu cadastro no menu do usuário.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background dark:from-emerald-950/20">
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-lg"><Stethoscope className="size-6" /></div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Painel do Aluno</h1>
              <p className="text-sm text-muted-foreground">
                Olá, {profile?.full_name ?? profile?.username}{classCode ? ` · Turma ${classCode}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border/60 p-0.5 bg-background">
              <button onClick={() => setView("day")} className={`px-3 py-1 text-xs font-bold rounded-full ${view === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Dia</button>
              <button onClick={() => setView("week")} className={`px-3 py-1 text-xs font-bold rounded-full ${view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Semana</button>
            </div>
            {isCoordination && (
              <Button asChild variant="outline" size="sm"><Link to="/coordenacao/cronograma"><Settings2 className="size-4" /> Coordenação</Link></Button>
            )}
          </div>
        </div>
      </section>

      {view === "week" && (
        <section className="max-w-6xl mx-auto px-4 pb-6 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => { const m = new Date(monday); m.setDate(m.getDate() - 7); setMonday(m); }}><ChevronLeft className="size-4" /></Button>
              <div className="text-sm font-semibold px-2">
                {monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — {new Date(monday.getTime() + 5 * 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <Button variant="outline" size="icon" onClick={() => { const m = new Date(monday); m.setDate(m.getDate() + 7); setMonday(m); }}><ChevronRight className="size-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setMonday(getMonday(new Date()))}>Hoje</Button>
            </div>
            <ScheduleLegend />
          </div>
          <ScheduleGrid
            monday={monday}
            entries={filteredWeekEntries}
            holidays={weekHolidays}
            classCode={classCode ?? undefined}
            otherClassEntries={otherEntries}
            personalItems={weekPersonalItems as any}
            extraEvents={extraEvents}
          />
        </section>
      )}


      <section className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-4 pb-16">
        {/* Agenda pessoal - hoje */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-emerald-200/60 dark:border-emerald-900/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><CalIcon className="size-4 text-emerald-600" /><h2 className="font-black">Hoje</h2></div>
                <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="size-4" /></Button>
              </div>
              {todayItems.length === 0 && <p className="text-sm text-muted-foreground">Nada agendado para hoje.</p>}
              <div className="space-y-2">
                {todayItems.map((i) => (
                  <div key={i.id} className="flex items-start gap-2 p-2 rounded-lg border border-border/60" style={{ borderLeftColor: i.color, borderLeftWidth: 4 }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{i.title}</div>
                      {(i.start_time || i.end_time) && <div className="text-xs text-muted-foreground">{i.start_time ?? "—"} → {i.end_time ?? "—"}</div>}
                    </div>
                    <button onClick={() => onDeleteItem(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h2 className="font-black mb-3 text-sm">Próximos</h2>
                <div className="space-y-1.5">
                  {upcoming.map((i) => (
                    <div key={i.id} className="text-sm flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: i.color }} />
                      <span className="font-semibold">{new Date(i.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                      <span className="text-muted-foreground truncate">{i.title}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Matérias */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="size-4 text-emerald-600" />
                <h2 className="font-black">Minhas matérias {classCode && <span className="text-muted-foreground font-normal text-sm">· Turma {classCode}</span>}</h2>
              </div>
              {mySubjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum componente cadastrado para sua turma ainda.</p>}
              <div className="grid sm:grid-cols-2 gap-3">
                {mySubjects.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border/60 p-4 hover:border-emerald-500/50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold">{s.name}</div>
                      {s.workload_hours && <Badge variant="outline">{s.workload_hours}h</Badge>}
                    </div>
                    {s.professor && (
                      <div className="text-sm text-muted-foreground mt-1">Prof. {s.professor}</div>
                    )}
                    {s.professor_contact && (
                      <a href={`mailto:${s.professor_contact}`} className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 mt-1 hover:underline">
                        <Mail className="size-3" /> {s.professor_contact}
                      </a>
                    )}
                    {s.subdivisions?.length > 1 && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Turma prática:</span>
                        <select
                          value={mySub[s.id] ?? "A"}
                          onChange={(e) => setMySub((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          className="rounded border border-border bg-background px-2 py-0.5"
                        >
                          {s.subdivisions.map((sd) => <option key={sd} value={sd}>{sd}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <PersonalItemDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={reload} />
    </div>
  );
}

function PersonalItemDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; editing: PersonalItem | null; onSaved: () => void }) {
  const save = useServerFn(upsertPersonalItem);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDate(editing?.date ?? new Date().toISOString().slice(0, 10));
      setStartTime(editing?.start_time ?? "");
      setEndTime(editing?.end_time ?? "");
      setColor(editing?.color ?? "#22c55e");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  const submit = async () => {
    if (!title.trim()) { toast.error("Informe o título"); return; }
    try {
      await save({ data: { id: editing?.id, title, date, start_time: startTime || null, end_time: endTime || null, color, notes: notes || null } });
      toast.success("Salvo"); onOpenChange(false); onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item pessoal"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título*</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Estudo, treino, plantão…" /></div>
          <div><Label>Data*</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-3">
            <Label className="shrink-0">Cor</Label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded border border-border bg-background" />
          </div>
          <div><Label>Notas</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
