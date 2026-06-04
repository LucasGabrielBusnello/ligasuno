import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, Lock, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  startExamAttempt, resumeExamAttempt, pauseExamAttempt,
  saveExamAnswer, submitExamAttempt,
} from "@/lib/exam.functions";

type Payload = {
  exam_id: string;
  time_limit_minutes: number;
  time_remaining_ms: number;
  paused: boolean;
  submitted: boolean;
  questions: Array<{ id: string; question: string; options: string[] }>;
  answers: Record<string, number>;
};

export function ExamRunner({ league, open, onClose }: { league: any; open: boolean; onClose: () => void }) {
  const start = useServerFn(startExamAttempt);
  const resume = useServerFn(resumeExamAttempt);
  const pause = useServerFn(pauseExamAttempt);
  const save = useServerFn(saveExamAnswer);
  const submit = useServerFn(submitExamAttempt);

  const [state, setState] = useState<"loading" | "running" | "paused" | "submitted" | "error">("loading");
  const [data, setData] = useState<Payload | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [reentryCode, setReentryCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const submittingRef = useRef(false);

  // Initial start
  useEffect(() => {
    if (!open) return;
    setState("loading"); setErrorMsg(null); setResult(null);
    (async () => {
      try {
        const r: any = await start({ data: { league_id: league.id } } as any);
        if (r?.requires_code) {
          setState("paused");
          setData(null);
          return;
        }
        setData(r); setRemainingMs(r.time_remaining_ms); setState("running");
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Erro");
        setState("error");
      }
    })();
  }, [open, league.id]);

  // Countdown
  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => {
      setRemainingMs((ms) => {
        const next = Math.max(0, ms - 1000);
        if (next === 0) doSubmit();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  // Anti-cola: detect tab visibility loss / blur and pause
  useEffect(() => {
    if (state !== "running") return;
    const onHide = async () => {
      if (state !== "running") return;
      try { await pause({ data: { league_id: league.id } } as any); } catch {}
      setState("paused");
    };
    const onVisibility = () => { if (document.hidden) onHide(); };
    const onBlur = () => onHide();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onHide);
    };
  }, [state, league.id]);

  // Disable context menu while running
  useEffect(() => {
    if (state !== "running") return;
    const onCtx = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, [state]);

  async function setAnswer(qid: string, idx: number) {
    if (!data) return;
    setData({ ...data, answers: { ...data.answers, [qid]: idx } });
    try { await save({ data: { league_id: league.id, question_id: qid, selected: idx } } as any); }
    catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
  }

  async function doResume() {
    if (reentryCode.length !== 4) return toast.error("Digite o código de 4 dígitos");
    try {
      const r: any = await resume({ data: { league_id: league.id, reentry_code: reentryCode } } as any);
      setData(r); setRemainingMs(r.time_remaining_ms); setReentryCode(""); setState("running");
    } catch (e: any) { toast.error(e?.message ?? "Código incorreto"); }
  }

  async function doSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const r: any = await submit({ data: { league_id: league.id } } as any);
      setResult({ score: r.score, total: r.total });
      setState("submitted");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
      submittingRef.current = false;
    }
  }

  const mm = String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[95vh] overflow-y-auto select-none"
        onPointerDownOutside={(e) => state === "running" && e.preventDefault()}
        onEscapeKeyDown={(e) => state === "running" && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Prova — {league.name}
            {state === "running" && (
              <span className="ml-auto inline-flex items-center gap-1 text-base font-mono"><Clock className="size-4" /> {mm}:{ss}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {state === "loading" && <p className="text-center py-12">Carregando prova...</p>}

        {state === "error" && (
          <Card className="border-destructive/40"><CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="size-10 mx-auto text-destructive" />
            <p className="font-bold">{errorMsg}</p>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </CardContent></Card>
        )}

        {state === "paused" && (
          <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="p-6 text-center space-y-3">
            <Lock className="size-10 mx-auto text-amber-600" />
            <h3 className="font-black text-lg">Prova pausada</h3>
            <p className="text-sm text-muted-foreground">Você saiu da aba. Peça o código de 4 dígitos ao presidente para retomar.</p>
            <Input
              inputMode="numeric" maxLength={4}
              className="text-center text-2xl font-mono tracking-widest max-w-[160px] mx-auto"
              value={reentryCode}
              onChange={(e) => setReentryCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <Button onClick={doResume}>Retomar prova</Button>
          </CardContent></Card>
        )}

        {state === "running" && data && (
          <div className="space-y-4" onCopy={(e) => e.preventDefault()}>
            {data.questions.map((q, i) => (
              <Card key={q.id}><CardContent className="p-4 space-y-2">
                <div className="font-bold text-sm">Q{i + 1}. {q.question}</div>
                <div className="space-y-1">
                  {q.options.map((opt, idx) => (
                    <label key={idx} className={`flex items-start gap-2 p-2 rounded border cursor-pointer text-sm ${data.answers[q.id] === idx ? "border-primary bg-primary/5" : "border-border"}`}>
                      <input type="radio" name={q.id} checked={data.answers[q.id] === idx} onChange={() => setAnswer(q.id, idx)} className="mt-0.5" />
                      <span><b>{String.fromCharCode(65 + idx)})</b> {opt}</span>
                    </label>
                  ))}
                </div>
              </CardContent></Card>
            ))}
            <div className="flex justify-end pt-2">
              <Button onClick={() => { if (confirm("Tem certeza que deseja enviar a prova?")) doSubmit(); }}>
                Finalizar e enviar
              </Button>
            </div>
          </div>
        )}

        {state === "submitted" && result && (
          <Card className="border-emerald-500/40 bg-emerald-500/5"><CardContent className="p-6 text-center space-y-2">
            <CheckCircle2 className="size-10 mx-auto text-emerald-600" />
            <h3 className="font-black text-lg">Prova enviada!</h3>
            <p className="text-sm">Acertos: <strong>{result.score}/{result.total}</strong></p>
            <Button onClick={onClose}>Fechar</Button>
          </CardContent></Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
