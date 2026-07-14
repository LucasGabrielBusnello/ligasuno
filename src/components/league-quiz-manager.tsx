import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, BookOpen, Lock, Globe2, HelpCircle } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";

type QForm = { question: string; options: string[]; correct_answer: number; explanation: string; image_url: string };
const EMPTY_Q: QForm = { question: "", options: ["", "", "", ""], correct_answer: 0, explanation: "", image_url: "" };


function QuestionForm({ value, onChange }: { value: QForm; onChange: (v: QForm) => void }) {
  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Enunciado da questão"
        value={value.question}
        onChange={(e) => onChange({ ...value, question: e.target.value })}
        className="min-h-[72px]"
      />
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Marque a alternativa correta</p>
      <div className="space-y-2">
        {value.options.map((opt, i) => {
          const ok = value.correct_answer === i;
          return (
            <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${ok ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"}`}>
              <button
                type="button"
                onClick={() => onChange({ ...value, correct_answer: i })}
                className={`shrink-0 size-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${ok ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"}`}
                title={ok ? "Correta" : "Marcar como correta"}
              >
                {ok ? <Check className="size-4" /> : String.fromCharCode(65 + i)}
              </button>
              <Input
                placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                value={opt}
                onChange={(e) => {
                  const o = [...value.options];
                  o[i] = e.target.value;
                  onChange({ ...value, options: o });
                }}
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-1"
              />
            </div>
          );
        })}
      </div>
      <Textarea
        placeholder="Explicação (mostrada após responder)"
        value={value.explanation}
        onChange={(e) => onChange({ ...value, explanation: e.target.value })}
        className="min-h-[60px]"
      />
      <ImageUpload label="Imagem da questão (opcional)" folder="quiz-questions" value={value.image_url} onChange={(url) => onChange({ ...value, image_url: url })} />
    </div>
  );
}


export function LeagueQuizManager({ league }: { league: any }) {
  const [sets, setSets] = useState<any[]>([]);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [newSet, setNewSet] = useState({ title: "", description: "", is_private: false });
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [nq, setNq] = useState<QForm>(EMPTY_Q);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QForm>(EMPTY_Q);
  const [editingSet, setEditingSet] = useState<any | null>(null);

  const reloadSets = async () => {
    const { data } = await supabase.from("league_quiz_sets").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setSets(data ?? []);
  };
  const reloadQuizzes = async (sid: string) => {
    const { data } = await (supabase as any).rpc("manager_get_quizzes", { _set_id: sid });
    setQuizzes(data ?? []);
  };

  useEffect(() => { reloadSets(); }, [league.id]);
  useEffect(() => { if (openSet) reloadQuizzes(openSet); else setQuizzes([]); }, [openSet]);

  async function createSet() {
    if (!newSet.title) return toast.error("Defina um título");
    const { error } = await supabase.from("league_quiz_sets").insert({ ...newSet, league_id: league.id });
    if (error) return toast.error(error.message);
    setNewSet({ title: "", description: "", is_private: false });
    toast.success("Caderno criado");
    reloadSets();
  }
  async function delSet(id: string) {
    if (!confirm("Excluir caderno e suas questões?")) return;
    await supabase.from("league_quizzes").delete().eq("quiz_set_id", id);
    await supabase.from("league_quiz_sets").delete().eq("id", id);
    if (openSet === id) setOpenSet(null);
    reloadSets();
  }
  async function saveSetEdit() {
    if (!editingSet) return;
    const { error } = await supabase.from("league_quiz_sets")
      .update({ title: editingSet.title, description: editingSet.description, is_private: editingSet.is_private })
      .eq("id", editingSet.id);
    if (error) return toast.error(error.message);
    toast.success("Caderno atualizado");
    setEditingSet(null);
    reloadSets();
  }

  function validate(q: QForm) {
    if (!q.question.trim()) return "Preencha o enunciado";
    if (q.options.some(o => !o.trim())) return "Preencha todas as alternativas";
    return null;
  }
  async function addQuiz() {
    const err = validate(nq); if (err) return toast.error(err);
    if (!openSet) return;
    const { error } = await supabase.from("league_quizzes").insert({ ...nq, quiz_set_id: openSet, display_order: quizzes.length });
    if (error) return toast.error(error.message);
    setNq(EMPTY_Q);
    toast.success("Questão adicionada");
    reloadQuizzes(openSet);
  }
  function startEdit(q: any) {
    setEditingId(q.id);
    setEditForm({ question: q.question, options: [...(q.options as string[])], correct_answer: q.correct_answer, explanation: q.explanation ?? "", image_url: q.image_url ?? "" });
  }
  function cancelEdit() { setEditingId(null); setEditForm(EMPTY_Q); }
  async function saveQuizEdit() {
    const err = validate(editForm); if (err) return toast.error(err);
    if (!editingId) return;
    const { error } = await supabase.from("league_quizzes")
      .update({ question: editForm.question.trim(), options: editForm.options.map(o => o.trim()), correct_answer: editForm.correct_answer, explanation: editForm.explanation })
      .eq("id", editingId);
    if (error) return toast.error(error.message);
    toast.success("Questão atualizada");
    cancelEdit();
    if (openSet) reloadQuizzes(openSet);
  }
  async function delQuiz(id: string) {
    if (!confirm("Excluir esta questão?")) return;
    await supabase.from("league_quizzes").delete().eq("id", id);
    if (openSet) reloadQuizzes(openSet);
  }

  return (
    <div className="space-y-4">
      {/* Novo caderno */}
      <Card className="border-primary/30">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-black flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
            <BookOpen className="size-4 text-primary" /> Novo caderno de quizzes
          </h3>
          <Input placeholder="Título do caderno" value={newSet.title} onChange={(e) => setNewSet({ ...newSet, title: e.target.value })} />
          <Textarea placeholder="Descrição (opcional)" value={newSet.description} onChange={(e) => setNewSet({ ...newSet, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={newSet.is_private} onCheckedChange={(v) => setNewSet({ ...newSet, is_private: v })} />
            {newSet.is_private ? <><Lock className="size-3.5" /> Privado (somente ligantes)</> : <><Globe2 className="size-3.5" /> Aberto a todos</>}
          </label>
          <Button onClick={createSet}><Plus className="size-4" /> Criar caderno</Button>
        </CardContent>
      </Card>

      {/* Lista de cadernos */}
      <div className="grid sm:grid-cols-2 gap-3">
        {sets.length === 0 && <p className="text-sm text-muted-foreground sm:col-span-2">Nenhum caderno criado ainda.</p>}
        {sets.map((s) => {
          const isOpen = openSet === s.id;
          const isEditing = editingSet?.id === s.id;
          return (
            <Card key={s.id} className={`transition-all ${isOpen ? "ring-2 ring-primary/50" : "hover:shadow-md"}`}>
              <CardContent className="p-4 space-y-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input value={editingSet.title} onChange={(e) => setEditingSet({ ...editingSet, title: e.target.value })} placeholder="Título" />
                    <Textarea value={editingSet.description ?? ""} onChange={(e) => setEditingSet({ ...editingSet, description: e.target.value })} placeholder="Descrição" />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch checked={!!editingSet.is_private} onCheckedChange={(v) => setEditingSet({ ...editingSet, is_private: v })} />
                      {editingSet.is_private ? <><Lock className="size-3.5" /> Privado</> : <><Globe2 className="size-3.5" /> Aberto a todos</>}
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveSetEdit}><Check className="size-3.5" /> Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingSet(null)}><X className="size-3.5" /> Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <HelpCircle className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black truncate">{s.title}</h4>
                        {s.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>}
                        <div className="flex gap-1.5 mt-1.5">
                          {s.is_private
                            ? <Badge variant="secondary" className="text-[10px]"><Lock className="size-2.5 mr-1" />Privado</Badge>
                            : <Badge variant="outline" className="text-[10px]"><Globe2 className="size-2.5 mr-1" />Aberto</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant={isOpen ? "default" : "outline"} className="flex-1" onClick={() => setOpenSet(isOpen ? null : s.id)}>
                        {isOpen ? "Fechar" : "Questões"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingSet({ ...s })} title="Editar caderno"><Pencil className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => delSet(s.id)} title="Excluir caderno"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Questões do caderno selecionado */}
      {openSet && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-black text-sm uppercase tracking-wide text-muted-foreground">Questões do caderno ({quizzes.length})</h3>
            {quizzes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma questão ainda.</p>}
            <div className="space-y-2">
              {quizzes.map((q, i) => {
                const isEditing = editingId === q.id;
                return (
                  <div key={q.id} className="rounded-xl border bg-card overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-[11px] font-black">{i + 1}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Questão</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="size-4" /></Button>
                            <Button size="sm" onClick={saveQuizEdit}><Check className="size-4" /> Salvar</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => startEdit(q)}><Pencil className="size-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => delQuiz(q.id)}><Trash2 className="size-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-3">
                      {isEditing ? (
                        <QuestionForm value={editForm} onChange={setEditForm} />
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium">{q.question}</p>
                          <ul className="space-y-1">
                            {(q.options as string[]).map((o, idx) => {
                              const ok = idx === q.correct_answer;
                              return (
                                <li key={idx} className={`flex items-start gap-2 text-sm p-1.5 rounded ${ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold" : "text-muted-foreground"}`}>
                                  <span className={`inline-flex items-center justify-center size-5 rounded-full text-[10px] font-black shrink-0 mt-0.5 ${ok ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                                    {ok ? <Check className="size-3" /> : String.fromCharCode(65 + idx)}
                                  </span>
                                  <span>{o}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-black text-sm flex items-center gap-2 mb-3"><Plus className="size-4 text-primary" /> Adicionar nova questão</h4>
              <QuestionForm value={nq} onChange={setNq} />
              <Button onClick={addQuiz} className="w-full mt-3"><Plus className="size-4" /> Adicionar questão</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
