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
  ScheduleGrid, ScheduleLegend, DEFAULT_SHIFT_TIMES, SHIFT_LABEL, getMonday, toISODate, type Shift, DEFAULT_KIND_COLORS } from "@/components/schedule-grid";
import {
  listScheduleWeek, upsertScheduleEntry, deleteScheduleEntry, rescheduleEntry,
  bulkCreateScheduleEntries, copyScheduleWeek, checkScheduleConflicts,
  listClassGroups, addClassGroup, deleteClassGroup,
  listEntriesNeedingGroups, setEntryGroups, setSubjectGroups,
  listEntriesWithoutSubject, assignSubjectToEntries,

} from "@/lib/schedule.functions";
import { listSubjects, listTerms } from "@/lib/curriculum.functions";
import { ScheduleImportButton } from "@/components/schedule-import-dialog";


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
  const listTermsFn = useServerFn(listTerms);
  const delEntry = useServerFn(deleteScheduleEntry);
  const saveEntry = useServerFn(upsertScheduleEntry);
  const copyWeek = useServerFn(copyScheduleWeek);

  const [classCode, setClassCode] = useState<string>("ATM31");
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [entries, setEntries] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentTerm, setCurrentTerm] = useState<any | null>(null);

  const [panel, setPanel] = useState<{ date: string; shift: Shift } | null>(null);
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; editing?: any; date?: string; shift?: Shift }>({ open: false });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reschedTarget, setReschedTarget] = useState<any | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<Date>(() => { const m = getMonday(new Date()); m.setDate(m.getDate() + 7); return m; });
  const [copyOverwrite, setCopyOverwrite] = useState(false);

  const reload = async () => {
    const weekStart = toISODate(monday);
    const [w, s, t] = await Promise.all([
      load({ data: { weekStart, classCode: classCode as any } }),
      listSubj(),
      listTermsFn(),
    ]);
    const all = ((w as any).entries ?? []) as any[];
    setEntries(all.filter((e) => e.class_code === classCode || e.subdivision === "*"));
    setHolidays((w as any).holidays ?? []);
    setSubjects((s as any[]) ?? []);
    const terms = (t as any[]) ?? [];
    setCurrentTerm(terms.find((x) => x.is_current) ?? terms[0] ?? null);
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-neutral-950 to-neutral-950 text-neutral-100 dark">
      <section className="max-w-7xl mx-auto px-4 pt-8 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Cronograma · Coordenação</h1>
            <p className="text-sm text-muted-foreground">Edite as aulas, práticas, avaliações, zonas verdes e remarcações.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/coordenacao/curriculo">Currículo</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/coordenacao/feriados">Feriados</Link></Button>
            <ScheduleImportButton defaultClass={classCode} termId={currentTerm?.id ?? null} onDone={reload} />

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

        {currentTerm && (() => {
          const weekEnd = new Date(monday); weekEnd.setDate(weekEnd.getDate() + 5);
          const startD = new Date(currentTerm.start_date + "T00:00:00");
          const endD = new Date(currentTerm.end_date + "T00:00:00");
          const out = weekEnd < startD || monday > endD;
          return out ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Semana fora do período letivo <b>{currentTerm.name}</b> ({new Date(currentTerm.start_date+"T00:00:00").toLocaleDateString("pt-BR")} — {new Date(currentTerm.end_date+"T00:00:00").toLocaleDateString("pt-BR")}).
            </div>
          ) : null;
        })()}

        <ScheduleLegend />

        <ScheduleGrid
          monday={monday}
          entries={entries}
          holidays={holidays}
          classCode={classCode}
          onCellClick={(date, shift) => setPanel({ date, shift })}
        />

        <PendingGroupsPanel classCode={classCode} subjects={subjects} reloadKey={entries.length} onChanged={reload} />
        <UnlinkedSubjectPanel classCode={classCode} subjects={subjects} reloadKey={entries.length} onChanged={reload} />
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
  const loadGroups = useServerFn(listClassGroups);
  const addGroup = useServerFn(addClassGroup);
  const delGroup = useServerFn(deleteClassGroup);
  const editing = state.editing;
  const [subjectId, setSubjectId] = useState<string>("");
  const [subdivision, setSubdivision] = useState("A");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<Shift>("morning");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState<"class" | "practice" | "exam">("class");
  const [color, setColor] = useState<string>(DEFAULT_KIND_COLORS.class);
  const [customColor, setCustomColor] = useState(false);
  const [groups, setGroups] = useState<{ id: string; letter: string }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");

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
    setKind((e?.kind && e.kind !== "green_zone" && e.kind !== "abex" ? e.kind : "class") as any);
    setColor((e?.color as string) ?? DEFAULT_KIND_COLORS[(e?.kind as string) ?? "class"] ?? DEFAULT_KIND_COLORS.class);
    setCustomColor(!!e?.color);
    setSelectedGroups(Array.isArray(e?.practice_groups) ? e.practice_groups : []);
    setNewGroup("");
  }, [state.open, editing, state.date, state.shift]);

  const refreshGroups = async () => {
    try { setGroups((await loadGroups({ data: { class_code: classCode as any } })) as any); } catch { /* noop */ }
  };
  useEffect(() => { if (state.open) refreshGroups(); }, [state.open, classCode]);

  const filteredSubjects = useMemo(
    () => subjects.filter((s) => s.class_codes?.includes(classCode)),
    [subjects, classCode]
  );
  const currentSubj = subjects.find((s) => s.id === subjectId);
  const availableSubs = useMemo(() => {
    const list = currentSubj?.subdivisions?.length ? currentSubj.subdivisions : ["A"];
    return Array.from(new Set([...list, "*"]));
  }, [currentSubj]);

  const isAbexSubject = /abex/i.test(currentSubj?.name ?? "");
  const showGroups = kind === "practice" || isAbexSubject;

  const submit = async () => {
    try {
      await save({ data: {
        id: editing?.id, class_code: classCode as any, subject_id: subjectId || null,
        subdivision: subdivision || "A", date, shift, start_time: start, end_time: end,
        kind: kind as any, is_abex: isAbexSubject, color: customColor ? color : null,
        practice_groups: showGroups ? selectedGroups : [], notes: null,
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
          <div>
            <Label>Subdivisão</Label>
            <Select value={subdivision} onValueChange={setSubdivision}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableSubs.map((sd) => (
                  <SelectItem key={sd} value={sd}>{sd === "*" ? "Todas as turmas (*)" : sd}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {showGroups && (
            <div className="rounded-lg border border-border/60 p-3 space-y-2">
              <Label className="mb-0">Turmas com prática neste turno</Label>
              <div className="flex flex-wrap gap-1.5">
                {groups.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">Nenhuma turma cadastrada para {classCode}.</p>
                )}
                {groups.map((g) => {
                  const on = selectedGroups.includes(g.letter);
                  return (
                    <span key={g.id} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedGroups((prev) => on ? prev.filter((l) => l !== g.letter) : [...prev, g.letter])}
                        className={`rounded-l-md border px-2.5 py-1 text-xs font-bold ${on ? "bg-emerald-600 text-white border-emerald-600" : "border-border/60 text-muted-foreground"}`}
                      >
                        {g.letter}
                      </button>
                      <button
                        type="button"
                        title="Remover turma"
                        onClick={async () => {
                          await delGroup({ data: { id: g.id } });
                          setSelectedGroups((prev) => prev.filter((l) => l !== g.letter));
                          refreshGroups();
                        }}
                        className="rounded-r-md border border-l-0 border-border/60 px-1.5 py-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Nova turma (ex.: A)" className="h-8" />
                <Button size="sm" variant="outline" onClick={async () => {
                  const letter = newGroup.trim().toUpperCase();
                  if (!letter) return;
                  try { await addGroup({ data: { class_code: classCode as any, letter } }); setNewGroup(""); refreshGroups(); }
                  catch (e: any) { toast.error(e.message); }
                }}>Adicionar</Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Cor no cronograma</Label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={customColor} onChange={(e) => {
                  setCustomColor(e.target.checked);
                  if (!e.target.checked) setColor(DEFAULT_KIND_COLORS[kind] ?? DEFAULT_KIND_COLORS.class);
                }} />
                Personalizar
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="color" disabled={!customColor} value={color} onChange={(e) => setColor(e.target.value)}
                className="h-9 w-14 rounded border border-border/60 bg-transparent disabled:opacity-50" />
              <div className="flex flex-wrap gap-1.5">
                {["#0f766e", "#7c3aed", "#dc2626", "#65a30d", "#0284c7", "#d97706", "#db2777", "#475569"].map((c) => (
                  <button key={c} type="button" disabled={!customColor} onClick={() => setColor(c)}
                    className="size-6 rounded-full border-2 disabled:opacity-40"
                    style={{ background: c, borderColor: color === c ? "#fff" : "transparent", outline: color === c ? `2px solid ${c}` : "none" }} />
                ))}
              </div>
            </div>
            {!customColor && <p className="text-[11px] text-muted-foreground">Usando a cor padrão do tipo selecionado.</p>}
          </div>
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
  const [dates, setDates] = useState<Date[]>([]);
  const [startTime, setStartTime] = useState(DEFAULT_SHIFT_TIMES.morning[0]);
  const [endTime, setEndTime] = useState(DEFAULT_SHIFT_TIMES.morning[1]);

  useEffect(() => {
    if (open) {
      setSubjectId(""); setSubdivision("A"); setShift("morning"); setKind("class"); setDates([]);
      setStartTime(DEFAULT_SHIFT_TIMES.morning[0]); setEndTime(DEFAULT_SHIFT_TIMES.morning[1]);
    }
  }, [open]);

  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h: any) => h.date)), [holidays]);
  const currentSubj = subjects.find((s) => s.id === subjectId);
  const availableSubs = useMemo(() => {
    const list = currentSubj?.subdivisions?.length ? currentSubj.subdivisions : ["A"];
    return Array.from(new Set([...list, "*"]));
  }, [currentSubj]);

  const submit = async () => {
    if (dates.length === 0) { toast.error("Selecione ao menos uma data"); return; }
    try {
      const r = await bulk({ data: {
        class_code: classCode as any, subject_id: subjectId || null, subdivision, shift,
        start_time: startTime, end_time: endTime, kind, is_abex: false,
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
            <div>
              <Label>Subdivisão</Label>
              <Select value={subdivision} onValueChange={setSubdivision}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableSubs.map((sd) => (
                    <SelectItem key={sd} value={sd}>{sd === "*" ? "Todas as turmas (*)" : sd}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turno</Label>
              <Select value={shift} onValueChange={(v) => {
                const nv = v as Shift; setShift(nv);
                const [s, e] = DEFAULT_SHIFT_TIMES[nv]; setStartTime(s); setEndTime(e);
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
              <div><Label>Início</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              <div><Label>Fim</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
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

/* ---------- PENDÊNCIAS: práticas/ABEX sem turmas definidas ---------- */
function PendingGroupsPanel({ classCode, subjects, reloadKey, onChanged }: {
  classCode: string; subjects: Subject[]; reloadKey: number; onChanged: () => void;
}) {
  const listPending = useServerFn(listEntriesNeedingGroups);
  const saveGroups = useServerFn(setEntryGroups);
  const loadGroups = useServerFn(listClassGroups);
  const [rows, setRows] = useState<any[]>([]);
  const [fallback, setFallback] = useState<string[]>([]);
  const [sel, setSel] = useState<Record<string, string[]>>({});

  const refresh = async () => {
    try {
      const [p, g] = await Promise.all([
        listPending({ data: { class_code: classCode as any } }),
        loadGroups({ data: { class_code: classCode as any } }),
      ]);
      setRows((p as any[]) ?? []);
      setFallback(((g as any[]) ?? []).map((x) => x.letter));
      setSel({});
    } catch { /* noop */ }
  };
  useEffect(() => { refresh(); }, [classCode, reloadKey]);

  if (!rows.length) return null;

  const groupsFor = (r: any) => {
    const s = subjects.find((x) => x.id === r.subject?.id);
    const list = s?.subdivisions?.length ? s.subdivisions : (fallback.length ? fallback : ["A"]);
    return Array.from(new Set(list));
  };

  const toggle = (id: string, letter: string) =>
    setSel((prev) => {
      const cur = prev[id] ?? [];
      return { ...prev, [id]: cur.includes(letter) ? cur.filter((l) => l !== letter) : [...cur, letter] };
    });

  const save = async (id: string) => {
    const letters = sel[id] ?? [];
    if (!letters.length) { toast.error("Selecione ao menos uma turma"); return; }
    try {
      await saveGroups({ data: { id, practice_groups: letters } });
      toast.success("Turmas definidas");
      setRows((prev) => prev.filter((r) => r.id !== id));
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="border-amber-500/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <h2 className="font-black">Aulas sem turma definida ({rows.length})</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          As turmas mostradas são as cadastradas em cada matéria. Selecione quais têm prática/ABEX neste horário e salve.
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((r) => {
            const gs = groupsFor(r);
            return (
              <div key={r.id} className="rounded-lg border border-border/60 p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{r.subject?.name ?? r.notes ?? "Prática"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                    {" · "}{SHIFT_LABEL[r.shift as Shift]}{" · "}{String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}
                    {r.is_abex ? " · ABEX" : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {gs.map((letter) => {
                    const on = (sel[r.id] ?? []).includes(letter);
                    return (
                      <Button key={letter} type="button" size="sm" variant={on ? "default" : "outline"}
                        onClick={() => toggle(r.id, letter)}>{letter}</Button>
                    );
                  })}
                  <Button size="sm" variant="secondary" onClick={() => setSel((p) => ({ ...p, [r.id]: gs }))}>Todas</Button>
                  <Button size="sm" onClick={() => save(r.id)}>Salvar</Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- PENDÊNCIAS: aulas sem matéria vinculada (vínculo em massa) ---------- */
function UnlinkedSubjectPanel({ classCode, subjects, reloadKey, onChanged }: {
  classCode: string; subjects: Subject[]; reloadKey: number; onChanged: () => void;
}) {
  const listUnlinked = useServerFn(listEntriesWithoutSubject);
  const assign = useServerFn(assignSubjectToEntries);
  const [rows, setRows] = useState<any[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    try { setRows(((await listUnlinked({ data: { class_code: classCode as any } })) as any[]) ?? []); }
    catch { /* noop */ }
  };
  useEffect(() => { refresh(); }, [classCode, reloadKey]);

  const filtered = useMemo(() => subjects.filter((s) => s.class_codes?.includes(classCode)), [subjects, classCode]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; kind: string; ids: string[]; dates: string[] }>();
    for (const r of rows) {
      const label = (r.notes?.trim() || "").replace(/\s+/g, " ");
      const key = `${r.kind}|${r.is_abex ? 1 : 0}|${label.toLowerCase()}|${String(r.start_time).slice(0, 5)}`;
      const g = map.get(key) ?? { key, label: label || (r.is_abex ? "ABEX" : r.kind), kind: r.kind, ids: [] as string[], dates: [] as string[] };
      g.ids.push(r.id);
      g.dates.push(r.date);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.ids.length - a.ids.length);
  }, [rows]);

  if (!groups.length) return null;

  const link = async (g: { key: string; ids: string[] }) => {
    const subject_id = pick[g.key];
    if (!subject_id) { toast.error("Selecione a matéria"); return; }
    try {
      setBusy(g.key);
      await assign({ data: { ids: g.ids, subject_id } });
      toast.success(`${g.ids.length} aula(s) vinculada(s)`);
      setRows((prev) => prev.filter((r) => !g.ids.includes(r.id)));
      onChanged();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <Card className="border-sky-500/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-sky-400" />
          <h2 className="font-black">Aulas sem matéria vinculada ({rows.length})</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Aulas idênticas foram agrupadas: escolha a matéria uma vez e vincule todas de uma só vez.
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {groups.map((g) => {
            const ds = [...g.dates].sort();
            return (
              <div key={g.key} className="rounded-lg border border-border/60 p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{g.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.ids.length} aula(s) · {new Date(ds[0] + "T00:00:00").toLocaleDateString("pt-BR")}
                    {ds.length > 1 && <> a {new Date(ds[ds.length - 1] + "T00:00:00").toLocaleDateString("pt-BR")}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={pick[g.key] ?? ""} onValueChange={(v) => setPick((p) => ({ ...p, [g.key]: v }))}>
                    <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Matéria" /></SelectTrigger>
                    <SelectContent>
                      {filtered.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={busy === g.key} onClick={() => link(g)}>
                    Vincular {g.ids.length}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

