import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, RefreshCw, Eye, EyeOff } from "lucide-react";
import {
  getExamConfig, upsertExamConfig, addExamQuestion, deleteExamQuestion,
  getReentryCode, regenerateReentryCode,
} from "@/lib/exam.functions";

export function ExamBuilder({ league }: { league: any }) {
  const cfg = useServerFn(getExamConfig);
  const save = useServerFn(upsertExamConfig);
  const addQ = useServerFn(addExamQuestion);
  const delQ = useServerFn(deleteExamQuestion);
  const getCode = useServerFn(getReentryCode);
  const regenCode = useServerFn(regenerateReentryCode);

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [f, setF] = useState({ time_limit_minutes: 30, shuffle: true, send_answers_email: false, published: false, createAndPublish: false });
  const [nq, setNq] = useState({ question: "", options: ["", "", "", ""], correct_answer: 0 });
  const [code, setCode] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r: any = await cfg({ data: { league_id: league.id } } as any);
      setExam(r.exam);
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

  async function doSave() {
    try {
      await save({ data: {
        league_id: league.id,
        time_limit_minutes: Number(f.time_limit_minutes) || 30,
        shuffle: f.shuffle,
        send_answers_email: f.send_answers_email,
        published: f.createAndPublish || f.published,
      } } as any);
      toast.success("Configuração salva");
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  async function doAddQuestion() {
    if (!nq.question.trim() || nq.options.some(o => !o.trim())) return toast.error("Preencha pergunta e alternativas");
    try {
      await addQ({ data: { league_id: league.id, question: nq.question.trim(), options: nq.options.map(o => o.trim()), correct_answer: nq.correct_answer } } as any);
      setNq({ question: "", options: ["", "", "", ""], correct_answer: 0 });
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
              <Switch checked={f.shuffle} onCheckedChange={(v) => setF({ ...f, shuffle: v })} />
              Embaralhar questões e alternativas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.send_answers_email} onCheckedChange={(v) => setF({ ...f, send_answers_email: v })} />
              Enviar respostas no e-mail ao final
            </label>
          </div>
        </div>
        <div className="border-t pt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.createAndPublish} onChange={(e) => setF({ ...f, createAndPublish: e.target.checked, published: e.target.checked ? true : f.published })} />
            Criar e Publicar
          </label>
          {!f.createAndPublish && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} />
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
        <div className="flex items-center gap-2">
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
      <Card><CardContent className="p-4 space-y-2">
        <h4 className="font-black text-sm">Questões ({questions.length})</h4>
        {questions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma questão cadastrada.</p>}
        {questions.map((q, i) => (
          <div key={q.id} className="p-3 rounded border space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <div className="font-bold">Q{i + 1}. {q.question}</div>
              <Button size="sm" variant="destructive" onClick={() => doDelQuestion(q.id)}><Trash2 className="size-3" /></Button>
            </div>
            <ul className="text-xs space-y-0.5">
              {(q.options as string[]).map((o, idx) => (
                <li key={idx} className={idx === q.correct_answer ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                  {String.fromCharCode(65 + idx)}) {o} {idx === q.correct_answer && "✓"}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent></Card>

      {/* Nova questão */}
      <Card><CardContent className="p-4 space-y-2">
        <h4 className="font-black text-sm">Adicionar nova questão</h4>
        <Textarea placeholder="Enunciado" value={nq.question} onChange={(e) => setNq({ ...nq, question: e.target.value })} />
        {nq.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={nq.correct_answer === i} onChange={() => setNq({ ...nq, correct_answer: i })} />
            <Input placeholder={`Alternativa ${String.fromCharCode(65 + i)}`} value={opt}
              onChange={(e) => { const o = [...nq.options]; o[i] = e.target.value; setNq({ ...nq, options: o }); }} />
          </div>
        ))}
        <Button onClick={doAddQuestion}><Plus className="size-4" /> Adicionar questão</Button>
      </CardContent></Card>
    </div>
  );
}
