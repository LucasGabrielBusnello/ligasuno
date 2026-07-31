import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { parseScheduleWorkbook, type ParsedSchedule } from "@/lib/schedule-xlsx";
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
  const [classCode, setClassCode] = useState(defaultClass);
  const [subdivision, setSubdivision] = useState("A");
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File) => {
    try {
      setBusy(true);
      const p = await parseScheduleWorkbook(f);
      if (!p.entries.length) {
        toast.error("Nenhuma aula encontrada na planilha.");
        return;
      }
      setClassCode(defaultClass);
      setParsed(p);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler a planilha");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirm = async () => {
    if (!parsed) return;
    try {
      setBusy(true);
      const r: any = await importFn({
        data: {
          class_code: classCode as any,
          subdivision,
          term_id: termId ?? null,
          replace,
          subjects: parsed.subjects,
          entries: parsed.entries,
        },
      });
      toast.success(`${r.entries} aulas importadas · ${r.subjects} componentes${r.replaced ? ` · ${r.replaced} substituídas` : ""}`);
      setParsed(null);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar");
    } finally {
      setBusy(false);
    }
  };

  const byShift = parsed
    ? parsed.entries.reduce<Record<string, number>>((a, e) => ({ ...a, [e.shift]: (a[e.shift] ?? 0) + 1 }), {})
    : {};

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

      <Dialog open={!!parsed} onOpenChange={(o) => !o && setParsed(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Importar cronograma</DialogTitle></DialogHeader>
          {parsed && (
            <div className="space-y-4 text-sm">
              {parsed.title && <p className="font-semibold">{parsed.title}</p>}
              <div className="rounded-lg border p-3 space-y-1 text-muted-foreground">
                <p><b className="text-foreground">{parsed.entries.length}</b> atividades encontradas
                  {parsed.entries.length > 0 && <> · {parsed.entries[0].date} a {parsed.entries[parsed.entries.length - 1].date}</>}
                </p>
                <p>{Object.entries(byShift).map(([s, n]) => `${SHIFT_LABEL[s]}: ${n}`).join(" · ")}</p>
                <p><b className="text-foreground">{parsed.subjects.length}</b> componentes curriculares: {parsed.subjects.map((s) => s.name).join(", ") || "—"}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Turma</Label>
                  <Select value={classCode} onValueChange={setClassCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subdivisão</Label>
                  <Select value={subdivision} onValueChange={setSubdivision}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["A", "B", "C", "D"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Substituir as entradas já existentes dessa turma no período
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setParsed(null)}>Cancelar</Button>
            <Button onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
