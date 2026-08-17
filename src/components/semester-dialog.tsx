import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Clock, History as HistoryIcon, Wallet } from "lucide-react";
import {
  upsertCurrentSemesterCycle,
  closeCurrentSemesterCycle,
  listCyclePayments,
  listSemesterCycles,
  setSemesterPaymentStatus,

} from "@/lib/semester.functions";

function brl(cents: number) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export function StatusBadge({ status }: { status: "pending" | "paid" | "overdue" | string }) {
  if (status === "paid")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white"><CheckCircle2 className="size-3 mr-1" />Pago</Badge>;
  if (status === "overdue")
    return <Badge className="bg-red-600 hover:bg-red-600 text-white"><AlertCircle className="size-3 mr-1" />Fora do prazo</Badge>;
  return <Badge className="bg-amber-500 hover:bg-amber-500 text-white"><Clock className="size-3 mr-1" />Pendente</Badge>;
}

export function SemesterDialog({
  league,
  open,
  onClose,
  onUpdated,
}: {
  league: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const upsert = useServerFn(upsertCurrentSemesterCycle);
  const close = useServerFn(closeCurrentSemesterCycle);
  const listCur = useServerFn(listCyclePayments);
  const listHist = useServerFn(listSemesterCycles);
  const setStatus = useServerFn(setSemesterPaymentStatus);


  const [loading, setLoading] = useState(false);
  const [cycle, setCycle] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [camedDefaultCents, setCamedDefaultCents] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [histSelected, setHistSelected] = useState<string | null>(null);
  const [histPayments, setHistPayments] = useState<any[]>([]);

  // form
  const [liganteAmount, setLiganteAmount] = useState<string>("");
  const [directorAmount, setDirectorAmount] = useState<string>("");

  const [dueDate, setDueDate] = useState<string>("");
  const [lateFee, setLateFee] = useState<string>("");
  const [notify, setNotify] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const r: any = await listCur({ data: { league_id: league.id } });
      setCycle(r.cycle);
      setPayments(r.payments);
      setCamedDefaultCents(r.camed_default_cents ?? 0);
      if (r.cycle) {
        setLiganteAmount((((r.cycle.amount_cents ?? 0)) / 100).toFixed(2));
        setDirectorAmount((((r.cycle.director_amount_cents ?? 0)) / 100).toFixed(2));
        setDueDate(r.cycle.due_date);
        setLateFee(((r.cycle.late_fee_cents ?? 0) / 100).toFixed(2));
      } else {
        setLiganteAmount("");
        setDirectorAmount("0");
        setLateFee("0");
        // default vencimento = 30 dias
        const d = new Date(); d.setDate(d.getDate() + 30);
        setDueDate(d.toISOString().slice(0, 10));
      }

      const h = await listHist({ data: { league_id: league.id } });
      setHistory(h.cycles);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) reload(); /* eslint-disable-next-line */ }, [open, league.id]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  async function changeStatus(paymentId: string, status: "paid" | "pending", amountPaidCents?: number) {
    setBusyId(paymentId);
    try {
      await setStatus({ data: { payment_id: paymentId, status, ...(amountPaidCents != null ? { amount_paid_cents: amountPaidCents } : {}) } as any });
      toast.success(status === "paid" ? "Marcado como pago" : "Marcado como pendente");
      await reload();
      onUpdated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao alterar status");
    } finally {
      setBusyId(null);
    }
  }


  async function loadHistPayments(cycleId: string) {
    setHistSelected(cycleId);
    const r = await listCur({ data: { league_id: league.id, cycle_id: cycleId } });
    setHistPayments(r.payments);
  }

  async function handleSave() {
    const ligAmt = Math.round(parseFloat((liganteAmount || "0").replace(",", ".")) * 100);
    const dirAmt = Math.round(parseFloat((directorAmount || "0").replace(",", ".")) * 100);
    const lf = Math.round(parseFloat((lateFee || "0").replace(",", ".")) * 100);
    if (Number.isNaN(dirAmt) || dirAmt < 0) return toast.error("Valor inválido");
    if (Number.isNaN(ligAmt) || ligAmt <= 0) return toast.error("Defina o valor da semestralidade para os ligantes");
    if (!dueDate) return toast.error("Defina a data de vencimento");
    try {
      const res: any = await upsert({
        data: {
          league_id: league.id,
          amount_cents: ligAmt,
          director_amount_cents: dirAmt,
          late_fee_cents: lf || 0,
          due_date: dueDate,
          notify,
        },
      });

      toast.success(cycle ? "Ciclo atualizado" : "Ciclo criado");
      if (notify) {
        if (res?.notify_skipped) {
          toast.warning(
            `A cobrança por e-mail já foi enviada hoje. Só é possível enviar 1 vez por dia — próximo envio liberado em ${
              res?.next_notify_at ? new Date(res.next_notify_at).toLocaleString("pt-BR") : "24h"
            }.`,
          );
        } else if (res?.notified) {
          toast.success(`Cobrança enviada por e-mail para ${res.notified} ligante(s).`);
        }
      }

      await reload();
      onUpdated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  async function handleClose() {
    if (!confirm("Encerrar o ciclo atual? Ele virará histórico e você poderá criar um novo.")) return;
    try {
      await close({ data: { league_id: league.id } });
      toast.success("Ciclo encerrado");
      await reload();
      onUpdated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  const paidCount = payments.filter((p) => p.status === "paid").length;
  const totalCount = payments.length;
  const pct = totalCount ? Math.round((paidCount / totalCount) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="size-5" /> Semestralidade — {league.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="current">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="current">Ciclo atual</TabsTrigger>
            <TabsTrigger value="history"><HistoryIcon className="size-3.5 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4 mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <>
                {cycle && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 rounded border">
                      <div className="text-muted-foreground text-xs">Período</div>
                      <div className="font-bold">{cycle.semester}º/{cycle.year}</div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="text-muted-foreground text-xs">Pagos</div>
                      <div className="font-bold">{paidCount}/{totalCount} ({pct}%)</div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="text-muted-foreground text-xs">Valor ligantes</div>
                      <div className="font-bold">{brl(cycle.amount_cents)}</div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="text-muted-foreground text-xs">Vencimento</div>
                      <div className="font-bold">{fmtDate(cycle.due_date)}</div>
                    </div>
                  </div>
                )}


                <div className="p-4 rounded border space-y-3 bg-muted/30">
                  <h3 className="font-black text-sm">{cycle ? "Editar ciclo atual" : "Abrir novo ciclo"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Valor ligantes (R$)</Label>
                      <Input type="number" step="0.01" min="0" value={liganteAmount} onChange={(e) => setLiganteAmount(e.target.value)} placeholder="0,00" />
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        Cobrado de <strong>todos os ligantes</strong> da liga.
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Valor presidente/diretores (R$)</Label>
                      <Input type="number" step="0.01" min="0" value={directorAmount} onChange={(e) => setDirectorAmount(e.target.value)} placeholder="0,00" />
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        Vale <strong>apenas para presidente e diretores</strong>.
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs">Vencimento</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Acréscimo após vencer (R$)</Label>
                      <Input type="number" step="0.01" min="0" value={lateFee} onChange={(e) => setLateFee(e.target.value)} placeholder="0,00" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={notify} onCheckedChange={setNotify} id="notify" />
                    <Label htmlFor="notify" className="text-sm">Notificar ligantes pendentes por e-mail</Label>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={handleSave}>{cycle ? "Salvar alterações" : "Abrir ciclo"}</Button>
                    {cycle && <Button variant="outline" onClick={handleClose}>Encerrar ciclo</Button>}
                  </div>
                </div>


                {cycle && (
                  <div className="space-y-2">
                    <h3 className="font-black text-sm">Status dos ligantes</h3>
                    <p className="text-xs text-muted-foreground">
                      Você pode dar baixa manualmente: use “Marcar como pago” (ou informe outro valor recebido).
                    </p>
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum ligante na liga ainda.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <Input
                          placeholder="Buscar ligante por nome ou e-mail…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        {payments
                          .filter((p) => {
                            const q = search.trim().toLowerCase();
                            if (!q) return true;
                            return `${p.profiles?.full_name ?? ""} ${p.profiles?.username ?? ""} ${p.profiles?.email ?? ""}`
                              .toLowerCase()
                              .includes(q);
                          })
                          .map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded border text-sm">
                            <div>
                              <div className="font-bold">{p.profiles?.full_name || p.profiles?.username}</div>
                              <div className="text-xs text-muted-foreground">{p.profiles?.email}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {p.paid_at && <span className="text-xs text-muted-foreground">{fmtDate(p.paid_at)}</span>}
                              <StatusBadge status={p.status} />
                              {p.status === "paid" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyId === p.id}
                                  onClick={() => changeStatus(p.id, "pending")}
                                >
                                  Marcar pendente
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={busyId === p.id}
                                  onClick={() => changeStatus(p.id, "paid")}
                                >
                                  Marcar como pago
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem ciclos anteriores.</p>
            ) : (
              <div className="space-y-2">
                {history.map((c) => (
                  <div key={c.id} className="border rounded">
                    <button
                      className="w-full p-3 text-left flex items-center justify-between hover:bg-muted/40"
                      onClick={() => loadHistPayments(c.id)}
                    >
                      <div>
                        <div className="font-bold">{c.semester}º/{c.year} {c.is_current && <Badge variant="outline" className="ml-2">Atual</Badge>}</div>
                        <div className="text-xs text-muted-foreground">
                          {brl(c.amount_cents)} • Vencimento {fmtDate(c.due_date)} {c.closed_at && `• Encerrado em ${fmtDate(c.closed_at)}`}
                        </div>
                      </div>
                    </button>
                    {histSelected === c.id && (
                      <div className="border-t p-3 space-y-1.5">
                        {histPayments.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem pagamentos registrados.</p>
                        ) : histPayments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span>{p.profiles?.full_name || p.profiles?.username}</span>
                            <StatusBadge status={p.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
