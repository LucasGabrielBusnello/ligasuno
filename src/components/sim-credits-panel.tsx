import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Coins, TrendingUp, TrendingDown, CheckCircle2, XCircle, Sparkles, Loader2 } from "lucide-react";
import { getMyCredits, buyCredits, getSimProgress } from "@/lib/sim-credits.functions";

type Period = "month" | "quarter" | "year" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "Último mês" },
  { key: "quarter", label: "3 meses" },
  { key: "year", label: "Último ano" },
  { key: "all", label: "Tudo" },
];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SimCreditsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const loadCredits = useServerFn(getMyCredits);
  const loadProgress = useServerFn(getSimProgress);
  const checkout = useServerFn(buyCredits);

  const [credits, setCredits] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [buying, setBuying] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadCredits({} as any).then(setCredits).catch(() => {});
  }, [loadCredits]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);
  useEffect(() => {
    loadProgress({ data: { period } }).then(setProgress).catch(() => {});
  }, [loadProgress, period, refreshKey]);

  async function buy(id: string) {
    setBuying(id);
    try {
      const { url } = await checkout({ data: { packageId: id, originUrl: window.location.origin } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a compra.");
    } finally {
      setBuying(null);
    }
  }

  const balance = Number(credits?.balance ?? 0);
  const low = balance <= 5;

  return (
    <div className="space-y-4">
      <Card className={`border ${low ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
        <CardContent className="p-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/30">
              <Coins className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400">Seus créditos de treino</p>
              <p className="text-2xl font-black text-white leading-tight">
                {balance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                <span className="text-xs font-medium text-neutral-400 ml-2">
                  1 crédito = {credits?.tokensPerCredit ?? 1000} tokens
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(credits?.packages ?? []).map((p: any) => (
              <Button
                key={p.id}
                size="sm"
                onClick={() => buy(p.id)}
                disabled={buying === p.id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {buying === p.id ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
                {p.credits} créditos · {brl(Number(p.price_brl))}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {low && (
        <p className="text-xs text-amber-400">
          Saldo baixo. Quando os créditos zerarem, a conversa com o paciente e a correção ficam bloqueadas até você recarregar.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "outline"}
            onClick={() => setPeriod(p.key)}
            className={period === p.key ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pontuação média"
          value={progress ? `${progress.average}` : "—"}
          hint={progress?.trend ? `${progress.trend > 0 ? "+" : ""}${progress.trend} vs. início do período` : "sem variação"}
          icon={progress?.trend >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
          tone={progress && progress.average >= 70 ? "green" : progress && progress.average >= 50 ? "amber" : "red"}
        />
        <StatCard label="Casos resolvidos" value={progress ? String(progress.solved) : "—"} hint="nota ≥ 60" icon={<CheckCircle2 className="size-5" />} tone="green" />
        <StatCard label="Não resolvidos" value={progress ? String(progress.unsolved) : "—"} hint="nota < 60" icon={<XCircle className="size-5" />} tone="red" />
        <StatCard label="Estações iniciadas" value={progress ? String(progress.total) : "—"} hint={`${progress?.abandoned ?? 0} não finalizadas`} icon={<Sparkles className="size-5" />} tone="neutral" />
      </div>

      {!!progress?.areas?.length && (
        <div className="flex flex-wrap gap-2">
          {progress.areas.slice(0, 8).map((a: any) => (
            <Badge key={a.area} variant="outline" className="border-neutral-700 text-neutral-300">
              {a.area}: <span className="ml-1 font-bold text-white">{a.average}</span> ({a.count})
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, icon, tone }: { label: string; value: string; hint?: string; icon: React.ReactNode; tone: "green" | "amber" | "red" | "neutral" }) {
  const tones: Record<string, string> = {
    green: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
    red: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
    neutral: "text-neutral-300 bg-neutral-800 ring-neutral-700",
  };
  return (
    <Card className="border-neutral-800 bg-neutral-900/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`size-10 rounded-xl flex items-center justify-center ring-1 ${tones[tone]}`}>{icon}</div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
          <p className="text-xl font-black text-white leading-tight">{value}</p>
          {hint && <p className="text-[11px] text-neutral-500">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
