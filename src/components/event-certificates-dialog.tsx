import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Award, Loader2 } from "lucide-react";
import {
  previewEventCertificates, sendEventCertificates,
  previewMinicourseCertificates, sendMinicourseCertificates,
} from "@/lib/event-certificates.functions";
import { saveSignature, getSignaturePreview } from "@/lib/certificates.functions";
import { SignaturePad } from "./signature-pad";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";

type Mode = { kind: "event"; event: any; leagueId: string } | { kind: "minicourse"; minicourse: any; leagueId: string };

type Row = {
  registration_id: string; user_id: string; full_name: string; cpf: string; email: string;
  hours: number; present_checkins?: number; checkin_count?: number; present?: boolean;
  _selected: boolean;
};

export function EventCertificatesDialog({ mode, open, onClose }: { mode: Mode | null; open: boolean; onClose: () => void }) {
  const prevEv = useServerFn(previewEventCertificates);
  const sendEv = useServerFn(sendEventCertificates);
  const prevMc = useServerFn(previewMinicourseCertificates);
  const sendMc = useServerFn(sendMinicourseCertificates);
  const saveSig = useServerFn(saveSignature);
  const getSig = useServerFn(getSignaturePreview);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const [presidentName, setPresidentName] = useState("");
  const [sigDirty, setSigDirty] = useState(false);

  async function reload() {
    if (!mode) return;
    setLoading(true);
    try {
      const sig: any = await getSig({ data: { league_id: mode.leagueId } } as any);
      setSignaturePng(sig?.png_base64 ?? null);
      setPresidentName(sig?.president_name ?? "");
      setSigDirty(false);
      if (mode.kind === "event") {
        const r: any = await prevEv({ data: { event_id: mode.event.id } } as any);
        setRows((r.members ?? []).map((m: any) => ({ ...m, _selected: m.hours > 0 })));
      } else {
        const r: any = await prevMc({ data: { minicourse_id: mode.minicourse.id } } as any);
        setRows((r.members ?? []).map((m: any) => ({ ...m, _selected: m.hours > 0 })));
      }
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (open && mode) reload(); /* eslint-disable-next-line */ }, [open, mode?.kind, mode?.kind === "event" ? mode?.event?.id : mode?.minicourse?.id]);

  function update(i: number, patch: Partial<Row>) { setRows((rs) => rs.map((r, k) => k === i ? { ...r, ...patch } : r)); }
  function selectAll(v: boolean) { setRows((rs) => rs.map((r) => ({ ...r, _selected: v }))); }

  async function saveSigClick() {
    if (!signaturePng || !mode) return toast.error("Adicione a assinatura");
    try {
      await saveSig({ data: { league_id: mode.leagueId, png_base64: signaturePng, president_name: presidentName || undefined } } as any);
      toast.success("Assinatura salva"); setSigDirty(false);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  async function send() {
    if (!mode) return;
    const selected = rows.filter((r) => r._selected);
    if (selected.length === 0) return toast.error("Selecione pelo menos um inscrito");
    for (const r of selected) {
      if (!r.full_name || r.full_name.length < 2) return toast.error(`Nome inválido: ${r.email}`);
      if (!isValidCPF(normalizeCpf(r.cpf))) return toast.error(`CPF inválido para ${r.full_name}`);
      if (r.hours <= 0) return toast.error(`Carga horária zero para ${r.full_name}`);
    }
    if (!signaturePng) {
      if (!confirm("Sem assinatura cadastrada. Continuar mesmo assim?")) return;
    } else if (sigDirty) {
      if (!confirm("Assinatura editada mas não salva. Continuar com a antiga?")) return;
    }
    setSending(true);
    try {
      const payload: any = {
        recipients: selected.map((r) => ({
          registration_id: r.registration_id, user_id: r.user_id,
          full_name: r.full_name, cpf: normalizeCpf(r.cpf), hours: Number(r.hours),
        })),
        president_name: presidentName || undefined,
      };
      const res: any = mode.kind === "event"
        ? await sendEv({ data: { ...payload, event_id: mode.event.id } } as any)
        : await sendMc({ data: { ...payload, minicourse_id: mode.minicourse.id } } as any);
      const sent = res?.sent ?? 0; const failed = res?.failed ?? 0;
      if (failed > 0) { toast.warning(`${sent} enviado(s), ${failed} falha(s)`); console.warn(res?.failures); }
      else toast.success(`${sent} certificado(s) enviado(s)`);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setSending(false); }
  }

  if (!mode) return null;
  const title = mode.kind === "event" ? `Certificados — ${mode.event.title}` : `Certificados — ${mode.minicourse.title}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Award className="size-5" /> {title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground"><Loader2 className="inline animate-spin size-4 mr-2" /> Carregando...</div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-bold">Assinatura do presidente</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do presidente</Label>
                  <Input value={presidentName} onChange={(e) => { setPresidentName(e.target.value); setSigDirty(true); }} />
                </div>
                <div className="sm:col-span-2">
                  <SignaturePad initialPng={signaturePng} onChange={(p) => { setSignaturePng(p); setSigDirty(true); }} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveSigClick} disabled={!sigDirty}>Salvar assinatura</Button>
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={rows.length > 0 && rows.every(r => r._selected)} onCheckedChange={(v) => selectAll(!!v)} />
                  Selecionar todos ({rows.filter(r => r._selected).length}/{rows.length})
                </label>
                <Badge variant="outline" className="text-[10px]">
                  {mode.kind === "event" ? `Total ${mode.event.total_hours || 0}h · ${mode.event.checkin_count || 1} credenciamento(s)` : `${mode.minicourse.total_hours || 0}h`}
                </Badge>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum inscrito pago.</div>}
                {rows.map((r, i) => (
                  <div key={r.registration_id} className="p-3 flex flex-wrap items-center gap-2">
                    <Checkbox checked={r._selected} onCheckedChange={(v) => update(i, { _selected: !!v })} />
                    <div className="min-w-[200px] flex-1">
                      <Input value={r.full_name} onChange={(e) => update(i, { full_name: e.target.value })} placeholder="Nome completo" className="h-8" />
                      <div className="text-[11px] text-muted-foreground mt-0.5">{r.email}</div>
                    </div>
                    <Input value={r.cpf} onChange={(e) => update(i, { cpf: e.target.value })} placeholder="CPF" className="h-8 w-32 font-mono text-xs" />
                    <div className="w-28">
                      <Input type="number" step="0.5" min="0" value={r.hours} onChange={(e) => update(i, { hours: Number(e.target.value) })} className="h-8" />
                    </div>
                    {mode.kind === "event" && (
                      <Badge variant="outline" className="text-[10px]">{r.present_checkins || 0}/{r.checkin_count || 1}</Badge>
                    )}
                    {mode.kind === "minicourse" && (
                      <Badge variant={r.present ? "default" : "secondary"} className="text-[10px]">{r.present ? "Presente" : "Ausente"}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={send} disabled={sending || loading}>
            {sending ? <><Loader2 className="size-4 mr-1 animate-spin" /> Enviando...</> : "Enviar Certificados via E-mail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
