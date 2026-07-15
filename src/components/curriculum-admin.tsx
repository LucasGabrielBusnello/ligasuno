import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, Calendar as CalIcon } from "lucide-react";
import {
  listSubjects, upsertSubject, deleteSubject,
  listTerms, upsertTerm, deleteTerm,
} from "@/lib/curriculum.functions";

const ATM_CLASSES = ["ATM26", "ATM27", "ATM28", "ATM29", "ATM30", "ATM31"] as const;

type Subject = {
  id: string; name: string; description: string | null;
  class_codes: string[]; subdivisions: string[];
  professor: string | null; professor_contact: string | null;
  workload_hours: number | null; semester: number | null;
};

type Term = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };

export function CurriculumAdmin() {
  return (
    <Tabs defaultValue="subjects">
      <TabsList>
        <TabsTrigger value="subjects"><BookOpen className="size-4 mr-1.5" />Componentes curriculares</TabsTrigger>
        <TabsTrigger value="terms"><CalIcon className="size-4 mr-1.5" />Semestres letivos</TabsTrigger>
      </TabsList>
      <TabsContent value="subjects" className="mt-4"><SubjectsTab /></TabsContent>
      <TabsContent value="terms" className="mt-4"><TermsTab /></TabsContent>
    </Tabs>
  );
}

/* ============ SUBJECTS ============ */

function SubjectsTab() {
  const list = useServerFn(listSubjects);
  const save = useServerFn(upsertSubject);
  const remove = useServerFn(deleteSubject);
  const [items, setItems] = useState<Subject[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  const reload = async () => setItems(((await list()) as any[]) ?? []);
  useEffect(() => { reload(); }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esse componente?")) return;
    try { await remove({ data: { id } }); toast.success("Excluído"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Matérias, professores e turmas ATM.</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-1.5" />Novo componente</Button>
      </div>
      <div className="grid gap-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum componente cadastrado.</p>}
        {items.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{s.name}</span>
                  {s.workload_hours && <Badge variant="outline">{s.workload_hours}h</Badge>}
                  {s.class_codes?.map((c) => <Badge key={c} className="bg-emerald-600">{c}</Badge>)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {s.professor ? <>Prof. {s.professor}{s.professor_contact ? ` · ${s.professor_contact}` : ""}</> : "Sem professor definido"}
                </div>
                {s.subdivisions?.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Turmas práticas: {s.subdivisions.join(", ")}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <SubjectDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={reload} save={save} />
    </div>
  );
}

function SubjectDialog({ open, onOpenChange, editing, onSaved, save }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classCodes, setClassCodes] = useState<string[]>([]);
  const [subdivisions, setSubdivisions] = useState("A");
  const [professor, setProfessor] = useState("");
  const [contact, setContact] = useState("");
  const [workload, setWorkload] = useState<string>("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setClassCodes(editing?.class_codes ?? []);
      setSubdivisions((editing?.subdivisions ?? ["A"]).join(", "));
      setProfessor(editing?.professor ?? "");
      setContact(editing?.professor_contact ?? "");
      setWorkload(editing?.workload_hours ? String(editing.workload_hours) : "");
    }
  }, [open, editing]);

  const toggleClass = (c: string) => setClassCodes((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    try {
      await save({ data: {
        id: editing?.id,
        name: name.trim(),
        description: description || null,
        class_codes: classCodes,
        subdivisions: subdivisions.split(",").map((s) => s.trim()).filter(Boolean),
        professor: professor || null,
        professor_contact: contact || null,
        workload_hours: workload ? Number(workload) : null,
      }});
      toast.success("Salvo");
      onOpenChange(false);
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar componente" : "Novo componente"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome*</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Professor</Label><Input value={professor} onChange={(e) => setProfessor(e.target.value)} /></div>
            <div><Label>Contato (e-mail)</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Carga horária (h)</Label><Input type="number" value={workload} onChange={(e) => setWorkload(e.target.value)} /></div>
            <div><Label>Subdivisões (turmas práticas)</Label><Input value={subdivisions} onChange={(e) => setSubdivisions(e.target.value)} placeholder="A, B, C" /></div>
          </div>
          <div>
            <Label>Turmas ATM</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {ATM_CLASSES.map((c) => (
                <button key={c} type="button" onClick={() => toggleClass(c)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${classCodes.includes(c) ? "bg-emerald-600 text-white border-emerald-600" : "bg-background border-border hover:bg-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ TERMS ============ */

function TermsTab() {
  const list = useServerFn(listTerms);
  const save = useServerFn(upsertTerm);
  const remove = useServerFn(deleteTerm);
  const [items, setItems] = useState<Term[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);

  const reload = async () => setItems(((await list()) as any[]) ?? []);
  useEffect(() => { reload(); }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esse semestre?")) return;
    try { await remove({ data: { id } }); toast.success("Excluído"); reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Semestres letivos (marque o atual).</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-1.5" />Novo semestre</Button>
      </div>
      <div className="grid gap-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum semestre cadastrado.</p>}
        {items.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{t.name}</span>
                  {t.is_current && <Badge className="bg-emerald-600">ATUAL</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">{t.start_date} → {t.end_date}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <TermDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={reload} save={save} />
    </div>
  );
}

function TermDialog({ open, onOpenChange, editing, onSaved, save }: any) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setStart(editing?.start_date ?? "");
      setEnd(editing?.end_date ?? "");
      setIsCurrent(editing?.is_current ?? false);
    }
  }, [open, editing]);

  const submit = async () => {
    if (!name || !start || !end) { toast.error("Preencha os campos"); return; }
    try {
      await save({ data: { id: editing?.id, name, start_date: start, end_date: end, is_current: isCurrent } });
      toast.success("Salvo"); onOpenChange(false); onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar semestre" : "Novo semestre"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome*</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026.1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início*</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Término*</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={isCurrent} onCheckedChange={setIsCurrent} /><Label>Semestre atual</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
