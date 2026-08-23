import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Stethoscope, Send, Mic, Square, Activity, FlaskConical, ClipboardList, Loader2,
  HeartPulse, Volume2, CheckCircle2, XCircle, ThumbsUp, ThumbsDown, History, Play,
  Lightbulb, ArrowLeft, X,
} from "lucide-react";
import {
  startSimSession, simSay, simExam, simExamMenu, simRevealFinding, simFinish,
  simTranscribe, listMySimSessions, sendSimFeedback, getSimSessionDetail, simPreceptorHint,
} from "@/lib/sim.functions";


type PublicCase = {
  id: string; title: string; area: string; level: number;
  patient: { name: string; age: number | null; gender: string | null; occupation: string | null };
  triage: Record<string, any>;
  patient_image_url: string | null;
};
type ChatMsg = { role: "user" | "patient"; content: string };
type MenuItem = { key: string; label: string; sound_category: string; revealed: boolean };
type Finding = { key: string; label: string; text: string; sound_category?: string; sound_finding?: string };
type ExamOut = { name: string; justified: boolean; result_text: string; report: string; is_image: boolean; image_url: string | null };

const LEVELS = [1, 2, 3, 4, 5, 6];

function scoreColor(n: number) {
  if (n >= 85) return "text-primary";
  if (n >= 70) return "text-lime-400";
  if (n >= 50) return "text-amber-400";
  return "text-red-400";
}
function scoreRing(n: number) {
  if (n >= 85) return "ring-primary/30 bg-primary/10";
  if (n >= 70) return "ring-lime-500/40 bg-lime-500/10";
  if (n >= 50) return "ring-amber-500/40 bg-amber-500/10";
  return "ring-red-500/40 bg-red-500/10";
}

export function ClinicalSimulator() {
  const [areas, setAreas] = useState<{ area: string; levels: number[] }[]>([]);
  const [level, setLevel] = useState<number>(1);
  const [area, setArea] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [session, setSession] = useState<{ id: string; case: PublicCase } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);


  const start = useServerFn(startSimSession);
  const listSessions = useServerFn(listMySimSessions);

  useEffect(() => {
    supabase.from("sim_cases").select("area, level").eq("published", true).then(({ data }) => {
      const map = new Map<string, Set<number>>();
      (data ?? []).forEach((r: any) => {
        if (!map.has(r.area)) map.set(r.area, new Set());
        map.get(r.area)!.add(r.level);
      });
      setAreas(Array.from(map.entries()).map(([a, s]) => ({ area: a, levels: Array.from(s).sort() })).sort((a, b) => a.area.localeCompare(b.area)));
    });
    listSessions().then((r: any) => setHistory(r ?? [])).catch(() => {});
  }, []);

  const availableAreas = useMemo(() => areas.filter((a) => a.levels.includes(level)), [areas, level]);

  const begin = async () => {
    setStarting(true);
    try {
      const r: any = await start({ data: { level, area: area || null } });
      setSession({ id: r.sessionId, case: r.case });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar o treino.");
    } finally {
      setStarting(false);
    }
  };

  if (session) {
    return (
      <SimStation
        sessionId={session.id}
        c={session.case}
        onExit={() => {
          setSession(null);
          listSessions().then((r: any) => setHistory(r ?? [])).catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl overflow-hidden ring-1 ring-primary/25 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/25">
            <Stethoscope className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Treino de Semiologia</h1>
            <p className="text-sm text-muted-foreground">Converse com o paciente, examine, peça exames e feche o diagnóstico.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-bold">Nível de dificuldade</div>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => { setLevel(l); setArea(""); }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold ring-1 transition-colors ${
                    level === l ? "bg-primary text-primary-foreground ring-primary/40" : "bg-muted/40 ring-border hover:bg-muted"
                  }`}
                >
                  {l}º ano
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-bold">Área da medicina</div>
            {availableAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum caso disponível para esse nível ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setArea("")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ${area === "" ? "bg-primary text-primary-foreground ring-primary/40" : "bg-muted/40 ring-border hover:bg-muted"}`}
                >
                  Surpreenda-me
                </button>
                {availableAreas.map((a) => (
                  <button
                    key={a.area}
                    onClick={() => setArea(a.area)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ${area === a.area ? "bg-primary text-primary-foreground ring-primary/40" : "bg-muted/40 ring-border hover:bg-muted"}`}
                  >
                    {a.area}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold w-full md:w-auto" onClick={begin} disabled={starting || availableAreas.length === 0}>
            {starting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
            Iniciar treino completo
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-black flex items-center gap-2"><History className="size-5 text-primary" /> Meus treinos</h2>
        {history.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Você ainda não fez nenhum treino.</CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {history.map((h) => (
              <Card key={h.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`size-12 rounded-xl ring-1 flex items-center justify-center font-black ${h.score != null ? scoreRing(h.score) : "ring-border bg-muted/30"}`}>
                    <span className={h.score != null ? scoreColor(h.score) : "text-muted-foreground"}>{h.score ?? "—"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{h.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {h.area} · {h.level}º ano · {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    {h.diagnosis && <div className="text-[11px] text-primary truncate">Diagnóstico: {h.diagnosis}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={h.status === "finished" ? "default" : "secondary"}>{h.status === "finished" ? "Concluído" : "Em aberto"}</Badge>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs font-bold" onClick={() => setDetailId(h.id)}>
                      <History className="size-3.5 mr-1" /> Ver histórico
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

          </div>
        )}
      </div>

      <SessionHistoryDialog sessionId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

/* ============ HISTÓRICO DO CASO ============ */
function SessionHistoryDialog({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const detailFn = useServerFn(getSimSessionDetail);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) { setData(null); return; }
    setLoading(true);
    detailFn({ data: { sessionId } })
      .then((r: any) => setData(r))
      .catch((e: any) => toast.error(e?.message ?? "Não foi possível carregar o histórico."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const timeline = useMemo(() => {
    if (!data) return [] as any[];
    const items: any[] = [];
    (data.transcript ?? []).forEach((m: any) => items.push({ kind: m.role === "user" ? "voce" : "paciente", at: m.at, text: m.content }));
    (data.physical_findings ?? []).forEach((f: any) => items.push({ kind: "exame_fisico", at: f.at, text: `${f.label}: ${f.text}` }));
    (data.exam_requests ?? []).forEach((e: any) =>
      items.push({ kind: "exame_comp", at: e.at, text: `${e.name}${e.result_text ? ` — ${e.result_text}` : ""}${e.report ? `\nLaudo: ${e.report}` : ""}` }),
    );
    return items.sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime());
  }, [data]);

  const LABEL: Record<string, string> = {
    voce: "Você",
    paciente: "Paciente",
    exame_fisico: "Exame físico",
    exame_comp: "Exame complementar",
  };

  return (
    <Dialog open={!!sessionId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" /> {data?.title ?? "Histórico do caso"}
          </DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-10 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{data.area}</Badge>
              <Badge variant="secondary">{data.level}º ano</Badge>
              <Badge variant={data.status === "finished" ? "default" : "secondary"}>
                {data.status === "finished" ? "Concluído" : "Em aberto"}
              </Badge>
              {data.score != null && (
                <span className={`font-black ${scoreColor(data.score)}`}>Nota {data.score}</span>
              )}
              <span className="text-xs text-muted-foreground">{new Date(data.created_at).toLocaleString("pt-BR")}</span>
            </div>

            <div>
              <h3 className="font-black mb-2">Sequência do atendimento</h3>
              {timeline.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nenhuma interação registrada.</p>
              ) : (
                <ol className="space-y-2">
                  {timeline.map((it, i) => (
                    <li key={i} className="rounded-xl ring-1 ring-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] uppercase tracking-wide font-bold text-primary">{LABEL[it.kind]}</span>
                        {it.at && <span className="text-[10px] text-muted-foreground">{new Date(it.at).toLocaleTimeString("pt-BR")}</span>}
                      </div>
                      <p className="whitespace-pre-wrap text-foreground/90">{it.text}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {data.anamnese && (
              <div>
                <h3 className="font-black mb-1">Sua anamnese</h3>
                <p className="whitespace-pre-wrap text-foreground/90 rounded-xl ring-1 ring-border bg-muted/30 p-3">{data.anamnese}</p>
              </div>
            )}

            {data.hypothesis && (
              <div>
                <h3 className="font-black mb-1">Sua hipótese</h3>
                <p className="text-foreground/90">{data.hypothesis}</p>
              </div>
            )}

            {data.review && (
              <div className="rounded-xl ring-1 ring-primary/25 bg-primary/5 p-3 space-y-2">
                <h3 className="font-black">Parecer da IA</h3>
                {data.review.veredito && <p className="font-bold text-foreground">{data.review.veredito}</p>}
                {data.review.comentario && <p className="whitespace-pre-wrap text-foreground/90">{data.review.comentario}</p>}
                {([
                  ["Acertos", data.review.acertos],
                  ["O que faltou", data.review.faltou],
                  ["Exames desnecessários", data.review.exames_desnecessarios],
                  ["Como melhorar", data.review.melhorias],
                ] as [string, string[]][]).map(([label, list]) =>
                  Array.isArray(list) && list.length > 0 ? (
                    <div key={label}>
                      <p className="font-bold text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <ul className="list-disc pl-5">{list.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  ) : null,
                )}
              </div>
            )}

            {data.review?.resumo && <ResumoFixacao resumo={data.review.resumo} />}


            {data.diagnosis && (
              <div>
                <h3 className="font-black mb-1">Diagnóstico do caso</h3>
                <p className="text-foreground/90">{data.diagnosis}</p>
                {data.expected_conduct && <p className="mt-1 text-foreground/80"><span className="font-bold">Conduta esperada:</span> {data.expected_conduct}</p>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


/* ============ ESTAÇÃO ============ */
function SimStation({ sessionId, c, onExit }: { sessionId: string; c: PublicCase; onExit: () => void }) {
  const say = useServerFn(simSay);
  const menuFn = useServerFn(simExamMenu);
  const revealFn = useServerFn(simRevealFinding);
  const examFn = useServerFn(simExam);
  const finishFn = useServerFn(simFinish);
  const transcribeFn = useServerFn(simTranscribe);
  const hintFn = useServerFn(simPreceptorHint);
  const hintEnabled = Number(c.level) <= 2;
  const actionsRef = useRef(0);
  const hintsRef = useRef<string[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const maybeHint = async () => {
    if (!hintEnabled) return;
    actionsRef.current += 1;
    if (actionsRef.current < 3) return;
    actionsRef.current = 0;
    setHintLoading(true);
    try {
      const r: any = await hintFn({ data: { sessionId, previousHints: hintsRef.current } });
      if (r?.off_track && r.hint) {
        hintsRef.current = [...hintsRef.current, r.hint].slice(-6);
        setHint(r.hint);
      }
    } catch {
      /* dica é opcional, nunca interrompe o treino */
    } finally {
      setHintLoading(false);
    }
  };

  const [tab, setTab] = useState<"exame" | "exames" | "notas">("exame");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [examName, setExamName] = useState("");
  const [exams, setExams] = useState<ExamOut[]>([]);
  const [notes, setNotes] = useState("");
  const [sounds, setSounds] = useState<any[]>([]);
  const [finishOpen, setFinishOpen] = useState(false);
  const [hypothesis, setHypothesis] = useState("");
  const [grading, setGrading] = useState(false);
  const [review, setReview] = useState<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuFn({ data: { sessionId } }).then((r: any) => setMenu(r ?? [])).catch(() => {});
    supabase.from("sim_auscultation_sounds").select("*").then(({ data }) => setSounds(data ?? []));
  }, [sessionId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length, busy]);

  const pushFindings = (list: Finding[]) => {
    if (!list?.length) return;
    setFindings((prev) => {
      const next = [...prev];
      list.forEach((f) => { if (!next.some((x) => x.key === f.key)) next.push(f); });
      return next;
    });
    setMenu((prev) => prev.map((m) => (list.some((f) => f.key === m.key) ? { ...m, revealed: true } : m)));
  };

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setChat((p) => [...p, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r: any = await say({ data: { sessionId, message: msg } });
      setChat((p) => [...p, { role: "patient", content: r.reply }]);
      pushFindings(r.findings ?? []);
      if (r.findings?.length) setTab("exame");
      void maybeHint();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao falar com o paciente.");
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (key: string) => {
    try {
      const f: any = await revealFn({ data: { sessionId, key } });
      pushFindings([f]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no exame físico.");
    }
  };

  const askExam = async () => {
    const name = examName.trim();
    if (!name) return;
    setExamName("");
    setBusy(true);
    try {
      const r: any = await examFn({ data: { sessionId, examName: name } });
      setExams((p) => [...p, r]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao solicitar exame.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (hypothesis.trim().length < 3) { toast.error("Escreva sua hipótese diagnóstica."); return; }
    setGrading(true);
    try {
      const r: any = await finishFn({ data: { sessionId, anamnese: notes, hypothesis } });
      setReview(r);
      setFinishOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao corrigir a estação.");
    } finally {
      setGrading(false);
    }
  };

  if (review) return <SimResult sessionId={sessionId} review={review} onExit={onExit} />;

  const t = c.triage ?? {};
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={onExit}>Sair do treino</Button>
        <Badge variant="secondary">{c.area}</Badge>
        <Badge variant="outline">{c.level}º ano</Badge>
        <Button size="sm" className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold" onClick={() => setFinishOpen(true)}>
          Encerrar e diagnosticar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 ring-1 ring-primary/25 flex items-center justify-center text-primary font-black text-lg overflow-hidden">
            {c.patient_image_url ? <img src={c.patient_image_url} alt="" className="size-full object-cover" /> : (c.patient.name ?? "P").slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="font-black">{c.patient.name}</div>
            <div className="text-xs text-muted-foreground">
              {c.patient.age ? `${c.patient.age} anos` : ""} {c.patient.gender ? `· ${c.patient.gender}` : ""} {c.patient.occupation ? `· ${c.patient.occupation}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:ml-auto">
            {[
              ["PA", t.pa], ["FC", t.fc], ["FR", t.fr], ["Tax", t.temp], ["SpO₂", t.spo2], ["Dor", t.dor],
            ].filter(([, v]) => !!v).map(([k, v]) => (
              <div key={String(k)} className="px-2.5 py-1 rounded-lg bg-muted/40 ring-1 ring-border text-[11px]">
                <span className="text-muted-foreground">{k}: </span><span className="font-bold">{String(v)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {t.chief_complaint && (
        <Card className="border-primary/25">
          <CardContent className="p-4 text-sm">
            <span className="text-xs uppercase font-bold text-primary">Triagem · </span>
            {t.chief_complaint}
            {t.observacoes ? <span className="text-muted-foreground"> — {t.observacoes}</span> : null}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        {/* CHAT */}
        <Card className="flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/60 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
            <HeartPulse className="size-4 text-primary" /> Consulta
          </div>
          <div ref={chatRef} className="flex-1 min-h-[320px] max-h-[52vh] overflow-y-auto p-4 space-y-3">
            {chat.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Comece se apresentando e pergunte o que trouxe {c.patient.name} até você. Diga também quando quiser examinar
                (“vou auscultar seu coração”, “vou palpar seu abdome”).
              </p>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> aguardando...</div>}
          </div>
          <div className="p-3 border-t border-border/60 flex gap-2">
            <MicButton onText={(txt) => send(txt)} transcribe={transcribeFn} disabled={busy} />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder="Fale com o paciente..."
              disabled={busy}
            />
            <Button onClick={() => send(input)} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Send className="size-4" />
            </Button>
          </div>
        </Card>

        {/* PAINEL */}
        <Card className="overflow-hidden">
          <div className="flex border-b border-border/60 overflow-x-auto">
            {([["exame", "Exame físico", Activity], ["exames", "Exames complementares", FlaskConical], ["notas", "Anamnese", ClipboardList]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id as any)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                  tab === id ? "border-primary/40 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          <CardContent className="p-4 max-h-[52vh] overflow-y-auto space-y-3">
            {tab === "exame" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {menu.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => reveal(m.key)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ring-1 ${
                        m.revealed ? "bg-primary/10 ring-primary/30 text-primary" : "bg-muted/40 ring-border hover:bg-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {findings.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma manobra realizada ainda.</p>}
                {findings.map((f) => (
                  <div key={f.key} className="rounded-xl ring-1 ring-border p-3 space-y-2">
                    <div className="text-xs font-black uppercase text-primary">{f.label}</div>
                    <p className="text-sm">{f.text}</p>
                    <SoundPlayer finding={f} sounds={sounds} />
                  </div>
                ))}
              </>
            )}

            {tab === "exames" && (
              <>
                <div className="flex gap-2">
                  <Input
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") askExam(); }}
                    placeholder="Ex.: hemograma, ECG, radiografia de tórax..."
                    disabled={busy}
                  />
                  <Button onClick={askExam} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">Solicitar</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Peça só o que você justificaria: exames desnecessários descontam pontos.</p>
                {exams.map((e, i) => (
                  <div key={i} className="rounded-xl ring-1 ring-border p-3 space-y-1">
                    <div className="text-xs font-black uppercase text-primary flex items-center gap-2">{e.name}</div>
                    {e.image_url && <img src={e.image_url} alt={e.name} className="rounded-lg w-full object-cover" />}
                    <p className="text-sm whitespace-pre-wrap">{e.result_text}</p>
                    {e.report && <p className="text-xs text-muted-foreground whitespace-pre-wrap"><b>Laudo:</b> {e.report}</p>}
                  </div>
                ))}
              </>
            )}

            {tab === "notas" && (
              <>
                <p className="text-[11px] text-muted-foreground">Escreva sua anamnese e o exame físico como faria no prontuário. Isso entra na correção.</p>
                <Textarea rows={14} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Identificação, QP, HDA, antecedentes, hábitos, exame físico..." />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Encerrar estação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Hipótese diagnóstica</div>
              <Input value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Seu diagnóstico principal" />
            </div>
            <p className="text-xs text-muted-foreground">Sua anamnese escrita, os exames pedidos e a conversa serão avaliados.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishOpen(false)}>Voltar</Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={finish} disabled={grading}>
              {grading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Corrigir estação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SoundPlayer({ finding, sounds }: { finding: Finding; sounds: any[] }) {
  const cat = finding.sound_category ?? "nenhum";
  if (!cat || cat === "nenhum") return null;
  const key = (finding.sound_finding ?? "").toLowerCase();
  const match = sounds.find((s) => s.category === cat && String(s.finding_key).toLowerCase() === key);
  return (
    <div className="rounded-lg bg-muted/40 ring-1 ring-border p-2.5 space-y-2">
      <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
        <Volume2 className="size-3.5" /> Ausculta — {cat}
      </div>
      {match?.audio_url ? (
        <audio controls src={match.audio_url} className="w-full h-9" />
      ) : (
        <p className="text-xs text-muted-foreground">
          {match?.description ?? `Som característico: ${(finding.sound_finding ?? "normal").replace(/_/g, " ")}. (áudio ainda não cadastrado nesta biblioteca)`}
        </p>
      )}
    </div>
  );
}

function MicButton({ onText, transcribe, disabled }: { onText: (t: string) => void; transcribe: any; disabled?: boolean }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (rec) { rec.stop(); setRec(null); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setLoading(true);
        try {
          const b64 = await new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
            fr.onerror = rej;
            fr.readAsDataURL(blob);
          });
          const format = (mr.mimeType || "").includes("mp4") ? "m4a" : "webm";
          const r: any = await transcribe({ data: { audio: b64, format } });
          if (r?.text) onText(r.text);
          else toast.error("Não consegui entender o áudio.");
        } catch (e: any) {
          toast.error(e?.message ?? "Falha ao transcrever.");
        } finally {
          setLoading(false);
        }
      };
      mr.start();
      setRec(mr);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  return (
    <Button type="button" variant={rec ? "destructive" : "outline"} onClick={toggle} disabled={disabled || loading} title="Falar com o paciente">
      {loading ? <Loader2 className="size-4 animate-spin" /> : rec ? <Square className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
}

function SimResult({ sessionId, review, onExit }: { sessionId: string; review: any; onExit: () => void }) {
  const fbFn = useServerFn(sendSimFeedback);
  const [sent, setSent] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<"up" | "down" | null>(null);

  const submit = async (r: "up" | "down") => {
    setRating(r);
    try {
      await fbFn({ data: { sessionId, rating: r, comment } });
      setSent(true);
      toast.success("Obrigado! Seu retorno vai para revisão do professor responsável.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar feedback.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className={`ring-1 ${scoreRing(review.score)}`}>
        <CardContent className="p-6 flex flex-wrap items-center gap-6">
          <div className="text-center">
            <div className={`text-6xl font-black ${scoreColor(review.score)}`}>{review.score}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">de 100</div>
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="font-black text-lg">{review.veredito}</div>
            <div className="text-sm text-muted-foreground">Diagnóstico correto: <b className="text-foreground">{review.diagnostico_correto}</b></div>
          </div>
          <Button variant="outline" onClick={onExit}>Novo treino</Button>
        </CardContent>
      </Card>

      {review.comentario && <Card><CardContent className="p-5 text-sm whitespace-pre-wrap">{review.comentario}</CardContent></Card>}

      <div className="grid md:grid-cols-2 gap-3">
        <ListCard title="Você acertou" items={review.acertos} icon={<CheckCircle2 className="size-4 text-primary" />} />
        <ListCard title="Faltou" items={review.faltou} icon={<XCircle className="size-4 text-red-500" />} />
        <ListCard title="Exames desnecessários" items={review.exames_desnecessarios} icon={<FlaskConical className="size-4 text-amber-500" />} />
        <ListCard title="Como melhorar" items={review.melhorias} icon={<Activity className="size-4 text-primary" />} />
      </div>

      {review.case?.expected_conduct && (
        <Card><CardContent className="p-5 text-sm"><b className="text-primary">Conduta esperada: </b>{review.case.expected_conduct}</CardContent></Card>
      )}

      <ResumoFixacao resumo={review.resumo} />


      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="text-sm font-bold">A correção fez sentido para você?</div>
          {sent ? (
            <p className="text-sm text-primary">Feedback enviado. Obrigado!</p>
          ) : (
            <>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Se discordou de algo, explique aqui (opcional)." />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => submit("up")} disabled={rating !== null}><ThumbsUp className="size-4 mr-2" /> Fez sentido</Button>
                <Button variant="outline" onClick={() => submit("down")} disabled={rating !== null}><ThumbsDown className="size-4 mr-2" /> Discordo</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ResumoFixacao({ resumo }: { resumo?: any }) {
  if (!resumo || (!resumo.definicao && !resumo.quadro_clinico?.length)) return null;
  const blocks: [string, string[] | string][] = [
    ["Definição", resumo.definicao],
    ["Epidemiologia e fatores de risco", resumo.epidemiologia],
    ["Fisiopatologia", resumo.fisiopatologia],
    ["Quadro clínico", resumo.quadro_clinico],
    ["Sinais-chave / red flags", resumo.sinais_chave],
    ["Diagnóstico", resumo.diagnostico],
    ["Tratamento e conduta", resumo.tratamento],
    ["Diagnósticos diferenciais", resumo.diferenciais],
    ["Complicações", resumo.complicacoes],
    ["Pegadinhas de prova", resumo.pegadinhas],
  ];
  return (
    <Card className="ring-1 ring-primary/25 bg-primary/5">
      <CardContent className="p-5 space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-black">Resumo para fixação</div>
          <div className="text-lg font-black text-foreground">{resumo.doenca}</div>
        </div>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {blocks.map(([label, value]) => {
            const list = Array.isArray(value) ? value.filter(Boolean) : [];
            const text = typeof value === "string" ? value.trim() : "";
            if (!list.length && !text) return null;
            return (
              <div key={label}>
                <p className="font-bold text-xs uppercase tracking-wide text-primary">{label}</p>
                {text ? (
                  <p className="text-foreground/90 whitespace-pre-wrap">{text}</p>
                ) : (
                  <ul className="list-disc pl-4 text-foreground/90 space-y-0.5">
                    {list.map((i: string, k: number) => <li key={k}>{i}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {resumo.bordao && (
          <p className="rounded-lg bg-background/70 ring-1 ring-primary/20 p-3 text-sm font-bold text-foreground">💡 {resumo.bordao}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ListCard({ title, items, icon }: { title: string; items?: string[]; icon: React.ReactNode }) {

  if (!items?.length) return null;
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="text-xs font-black uppercase flex items-center gap-2">{icon} {title}</div>
        <ul className="space-y-1 text-sm list-disc pl-4">
          {items.map((i, k) => <li key={k}>{i}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
