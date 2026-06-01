import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wallet, CheckCircle2 } from "lucide-react";
import { getMySemesterPayment, createSemesterCheckout } from "@/lib/semester.functions";
import { StatusBadge } from "@/components/semester-dialog";

function brl(cents: number) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export function LiganteSemestralidadeCard({ leagueId }: { leagueId: string }) {
  const getMine = useServerFn(getMySemesterPayment);
  const pay = useServerFn(createSemesterCheckout);
  const [data, setData] = useState<{ cycle: any; payment: any } | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    getMine({ data: { league_id: leagueId } }).then((r) => setData(r as any)).catch(() => setData({ cycle: null, payment: null }));
  }, [leagueId]);

  if (!data?.cycle) return null;
  const { cycle, payment } = data;
  const status = payment?.status ?? "pending";
  const isOverdue = new Date(cycle.due_date) < new Date(new Date().toISOString().slice(0, 10));
  // Valor devido do próprio ligante (ligantes pagam CAMED, presidente/diretores pagam o valor customizado)
  const baseDue = payment?.amount_due_cents ?? cycle.amount_cents;
  const total = baseDue + (isOverdue && status !== "paid" ? (cycle.late_fee_cents ?? 0) : 0);

  async function handlePay() {
    setPaying(true);
    try {
      const r: any = await pay({ data: { league_id: leagueId, origin_url: window.location.origin } });
      if (r.already_paid) return toast.success("Você já está em dia");
      if (r.url) window.location.href = r.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar pagamento");
    } finally { setPaying(false); }
  }

  if (status === "paid") {
    return (
      <Card className="mb-4 border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <div className="text-sm">
            <p className="font-black text-emerald-700 dark:text-emerald-400">Semestralidade {cycle.semester}º/{cycle.year} paga</p>
            <p className="text-muted-foreground">Pagamento confirmado em {fmtDate(payment?.paid_at)}.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Wallet className="size-5" />
          <div className="text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black">Semestralidade {cycle.semester}º/{cycle.year}</span>
              <StatusBadge status={status} />
            </div>
            <p className="text-muted-foreground">
              {brl(cycle.amount_cents)}{isOverdue && cycle.late_fee_cents > 0 && status !== "paid" ? ` + ${brl(cycle.late_fee_cents)} de acréscimo` : ""}
              {" "}• Vencimento {fmtDate(cycle.due_date)}
            </p>
          </div>
        </div>
        <Button onClick={handlePay} disabled={paying}>{paying ? "Aguarde..." : `Pagar ${brl(total)} via Pix`}</Button>
      </CardContent>
    </Card>
  );
}
