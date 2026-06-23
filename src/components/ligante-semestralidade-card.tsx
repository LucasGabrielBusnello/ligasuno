import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, CheckCircle2, LogOut, Clock } from "lucide-react";
import { getMySemesterPayment, createSemesterPix, getSemesterPaymentStatus } from "@/lib/semester.functions";
import { StatusBadge } from "@/components/semester-dialog";
import { createLeaveRequest, getMyPendingLeaveRequest } from "@/lib/leave-request.functions";
import { PixPaymentDialog, type PixPaymentData } from "@/components/pix-payment-dialog";

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
  const startPix = useServerFn(createSemesterPix);
  const checkStatus = useServerFn(getSemesterPaymentStatus);
  const leave = useServerFn(createLeaveRequest);
  const pending = useServerFn(getMyPendingLeaveRequest);
  const [data, setData] = useState<{ cycle: any; payment: any } | null>(null);
  const [paying, setPaying] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<any>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMine({ data: { league_id: leagueId } }).then((r) => setData(r as any)).catch(() => setData({ cycle: null, payment: null }));
    pending({ data: { league_id: leagueId } }).then((r: any) => setPendingLeave(r?.request)).catch(() => {});
  }, [leagueId]);

  async function submitLeave() {
    setSubmitting(true);
    try {
      await leave({ data: { league_id: leagueId, reason: leaveReason || undefined } } as any);
      toast.success("Pedido enviado à presidência");
      setLeaveOpen(false);
      const r: any = await pending({ data: { league_id: leagueId } });
      setPendingLeave(r?.request);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar pedido");
    } finally { setSubmitting(false); }
  }

  // Se houver pedido pendente, mostra aviso destacado no lugar do card
  if (pendingLeave) {
    return (
      <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Clock className="size-5 text-amber-600" />
          <div className="text-sm flex-1">
            <p className="font-black text-amber-700 dark:text-amber-400">Pedido de desistência em análise</p>
            <p className="text-muted-foreground">A presidência da liga ainda não respondeu seu pedido.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cycle = data?.cycle;
  const payment = data?.payment;

  return (
    <>
      {cycle && <SemesterBlock cycle={cycle} payment={payment} paying={paying} onPay={async () => {
        setPaying(true);
        try {
          const r: any = await pay({ data: { league_id: leagueId, origin_url: window.location.origin } });
          if (r.already_paid) return toast.success("Você já está em dia");
          if (r.url) window.location.href = r.url;
        } catch (e: any) {
          toast.error(e?.message ?? "Erro ao iniciar pagamento");
        } finally { setPaying(false); }
      }} />}

      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setLeaveOpen(true)}>
          <LogOut className="size-4 mr-1.5" /> Desistir da liga
        </Button>
      </div>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar desistência da liga</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seu pedido será enviado à presidência da liga para análise. Após aprovação, você perderá o acesso ao painel do ligante.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Motivo (opcional)</Label>
            <Textarea id="leave-reason" rows={3} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Conte brevemente o motivo da desistência..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={submitLeave} disabled={submitting}>{submitting ? "Enviando..." : "Confirmar pedido"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SemesterBlock({ cycle, payment, paying, onPay }: { cycle: any; payment: any; paying: boolean; onPay: () => void }) {
  const status = payment?.status ?? "pending";
  const isOverdue = new Date(cycle.due_date) < new Date(new Date().toISOString().slice(0, 10));
  const baseDue = payment?.amount_due_cents ?? cycle.amount_cents;
  const total = baseDue + (isOverdue && status !== "paid" ? (cycle.late_fee_cents ?? 0) : 0);

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
              {brl(baseDue)}{isOverdue && cycle.late_fee_cents > 0 && status !== "paid" ? ` + ${brl(cycle.late_fee_cents)} de acréscimo` : ""}
              {" "}• Vencimento {fmtDate(cycle.due_date)}
            </p>
          </div>
        </div>
        <Button onClick={onPay} disabled={paying}>{paying ? "Aguarde..." : `Pagar ${brl(total)} via Pix`}</Button>
      </CardContent>
    </Card>
  );
}
