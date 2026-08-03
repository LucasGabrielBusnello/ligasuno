import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Plus, AlertTriangle } from "lucide-react";
import { parseScheduleWorkbook, type ParsedSchedule, type ParsedEntry, type ParsedSubject } from "@/lib/schedule-xlsx";
import { importScheduleFromSheet } from "@/lib/schedule.functions";

const CLASSES = ["ATM31", "ATM30", "ATM29", "ATM28", "ATM27", "ATM26"] as const;
const SHIFT_LABEL: Record<string, string> = { morning: "Manhã", afternoon: "Tarde", night: "Noite" };

export function ScheduleImportButton({
  defaultClass,
  termId,
  onDone,
}: {
  defaultClass: string;
  termId?: string | null;
  onDone?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importScheduleFromSheet);
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null);
  const [subjects, setSubjects] = useState<ParsedSubject[]>([]);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [groupDraft, setGroupDraft] = useState<Record<number, string>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [classCode, setClassCode] = useState(defaultClass);
  const [subdivision, setSubdivision] = useState("A");
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => { setParsed(null); setStep(1); setGroupDraft({}); };

  const addGroupTo = (i: number) => {
    const letter = (groupDraft[i] ?? "").trim().toUpperCase();
    if (!letter) return;
    setSubjects((prev) => prev.map((x, idx) => {
      if (idx !== i) return x;
      const cur = x.groups?.length ? x.groups : ["A"];
      return { ...x, groups: [...new Set([...cur, letter])].sort() };
    }));
    setGroupDraft((p) => ({ ...p, [i]: "" }));
  };

  const onFile = async (f: File) => {
    try {
      setBusy(true);
      const p = await parseScheduleWorkbook(f);
      if (!p.entries.length) {
        toast.error("Nenhuma aula encontrada na planilha.");
        return;
      }
      setClassCode(defaultClass);
      setSubjects(p.subjects.map((s) => ({ ...s, groups: s.groups?.length ? s.groups : ["A"] })));
      setEntries(p.entries.map((e) => ({ ...e })));
      setStep(1);
      setParsed(p);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler a planilha");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const renameSubject = (i: number, name: string) => {
    const old = subjects[i].name;
    setSubjects((prev) => prev.map((s, idx) => (idx === i ? { ...s, name } : s)));
    setEntries((prev) => prev.map((e) => (e.subject_name === old ? { ...e, subject_name: name } : e)));
  };
  const removeSubject = (i: number) => {
    const old = subjects[i].name;
    setSubjects((prev) => prev.filter((_, idx) => idx !== i));
    setEntries((prev) => prev.map((e) => (e.subject_name === old ? { ...e, subject_name: null } : e)));
  };

  const unresolved = entries.filter(
    (e) => (e.kind === "practice" || e.kind === "abex" || e.is_abex) && e.practice_groups === null,
  ).length;
  const noSubject = entries.filter((e) => !e.subject_name && e.kind !== "green_zone").length;

  const confirm = async () => {
    try {
      setBusy(true);
      const cleanGroups = [...new Set(subjects.flatMap((s) => s.groups ?? ["A"]).map((g) => g.trim().toUpperCase()).filter(Boolean))];
      const r: any = await importFn({
        data: {
          class_code: classCode as any,
          subdivision,
          term_id: termId ?? null,
          replace,
          subjects: subjects.filter((s) => s.name.trim()).map((s) => ({
            name: s.name,
            professor: s.professor ?? null,
            groups: s.groups?.length ? s.groups : ["A"],
          })),
          groups: cleanGroups,
          entries: entries.map((e) => ({
            date: e.date,
            shift: e.shift,
            start_time: e.start_time,
            end_time: e.end_time,
            kind: e.kind,
            is_abex: e.is_abex,
            subject_name: e.subject_name,
            notes: e.notes,
            practice_groups: e.practice_groups,
          })),
        },
      });
      toast.success(`${r.entries} aulas importadas · ${r.subjects} componentes${r.replaced ? ` · ${r.replaced} substituídas` : ""}`);
      reset();
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar");
    } finally {
      setBusy(false);
    }
  };

  const byShift = entries.reduce<Record<string, number>>((a, e) => ({ ...a, [e.shift]: (a[e.shift] ?? 0) + 1 }), {});

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy && !parsed ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Importar Excel
      </Button>

      <Dialog open={!!parsed} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? "Confira matérias e turmas" : "Confirmar importação"}
            </DialogTitle>
          </DialogHeader>

          {parsed && step === 1 && (
            <div className="space-y-4 text-sm">
              {parsed.title && <p className="font-semibold">{parsed.title}</p>}
              <p className="text-muted-foreground">
                Revise e corrija o que o site identificou. A distribuição das aulas por turma só é feita depois que você confirmar.
              </p>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide">Componentes curriculares ({subjects.length})</Label>
                <p className="text-xs text-muted-foreground">
                  Cada matéria começa com a turma <b>A</b>. Adicione mais turmas de prática só onde for necessário.
                </p>
                <div className="space-y-3">
                  {subjects.map((s, i) => {
                    const gs = s.groups?.length ? s.groups : ["A"];
                    return (
                      <div key={i} className="rounded-lg border p-2 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={s.name}
                            onChange={(e) => renameSubject(i, e.target.value)}
                            placeholder="Nome da matéria"
                          />
                          <Input
                            className="w-48"
                            value={s.professor ?? ""}
                            onChange={(e) =>
                              setSubjects((prev) => prev.map((x, idx) => (idx === i ? { ...x, professor: e.target.value } : x)))
                            }
                            placeholder="Professor(a)"
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeSubject(i)}><Trash2 className="size-4" /></Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Turmas:</span>
                          {gs.map((g) => (
                            <Badge key={g} variant="secondary" className="gap-1">
                              {g}
                              <button
                                className="ml-1"
                                onClick={() =>
                                  setSubjects((prev) => prev.map((x, idx) =>
                                    idx === i ? { ...x, groups: gs.filter((l) => l !== g) } : x))
                                }
                              >×</button>
                            </Badge>
                          ))}
                          <Input
                            className="w-20 h-7 text-xs"
                            placeholder="+ turma"
                            value={groupDraft[i] ?? ""}
                            onChange={(e) => setGroupDraft((p) => ({ ...p, [i]: e.target.value.toUpperCase().slice(0, 4) }))}
                            onKeyDown={(e) => { if (e.key === "Enter") addGroupTo(i); }}
                          />
                          <Button variant="outline" size="sm" className="h-7" onClick={() => addGroupTo(i)}>Adicionar</Button>
                        </div>
                      </div>
                    );
                  })}
                  {subjects.length === 0 && <p className="text-muted-foreground">Nenhuma matéria identificada.</p>}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setSubjects((prev) => [...prev, { name: "", professor: "", groups: ["A"] }])}
                  >
                    <Plus className="size-4" /> Adicionar matéria
                  </Button>
                </div>
              </div>


              <div className="rounded-lg border p-3 space-y-1 text-muted-foreground">
                <p><b className="text-foreground">{entries.length}</b> atividades
                  {entries.length > 0 && <> · {entries[0].date} a {entries[entries.length - 1].date}</>}
                </p>
                <p>{Object.entries(byShift).map(([s, n]) => `${SHIFT_LABEL[s]}: ${n}`).join(" · ")}</p>
                {(unresolved > 0 || noSubject > 0) && (
                  <p className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                    <span>
                      {unresolved > 0 && <>{unresolved} prática(s)/ABEX sem turma identificada. </>}
                      {noSubject > 0 && <>{noSubject} atividade(s) sem matéria vinculada. </>}
                      Você poderá ajustar no painel, abaixo do cronograma.
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {parsed && step === 2 && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Turma</Label>
                  <Select value={classCode} onValueChange={setClassCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subdivisão padrão</Label>
                  <Select value={subdivision} onValueChange={setSubdivision}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["A", "B", "C", "D"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-1 text-muted-foreground">
                <p><b className="text-foreground">{subjects.length}</b> componentes · <b className="text-foreground">{[...new Set(subjects.flatMap((s) => s.groups ?? ["A"]))].sort().join(", ") || "—"}</b> turmas · <b className="text-foreground">{entries.length}</b> atividades</p>
                {unresolved > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    {unresolved} prática(s)/ABEX ficarão pendentes de definição de turma.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Substituir as entradas já existentes dessa turma no período
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => (step === 2 ? setStep(1) : reset())}>
              {step === 2 ? "Voltar" : "Cancelar"}
            </Button>
            {step === 1 ? (
              <Button onClick={() => setStep(2)}>Está correto, continuar</Button>
            ) : (
              <Button onClick={confirm} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />} Importar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
