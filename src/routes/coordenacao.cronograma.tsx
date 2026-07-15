import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarPlus, Sparkles, Repeat, Copy, AlertTriangle } from "lucide-react";
import {
  ScheduleGrid, ScheduleLegend, DEFAULT_SHIFT_TIMES, SHIFT_LABEL, getMonday, toISODate, type Shift,
} from "@/components/schedule-grid";
import {
  listScheduleWeek, upsertScheduleEntry, deleteScheduleEntry, rescheduleEntry,
  bulkCreateScheduleEntries, copyScheduleWeek, checkScheduleConflicts,
} from "@/lib/schedule.functions";
import { listSubjects } from "@/lib/curriculum.functions";

const CLASSES = ["ATM31", "ATM30", "ATM29", "ATM28", "ATM27", "ATM26"] as const;

export const Route = createFileRoute("/coordenacao/cronograma")({
  head: () => ({
    meta: [
      { title: "Coordenação · Cronograma — MEDUNO" },
      { name: "description", content: "Edição do cronograma semanal das turmas de Medicina." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoordCronograma,
});

type Subject = { id: string; name: string; class_codes: string[]; subdivisions: string[]; professor: string | null };

function CoordCronograma() {
  const { user, isCoordination, loading } = useAuth();
  const load = useServerFn(listScheduleWeek);
  const listSubj = useServerFn(listSubjects);
  const delEntry = useServerFn(deleteScheduleEntry);
  const saveEntry = useServerFn(upsertScheduleEntry);
  const copyWeek = useServerFn(copyScheduleWeek);

  const [classCode, setClassCode] = useState<string>("ATM31");
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [entries, setEntries] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [panel, setPanel] = useState<{ date: string; shift: Shift } | null>(null);
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; editing?: any; date?: string; shift?: Shift }>({ open: false });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reschedTarget, setReschedTarget] = useState<any | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<Date>(() => { const m = getMonday(new Date()); m.setDate(m.getDate() + 7); return m; });
  const [copyOverwrite, setCopyOverwrite] = useState(false);

  const reload = async () => {
    const weekStart = toISODate(monday);
    const [w, s] = await Promise.all([
      load({ data: { weekStart, classCode: classCode as any } }),
      listSubj(),
    ]);
    const all = ((w as any).entries ?? []) as any[];
    setEntries(all.filter((e) => e.class_code === classCode));
    setHolidays((w as any).holidays ?? []);
    setSubjects((s as any[]) ?? []);
  };

  useEffect(() => { if (user && isCoordination) reload(); }, [user, isCoordination, monday, classCode]);

  const cellEntries = useMemo(
    () => panel ? entries.filter((e) => e.date === panel.date && e.shift === panel.shift) : [],
    [panel, entries]
  );

  if (loading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!user) return <div className="p-10 text-center">Faça login. <Link to="/auth" className="underline">Entrar</Link></div>;
  if (!isCoordination) return <div className="p-10 text-center">Acesso restrito à coordenação.</div>;

  const shiftWeek = (delta: number) => {
    const m = new Date(monday); m.setDate(m.getDate() + delta * 7); setMonday(m);
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta entrada?")) return;
    try { await delEntry({ data: { id } }); toast.success("Excluída"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const onGreenZone = async () => {
    if (!panel) return;
    const [s, e] = DEFAULT_SHIFT_TIMES[panel.shift];
    try {
      await saveEntry({ data: {
        class_code: classCode as any, subdivision: "A", date: panel.date, shift: panel.shift,
        start_time: s, end_time: e, kind: "green_zone", is_abex: false,
      }});
      toast.success("Zona verde marcada"); reload();
    } catch (er: any) { toast.error(er.message); }
  };

  const doCopyWeek = async () => {
    try {
      const r = await copyWeek({ data: {
        class_code: classCode as any,
        fromMonday: toISODate(monday),
        toMonday: toISODate(getMonday(copyTarget)),
        overwrite: copyOverwrite,
      }});
      toast.success(`${(r as any).count} entradas copiadas`);
      setCopyOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/30 via-background to-background dark:from-emerald-950/10">
      <section className="max-w-7xl mx-auto px-4 pt-8 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Cronograma · Coordenação</h1>
            <p className="text-sm text-muted-foreground">Edite as aulas, práticas, avaliações, zonas verdes e remarcações.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/coordenacao/curriculo">Currículo</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/coordenacao/feriados">Feriados</Link></Button>
            <Popover open={copyOpen} onOpenChange={setCopyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Copy className="size-4" /> Copiar semana</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold">Copiar esta semana para…</p>
                    <p className="text-xs text-muted-foreground">Escolha qualquer dia da semana destino.</p>
                  </div>
                  <Calendar mode="single" selected={copyTarget} onSelect={(d) => d && setCopyTarget(d)} className="pointer-events-auto rounded-md border" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={copyOverwrite} onChange={(e) => setCopyOverwrite(e.target.checked)} />
                    Sobrescrever entradas existentes na semana destino
                  </label>
                  <div className="text-xs text-muted-foreground">
                    Destino: {getMonday(copyTarget).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  <Button className="w-full" size="sm" onClick={doCopyWeek}>Copiar</Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={() => setBulkOpen(true)}><CalendarPlus className="size-4" /> Marcar em lote</Button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 space-y-3">
        <Card><CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Turma</Label>
            <Select value={classCode} onValueChange={setClassCode}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            <Input
              type="date"
              className="w-40 h-9"
              value={toISODate(monday)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setMonday(getMonday(new Date(v + "T00:00:00")));
              }}
            />
            <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)}><ChevronLeft className="size-4" /></Button>
            <div className="text-sm font-semibold px-3">
              {monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — {new Date(monday.getTime() + 5 * 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <Button variant="outline" size="icon" onClick={() => shiftWeek(1)}><ChevronRight className="size-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setMonday(getMonday(new Date()))}>Hoje</Button>
          </div>
        </CardContent></Card>

        <ScheduleLegend />

        <ScheduleGrid
          monday={monday}
          entries={entries}
          holidays={holidays}
          classCode={classCode}
          onCellClick={(date, shift) => setPanel({ date, shift })}
        />
      </section>

      {/* Side panel */}
      <Sheet open={!!panel} onOpenChange={(v) => !v && setPanel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {panel && `${new Date(panel.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · ${SHIFT_LABEL[panel.shift]}`}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" onClick={() => panel && setEntryDialog({ open: true, date: panel.date, shift: panel.shift })}><Plus className="size-4" /> Adicionar</Button>
              <Button size="sm" variant="outline" onClick={onGreenZone}><Sparkles className="size-4" /> Zona verde</Button>
            </div>
            <div className="space-y-2">
              {cellEntries.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma entrada.</p>}
              {cellEntries.map((e) => (
                <div key={e.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold">{e.kind === "green_zone" ? "Zona verde" : (e.subject?.name ?? "Aula")}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.start_time?.slice(0,5)}–{e.end_time?.slice(0,5)} · {e.kind}{e.is_abex ? " · ABEX" : ""}
                        {e.subdivision && e.subdivision !== "A" ? ` · Sub ${e.subdivision}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEntryDialog({ open: true, editing: e })}>✎</Button>
                      <Button size="icon" variant="ghost" onClick={() => setReschedTarget(e)}><Repeat className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(e.id)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EntryDialog
        state={entryDialog}
        onClose={() => setEntryDialog({ open: false })}
        subjects={subjects}
        classCode={classCode}
        onSaved={() => { setEntryDialog({ open: false }); reload(); }}
      />
      <BulkDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        subjects={subjects}
        classCode={classCode}
        holidays={holidays}
        onSaved={() => { setBulkOpen(false); reload(); }}
      />
      <RescheduleDialog
        entry={reschedTarget}
        classCode={classCode}
        onClose={() => setReschedTarget(null)}
        onSaved={() => { setReschedTarget(null); reload(); }}
      />
    </div>
  );
}

/* ---------- ENTRY DIALOG ---------- */
function EntryDialog({
  state, onClose, subjects, classCode, onSaved,
}: {
  state: { open: boolean; editing?: any; date?: string; shift?: Shift };
  onClose: () => void;
  subjects: Subject[];
  classCode: string;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertScheduleEntry);
  const editing = state.editing;
  const [subjectId, setSubjectId] = useState<string>("");
  const [subdivision, setSubdivision] = useState("A");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<Shift>("morning");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState<"class" | "practice" | "exam" | "abex">("class");
  const [isAbex, setIsAbex] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    const e = editing;
    const sh: Shift = e?.shift ?? state.shift ?? "morning";
    const [ds, de] = DEFAULT_SHIFT_TIMES[sh];
    setSubjectId(e?.subject_id ?? "");
    setSubdivision(e?.subdivision ?? "A");
    setDate(e?.date ?? state.date ?? new Date().toISOString().slice(0, 10));
    setShift(sh);
    setStart((e?.start_time ?? ds).slice(0, 5));
    setEnd((e?.end_time ?? de).slice(0, 5));
    setKind((e?.kind && e.kind !== "green_zone" ? e.kind : "class") as any);
    setIsAbex(!!e?.is_abex);
  }, [state.open, editing, state.date, state.shift]);

  const filteredSubjects = useMemo(
    () => subjects.filter((s) => s.class_codes?.includes(classCode)),
    [subjects, classCode]
  );
  const currentSubj = subjects.find((s) => s.id === subjectId);

  const submit = async () => {
    try {
      await save({ data: {
        id: editing?.id, class_code: classCode as any, subject_id: subjectId || null,
        subdivision: subdivision || "A", date, shift, start_time: start, end_time: end,
        kind: kind as any, is_abex: kind === "practice" ? isAbex : false, notes: null,
      }});
      toast.success("Salvo"); onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={state.open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar entrada" : "Nova entrada"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Matéria</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {filteredSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {currentSubj && currentSubj.subdivisions?.length > 1 && (
            <div>
              <Label>Subdivisão</Label>
              <Select value={subdivision} onValueChange={setSubdivision}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{currentSubj.subdivisions.map((sd) => <SelectItem key={sd} value={sd}>{sd}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label>Turno</Label>
              <Select value={shift} onValueChange={(v) => {
                const nv = v as Shift; setShift(nv);
                const [s, e] = DEFAULT_SHIFT_TIMES[nv]; setStart(s); setEnd(e);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Manhã</SelectItem>
                  <SelectItem value="afternoon">Tarde</SelectItem>
                  <SelectItem value="night">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Início</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Aula</SelectItem>
                <SelectItem value="practice">Prática</SelectItem>
                <SelectItem value="exam">Avaliação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "practice" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isAbex} onChange={(e) => setIsAbex(e.target.checked)} />
              Prática ABEX
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- BULK DIALOG (multi-seleção com calendário) ---------- */
function BulkDialog({
  open, onClose, subjects, classCode, holidays, onSaved,
}: { open: boolean; onClose: () => void; subjects: Subject[]; classCode: string; holidays: any[]; onSaved: () => void }) {
  const bulk = useServerFn(bulkCreateScheduleEntries);
  const [subjectId, setSubjectId] = useState("");
  const [subdivision, setSubdivision] = useState("A");
  const [shift, setShift] = useState<Shift>("morning");
  const [kind, setKind] = useState<"class" | "practice" | "exam">("class");
  const [isAbex, setIsAbex] = useState(false);
  const [dates, setDates] = useState<Date[]>([]);

  useEffect(() => {
    if (open) {
      setSubjectId(""); setSubdivision("A"); setShift("morning"); setKind("class"); setIsAbex(false); setDates([]);
    }
  }, [open]);

  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h: any) => h.date)), [holidays]);
  const currentSubj = subjects.find((s) => s.id === subjectId);

  const submit = async () => {
    if (dates.length === 0) { toast.error("Selecione ao menos uma data"); return; }
    const [s, e] = DEFAULT_SHIFT_TIMES[shift];
    try {
      const r = await bulk({ data: {
        class_code: classCode as any, subject_id: subjectId || null, subdivision, shift,
        start_time: s, end_time: e, kind, is_abex: kind === "practice" ? isAbex : false,
        dates: dates.map((d) => toISODate(d)),
      }});
      toast.success(`${(r as any).count} entradas criadas`); onSaved();
    } catch (er: any) { toast.error(er.message); }
  };

  const filtered = subjects.filter((s) => s.class_codes?.includes(classCode));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Marcar em lote</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>Matéria</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{filtered.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {currentSubj && currentSubj.subdivisions?.length > 1 && (
              <div>
                <Label>Subdivisão</Label>
                <Select value={subdivision} onValueChange={setSubdivision}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{currentSubj.subdivisions.map((sd) => <SelectItem key={sd} value={sd}>{sd}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Turno</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Manhã</SelectItem>
                  <SelectItem value="afternoon">Tarde</SelectItem>
                  <SelectItem value="night">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Aula</SelectItem>
                  <SelectItem value="practice">Prática</SelectItem>
                  <SelectItem value="exam">Avaliação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind === "practice" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isAbex} onChange={(e) => setIsAbex(e.target.checked)} /> Prática ABEX
              </label>
            )}
            <div className="text-sm text-muted-foreground">
              {dates.length} data{dates.length !== 1 ? "s" : ""} selecionada{dates.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Selecione as datas</Label>
            <Calendar
              mode="multiple"
              selected={dates}
              onSelect={(d) => setDates(d ?? [])}
              disabled={(d) => holidaySet.has(toISODate(d)) || d.getDay() === 0}
              className="pointer-events-auto rounded-md border"
            />
            <p className="text-[11px] text-muted-foreground mt-2">Feriados e domingos estão desabilitados.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Criar ({dates.length})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- RESCHEDULE DIALOG (com aviso de conflito) ---------- */
function RescheduleDialog({ entry, classCode, onClose, onSaved }: { entry: any | null; classCode: string; onClose: () => void; onSaved: () => void }) {
  const resched = useServerFn(rescheduleEntry);
  const checkConflicts = useServerFn(checkScheduleConflicts);
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<Shift>("morning");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      const sh = entry.shift as Shift; setShift(sh);
      const [s, e] = DEFAULT_SHIFT_TIMES[sh]; setStart(s); setEnd(e);
      setConflicts([]);
    }
  }, [entry]);

  useEffect(() => {
    if (!entry || !date) { setConflicts([]); return; }
    let cancelled = false;
    checkConflicts({ data: { class_code: classCode as any, date, shift, excludeId: entry.id } })
      .then((r) => { if (!cancelled) setConflicts((r as any[]) ?? []); })
      .catch(() => { if (!cancelled) setConflicts([]); });
    return () => { cancelled = true; };
  }, [entry, date, shift, classCode]);

  if (!entry) return null;
  const submit = async () => {
    if (conflicts.length > 0 && !confirm(`Já existem ${conflicts.length} entrada(s) nesse turno. Remarcar mesmo assim?`)) return;
    try {
      await resched({ data: { entryId: entry.id, newDate: date, newShift: shift, newStartTime: start, newEndTime: end } });
      toast.success("Remarcada"); onSaved();
    } catch (er: any) { toast.error(er.message); }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Remarcar aula</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nova data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>Turno</Label>
            <Select value={shift} onValueChange={(v) => {
              const nv = v as Shift; setShift(nv);
              const [s, e] = DEFAULT_SHIFT_TIMES[nv]; setStart(s); setEnd(e);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Manhã</SelectItem>
                <SelectItem value="afternoon">Tarde</SelectItem>
                <SelectItem value="night">Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Início</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-sm">
                <AlertTriangle className="size-4" /> Conflito de horário
              </div>
              <ul className="mt-2 text-xs space-y-1">
                {conflicts.map((c: any) => (
                  <li key={c.id}>• {c.subject?.name ?? c.kind} — {c.start_time?.slice(0,5)}–{c.end_time?.slice(0,5)}{c.subdivision !== "A" ? ` (Sub ${c.subdivision})` : ""}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Remarcar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
