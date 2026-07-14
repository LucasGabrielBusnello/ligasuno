import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, RefreshCw, Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import {
  getExamConfig, upsertExamConfig, addExamQuestion, updateExamQuestion, deleteExamQuestion,
  getReentryCode, regenerateReentryCode,
} from "@/lib/exam.functions";

type QForm = { question: string; options: string[]; correct_answer: number; image_url: string };
const EMPTY_Q: QForm = { question: "", options: ["", "", "", ""], correct_answer: 0, image_url: "" };


function QuestionForm({ value, onChange }: { value: QForm; onChange: (v: QForm) => void }) {
  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Digite o enunciado da questão..."
        value={value.question}
        onChange={(e) => onChange({ ...value, question: e.target.value })}
        className="min-h-[80px] resize-y"
      />
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Marque a alternativa correta:</p>
        {value.options.map((opt, i) => {
          const isCorrect = value.correct_answer === i;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                isCorrect ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => onChange({ ...value, correct_answer: i })}
                className={`flex items-center justify-center size-8 rounded-full text-xs font-black shrink-0 transition-colors ${
                  isCorrect
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                }`}
                title={isCorrect ? "Alternativa correta" : "Marcar como correta"}
              >
                {isCorrect ? <Check className="size-4" /> : String.fromCharCode(65 + i)}
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
      <ImageUpload label="Imagem da questão (opcional)" folder="exam-questions" value={value.image_url} onChange={(url) => onChange({ ...value, image_url: url })} />
    </div>
  );
}


export function ExamBuilder({ league }: { league: any }) {
  const cfg = useServerFn(getExamConfig);
  const save = useServerFn(upsertExamConfig);
  const addQ = useServerFn(addExamQuestion);
  const updQ = useServerFn(updateExamQuestion);
  const delQ = useServerFn(deleteExamQuestion);
  const getCode = useServerFn(getReentryCode);
  const regenCode = useServerFn(regenerateReentryCode);

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<any[]>([]);
  const [f, setF] = useState({ time_limit_minutes: 30, shuffle: true, send_answers_email: false, published: false, createAndPublish: false });
  const [nq, setNq] = useState<QForm>(EMPTY_Q);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QForm>(EMPTY_Q);
  const [code, setCode] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r: any = await cfg({ data: { league_id: league.id } } as any);
      setQuestions(r.questions);
      setF({
        time_limit_minutes: r.exam.time_limit_minutes,
        shuffle: r.exam.shuffle,
        send_answers_email: r.exam.send_answers_email,
        published: r.exam.published,
        createAndPublish: r.exam.published,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar prova");
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [league.id]);

  async function persist(next: typeof f, opts?: { silent?: boolean }) {
    try {
      await save({ data: {
        league_id: league.id,
        time_limit_minutes: Number(next.time_limit_minutes) || 30,
        shuffle: next.shuffle,
        send_answers_email: next.send_answers_email,
        published: next.createAndPublish || next.published,
      } } as any);
      if (!opts?.silent) toast.success("Configuração salva");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function doSave() { await persist(f); await reload(); }
  function updateAndSave(patch: Partial<typeof f>) {
    const next = { ...f, ...patch };
    setF(next);
    persist(next, { silent: true });
  }


  function validate(q: QForm) {
    if (!q.question.trim()) return "Preencha o enunciado";
    if (q.options.some(o => !o.trim())) return "Preencha todas as alternativas";
    return null;
  }

  async function doAddQuestion() {
    const err = validate(nq);
    if (err) return toast.error(err);
    try {
      await addQ({ data: { league_id: league.id, question: nq.question.trim(), options: nq.options.map(o => o.trim()), correct_answer: nq.correct_answer, image_url: nq.image_url || null } } as any);
      setNq(EMPTY_Q);
      toast.success("Questão adicionada");
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  function startEdit(q: any) {
    setEditingId(q.id);
    setEditForm({ question: q.question, options: [...(q.options as string[])], correct_answer: q.correct_answer, image_url: q.image_url ?? "" });

  }
  function cancelEdit() { setEditingId(null); setEditForm(EMPTY_Q); }

  async function doUpdateQuestion() {
    const err = validate(editForm);
    if (err) return toast.error(err);
    if (!editingId) return;
    try {
      await updQ({ data: { league_id: league.id, question_id: editingId, question: editForm.question.trim(), options: editForm.options.map(o => o.trim()), correct_answer: editForm.correct_answer, image_url: editForm.image_url || null } } as any);
      toast.success("Questão atualizada");
      cancelEdit();
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function doDelQuestion(id: string) {
    if (!confirm("Excluir esta questão?")) return;
    try { await delQ({ data: { league_id: league.id, question_id: id } } as any); await reload(); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function showCode() {
    try { const r: any = await getCode({ data: { league_id: league.id } } as any); setCode(r.code); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function newCode() {
    if (!confirm("Gerar novo código? O anterior será invalidado.")) return;
    try { const r: any = await regenCode({ data: { league_id: league.id } } as any); setCode(r.code); toast.success("Novo código gerado"); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando prova...</p>;

  return (
    <div className="space-y-4">
      {/* Configuração */}
      <Card><CardContent className="p-4 space-y-3">
        <h4 className="font-black text-sm">Configurações da prova</h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Tempo de prova (minutos)</Label>
            <Input type="number" min="1" max="360" value={f.time_limit_minutes}
              onChange={(e) => setF({ ...f, time_limit_minutes: +e.target.value })} />
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.shuffle} onCheckedChange={(v) => updateAndSave({ shuffle: v })} />
              Embaralhar questões e alternativas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.send_answers_email} onCheckedChange={(v) => updateAndSave({ send_answers_email: v })} />
              Enviar respostas no e-mail ao final
            </label>
          </div>
        </div>
        <div className="border-t pt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.createAndPublish} onChange={(e) => updateAndSave({ createAndPublish: e.target.checked, published: e.target.checked ? true : f.published })} />
            Criar e Publicar
          </label>
          {!f.createAndPublish && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.published} onCheckedChange={(v) => updateAndSave({ published: v })} />
              Prova publicada {f.published ? "(visível aos inscritos)" : "(oculta)"}
            </label>
          )}
        </div>

        <Button onClick={doSave}>Salvar configurações</Button>
      </CardContent></Card>

      {/* Código de reentrada */}
      <Card><CardContent className="p-4 space-y-3">
        <h4 className="font-black text-sm flex items-center gap-2"><KeyRound className="size-4" /> Código de reentrada</h4>
        <p className="text-xs text-muted-foreground">Se um inscrito sair da aba, a prova pausa. Para retomar, ele precisa digitar este código de 4 dígitos.</p>
        <div className="flex items-center gap-2 flex-wrap">
          {code ? (
            <>
              <div className="text-3xl font-black tracking-widest font-mono px-4 py-2 bg-muted rounded">{code}</div>
              <Button size="sm" variant="outline" onClick={() => setCode(null)}><EyeOff className="size-4" /> Esconder</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={showCode}><Eye className="size-4" /> Mostrar código</Button>
          )}
          <Button size="sm" variant="outline" onClick={newCode}><RefreshCw className="size-4" /> Gerar novo</Button>
        </div>
      </CardContent></Card>

      {/* Questões existentes */}
      <Card><CardContent className="p-4 space-y-3">
        <h4 className="font-black text-sm">Questões ({questions.length})</h4>
        {questions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma questão cadastrada.</p>}
        {questions.map((q, i) => {
          const isEditing = editingId === q.id;
          return (
            <div key={q.id} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/40 border-b">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center size-7 rounded-full bg-primary text-primary-foreground text-xs font-black">
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Questão</span>
                </div>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="size-4" /></Button>
                      <Button size="sm" onClick={doUpdateQuestion}><Check className="size-4" /> Salvar</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(q)} title="Editar"><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => doDelQuestion(q.id)} title="Excluir"><Trash2 className="size-4" /></Button>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4">
                {isEditing ? (
                  <QuestionForm value={editForm} onChange={setEditForm} />
                ) : (
                  <div className="space-y-2">
                    {q.image_url && <img src={q.image_url} alt="" className="rounded max-h-48 object-contain" />}
                    <p className="text-sm font-medium leading-snug">{q.question}</p>

                    <ul className="space-y-1">
                      {(q.options as string[]).map((o, idx) => {
                        const correct = idx === q.correct_answer;
                        return (
                          <li key={idx} className={`flex items-start gap-2 text-sm p-2 rounded ${correct ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold" : "text-muted-foreground"}`}>
                            <span className={`inline-flex items-center justify-center size-5 rounded-full text-[10px] font-black shrink-0 mt-0.5 ${correct ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                              {correct ? <Check className="size-3" /> : String.fromCharCode(65 + idx)}
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
      </CardContent></Card>

      {/* Nova questão */}
      <Card className="border-primary/40"><CardContent className="p-4 space-y-3">
        <h4 className="font-black text-sm flex items-center gap-2"><Plus className="size-4" /> Adicionar nova questão</h4>
        <QuestionForm value={nq} onChange={setNq} />
        <Button onClick={doAddQuestion} className="w-full"><Plus className="size-4" /> Adicionar questão</Button>
      </CardContent></Card>
    </div>
  );
}
