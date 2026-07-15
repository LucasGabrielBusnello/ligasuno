import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Stethoscope, LogIn, BookOpen, Mail, Plus, Trash2, Calendar as CalIcon } from "lucide-react";
import { listSubjects, listPersonalItems, upsertPersonalItem, deletePersonalItem } from "@/lib/curriculum.functions";

export const Route = createFileRoute("/aluno")({
  head: () => ({
    meta: [
      { title: "Aluno — MEDUNO" },
      { name: "description", content: "Painel do estudante de Medicina da Unochapecó: matérias, professores e agenda pessoal." },
      { property: "og:title", content: "Aluno — MEDUNO" },
      { property: "og:description", content: "Painel do estudante de Medicina da Unochapecó." },
    ],
  }),
  component: AlunoPage,
});

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

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<PersonalItem[]>([]);
  const [mySub, setMySub] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalItem | null>(null);

  const classCode = (profile as any)?.class_code as string | null;

  const reload = async () => {
    const [s, i] = await Promise.all([listSubj(), listItems({ data: {} })]);
    setSubjects((s as any[]) ?? []);
    setItems((i as any[]) ?? []);
  };

  useEffect(() => { if (user) reload(); }, [user]);

  const mySubjects = useMemo(
    () => subjects.filter((s) => !classCode || s.class_codes?.includes(classCode)),
    [subjects, classCode]
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayItems = items.filter((i) => i.date === today);
  const upcoming = items.filter((i) => i.date > today).slice(0, 5);

  const onDeleteItem = async (id: string) => {
    if (!confirm("Excluir esse item?")) return;
    try { await deleteItem({ data: { id } }); toast.success("Excluído"); reload(); }
    catch (e: any) { toast.error(e.message); }
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
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-lg"><Stethoscope className="size-6" /></div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Painel do Aluno</h1>
            <p className="text-sm text-muted-foreground">
              Olá, {profile?.full_name ?? profile?.username}{classCode ? ` · Turma ${classCode}` : ""}
            </p>
          </div>
        </div>
      </section>

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
