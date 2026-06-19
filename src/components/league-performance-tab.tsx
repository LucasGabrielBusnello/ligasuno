import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, UserCheck, Globe2, ArrowLeft, Check } from "lucide-react";

type FilterMode = "all" | "ligantes" | "nao_ligantes";

export function LeaguePerformanceTab({ league }: { league: any }) {
  const [sets, setSets] = useState<any[]>([]);
  const [openSet, setOpenSet] = useState<any | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("league_quiz_sets").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
      setSets(data ?? []);
      const { data: mems } = await supabase.from("league_memberships").select("user_id, role").eq("league_id", league.id);
      const ids = new Set<string>();
      (mems ?? []).forEach((m: any) => { if (m.role === "ligante" || m.role === "diretor" || m.role === "presidente") ids.add(m.user_id); });
      if (league.president_id) ids.add(league.president_id);
      setMemberIds(ids);
    })();
  }, [league.id]);

  async function openQuizSet(s: any) {
    setOpenSet(s); setLoading(true);
    const { data: qs } = await (supabase as any).rpc("manager_get_quizzes", { _set_id: s.id });
    setQuizzes(qs ?? []);
    const ids = (qs ?? []).map((q: any) => q.id);
    if (ids.length) {
      const { data: ans } = await supabase.from("league_quiz_answers").select("*").in("quiz_id", ids);
      setAnswers(ans ?? []);
    } else setAnswers([]);
    setLoading(false);
  }

  const filteredAnswers = useMemo(() => {
    if (filter === "all") return answers;
    if (filter === "ligantes") return answers.filter((a) => memberIds.has(a.user_id));
    return answers.filter((a) => !memberIds.has(a.user_id));
  }, [answers, filter, memberIds]);

  const setStats = useMemo(() => {
    const m: Record<string, { ligantes: number; nao: number; total: number; correct: number; respondents: Set<string> }> = {};
    for (const s of sets) m[s.id] = { ligantes: 0, nao: 0, total: 0, correct: 0, respondents: new Set() };
    // need to know which set each answer belongs to: lazy approach — only fill for open
    return m;
  }, [sets]);

  if (!openSet) {
    return (
      <div className="space-y-4">
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <h3 className="font-black">Desempenho dos quizzes</h3>
                <p className="text-xs text-muted-foreground">Selecione um caderno para ver estatísticas detalhadas por questão.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid sm:grid-cols-2 gap-3">
          {sets.length === 0 && <p className="text-sm text-muted-foreground sm:col-span-2">Nenhum caderno criado ainda.</p>}
          {sets.map((s) => (
            <button key={s.id} onClick={() => openQuizSet(s)} className="text-left">
              <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BarChart3 className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black truncate">{s.title}</h4>
                      {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                      <Badge variant="secondary" className="mt-1 text-[10px]">{s.is_private ? "Privado" : "Aberto"}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // visão por caderno
  const respondents = new Set(filteredAnswers.map((a) => a.user_id));
  const totalAnsweredAll = filteredAnswers.length;
  const correctAll = filteredAnswers.filter((a) => a.is_correct).length;
  const accuracy = totalAnsweredAll ? Math.round((correctAll / totalAnsweredAll) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setOpenSet(null)}><ArrowLeft className="size-4" /> Voltar</Button>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          <FilterBtn active={filter === "all"} onClick={() => setFilter("all")} icon={<Users className="size-3.5" />} label="Todos" />
          <FilterBtn active={filter === "ligantes"} onClick={() => setFilter("ligantes")} icon={<UserCheck className="size-3.5" />} label="Ligantes" />
          <FilterBtn active={filter === "nao_ligantes"} onClick={() => setFilter("nao_ligantes")} icon={<Globe2 className="size-3.5" />} label="Não-ligantes" />
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-1">
          <h3 className="font-black text-lg">{openSet.title}</h3>
          {openSet.description && <p className="text-sm text-muted-foreground">{openSet.description}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <Stat label="Respondentes únicos" value={respondents.size.toString()} />
            <Stat label="Respostas totais" value={totalAnsweredAll.toString()} />
            <Stat label="Taxa de acerto geral" value={`${accuracy}%`} highlight={accuracy >= 70} />
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="space-y-3">
        {quizzes.map((q, i) => {
          const qAns = filteredAnswers.filter((a) => a.quiz_id === q.id);
          const total = qAns.length;
          const correctCount = qAns.filter((a) => a.is_correct).length;
          const pct = total ? Math.round((correctCount / total) * 100) : 0;
          const opts = q.options as string[];
          const optCounts = opts.map((_, idx) => qAns.filter((a) => a.selected === idx).length);

          return (
            <Card key={q.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-[11px] font-black shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm font-medium">{q.question}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{total} respostas</Badge>
                    <Badge className={pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-destructive"}>{pct}% acerto</Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {opts.map((o, idx) => {
                    const count = optCounts[idx];
                    const p = total ? Math.round((count / total) * 100) : 0;
                    const ok = idx === q.correct_answer;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`inline-flex items-center justify-center size-5 rounded-full text-[10px] font-black shrink-0 ${ok ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                              {ok ? <Check className="size-3" /> : String.fromCharCode(65 + idx)}
                            </span>
                            <span className={`truncate ${ok ? "font-bold" : ""}`}>{o}</span>
                          </div>
                          <span className="font-bold tabular-nums shrink-0 ml-2">{p}% <span className="text-muted-foreground font-normal">({count})</span></span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${ok ? "bg-emerald-500" : "bg-primary/60"}`} style={{ width: `${p}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon} {label}
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${highlight ? "border-emerald-500/40 bg-emerald-500/5" : "bg-muted/40"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{label}</div>
      <div className="text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}
