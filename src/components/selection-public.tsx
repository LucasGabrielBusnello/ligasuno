import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronRight, QrCode, Calendar, Clock, FileText, ClipboardCheck } from "lucide-react";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";
import { createSelectionCheckout } from "@/lib/selection.functions";
import { checkExamAvailability } from "@/lib/exam.functions";
import { ExamRunner } from "@/components/exam-runner";

const SEMESTERS = [1, 3, 5, 7, 9, 11] as const;

export function SelectionRegisterDialog({ league, open, onClose, defaultEmail, onPaid }: {
  league: any; open: boolean; onClose: () => void; defaultEmail?: string; onPaid?: () => void;
}) {
  const checkout = useServerFn(createSelectionCheckout);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: "", cpf: "", email: defaultEmail ?? "", phone: "", semester: 1, registration_number: "" });
  const [fee, setFee] = useState(0);

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({ full_name: "", cpf: "", email: defaultEmail ?? "", phone: "", semester: 1, registration_number: "" });
      supabase.from("camed_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setFee(Number((data as any)?.league_registration_fee) || 0));
    }
  }, [open, defaultEmail]);


  const [quotas, setQuotas] = useState<any[]>([]);
  useEffect(() => { if (open) supabase.from("league_selection_quotas").select("*").eq("league_id", league.id).then(({ data }) => setQuotas(data ?? [])); }, [open, league?.id]);

  async function submit() {
    const cpf = normalizeCpf(form.cpf);
    if (!form.full_name || form.full_name.length < 2) return toast.error("Informe seu nome completo");
    if (!isValidCPF(cpf)) return toast.error("CPF inválido");
    if (!form.email || !form.email.includes("@")) return toast.error("Email inválido");
    if (!form.phone || form.phone.length < 8) return toast.error("Telefone inválido");
    if (!form.registration_number || form.registration_number.trim().length < 2) return toast.error("Informe sua matrícula");
    try {
      setSubmitting(true);
      const res: any = await checkout({ data: {
        league_id: league.id, full_name: form.full_name, cpf, email: form.email,
        phone: form.phone, semester: form.semester, payment_method: "pix",
        registration_number: form.registration_number.trim(),
        origin_url: window.location.origin,
      } } as any);
      if (res?.free) { toast.success("Inscrição confirmada!"); onPaid?.(); onClose(); return; }
      if (res?.url) window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar");
    } finally { setSubmitting(false); }
  }

  if (!league) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscrição — Prova da {league.name}</DialogTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant={step === 1 ? "default" : "secondary"}>1. Dados</Badge>
            <Badge variant={step === 2 ? "default" : "secondary"}>2. Pagamento</Badge>
          </div>
        </DialogHeader>

        {/* Informações da prova */}
        <Card className="bg-muted/30"><CardContent className="p-3 space-y-1 text-sm">
          {league.selection_exam_date && <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /> {new Date(league.selection_exam_date).toLocaleDateString("pt-BR")}</div>}
          {league.selection_exam_time && <div className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /> {String(league.selection_exam_time).slice(0,5)}</div>}
          {league.selection_exam_description && <div className="flex items-start gap-2"><FileText className="size-4 text-muted-foreground mt-0.5" /><span className="whitespace-pre-line">{league.selection_exam_description}</span></div>}
          <div className="text-xs text-muted-foreground pt-1">Vagas: {league.selection_total_seats}{quotas.length > 0 && <> · Cotas: {quotas.map((q:any) => `${q.seats}× ${q.semester}º`).join(", ")}</>}</div>
        </CardContent></Card>

        {step === 1 ? (
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>CPF *</Label><Input inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/[^\d.-]/g, "") })} placeholder="000.000.000-00" /></div>
            <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(49) 99999-9999" /></div>
            <div><Label>Matrícula *</Label><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="Sua matrícula institucional" /></div>
            <div>
              <Label>Semestre *</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.semester} onChange={(e) => setForm({ ...form, semester: +e.target.value })}>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}º semestre</option>)}
              </select>
            </div>
            <DialogFooter><Button onClick={() => {
              if (!form.full_name || form.full_name.length < 2) return toast.error("Informe o nome completo");
              if (!isValidCPF(normalizeCpf(form.cpf))) return toast.error("CPF inválido");
              if (!form.email.includes("@")) return toast.error("Email inválido");
              if (form.phone.length < 8) return toast.error("Telefone inválido");
              if (!form.registration_number || form.registration_number.trim().length < 2) return toast.error("Informe sua matrícula");
              setStep(2);
            }}>Continuar <ChevronRight className="size-4" /></Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <Card className="border-primary/40 bg-primary/5"><CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground">Taxa de inscrição na prova</div>
              <div className="text-3xl font-black">R$ {fee.toFixed(2)}</div>
            </CardContent></Card>
            {fee > 0 && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 flex items-center gap-3">
                <QrCode className="size-8 text-emerald-600 shrink-0" />
                <div className="text-sm">
                  <div className="font-bold">Pagamento via Pix</div>
                  <div className="text-xs text-muted-foreground">A inscrição na prova é processada exclusivamente via Pix.</div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Processando..." : fee === 0 ? "Confirmar" : "Pagar e inscrever"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SelectionAccessDialog({ league, registration, open, onClose }: { league: any; registration: any; open: boolean; onClose: () => void }) {
  const [myRank, setMyRank] = useState<any | null>(null);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [examState, setExamState] = useState<{ available: boolean; reason?: string; paused?: boolean } | null>(null);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const checkExam = useServerFn(checkExamAvailability);

  async function reloadExam() {
    if (!registration) return;
    try {
      const r: any = await checkExam({ data: { league_id: league.id } } as any);
      setExamState(r);
    } catch { setExamState({ available: false, reason: "error" }); }
  }

  useEffect(() => {
    if (!open || !registration) return;
    supabase.from("league_selection_registrations").select("ranked_position, ranked_via, ranked_semester").eq("id", registration.id).maybeSingle().then(({ data }) => setMyRank(data));
    supabase.from("league_selection_quotas").select("*").eq("league_id", league.id).then(({ data }) => setQuotas(data ?? []));
    reloadExam();
  }, [open, registration?.id]);

  if (!league || !registration) return null;

  const examLabel = (() => {
    if (!examState) return "Carregando prova...";
    if (examState.available) return examState.paused ? "Retomar Prova (pausada)" : "Acessar Prova";
    switch (examState.reason) {
      case "not_published": return "Aguardando publicação da prova";
      case "not_present": return "Aguardando confirmação de presença";
      case "already_submitted": return "Prova já enviada";
      case "not_paid": return "Pagamento pendente";
      default: return "Prova indisponível";
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscrição confirmada · {league.name}</DialogTitle>
        </DialogHeader>
        <Card className="border-emerald-500/40 bg-emerald-500/5"><CardContent className="p-4 space-y-1 text-sm">
          <div><b>Candidato:</b> {registration.full_name}</div>
          <div><b>Semestre:</b> {registration.semester}º</div>
          <div><b>Valor pago:</b> R$ {Number(registration.paid_price ?? 0).toFixed(2)}</div>
          {myRank?.ranked_position && (
            <div className="pt-2 border-t mt-2">
              <Badge className="bg-emerald-600">Classificado · {myRank.ranked_position}º</Badge>
              {myRank.ranked_via === "quota" && <span className="text-xs ml-2">(Vaga {myRank.ranked_semester}º semestre)</span>}
            </div>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-2">
          <h4 className="font-black text-sm flex items-center gap-2"><ClipboardCheck className="size-4" /> Prova online</h4>
          <Button
            className="w-full"
            disabled={!examState?.available}
            onClick={() => setRunnerOpen(true)}
            style={examState?.available ? { background: league.theme_color } : undefined}
          >
            <ClipboardCheck className="size-4" /> {examLabel}
          </Button>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-2 text-sm">
          <h4 className="font-black">Sobre a prova</h4>
          {league.selection_exam_date && <div className="flex items-center gap-2"><Calendar className="size-4" /> {new Date(league.selection_exam_date).toLocaleDateString("pt-BR")}</div>}
          {league.selection_exam_time && <div className="flex items-center gap-2"><Clock className="size-4" /> {String(league.selection_exam_time).slice(0,5)}</div>}
          {league.selection_exam_description && <p className="whitespace-pre-line">{league.selection_exam_description}</p>}
          <div className="text-xs text-muted-foreground pt-2 border-t">Vagas: {league.selection_total_seats}{quotas.length > 0 && <> · Cotas: {quotas.map((q:any) => `${q.seats}× ${q.semester}º`).join(", ")}</>}</div>
        </CardContent></Card>

        <ExamRunner league={league} open={runnerOpen} onClose={() => { setRunnerOpen(false); reloadExam(); }} />
      </DialogContent>
    </Dialog>
  );
}

