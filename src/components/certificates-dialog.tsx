import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Award, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { previewCertificates, sendSemesterCertificates, saveSignature, getSignaturePreview } from "@/lib/certificates.functions";
import { SignaturePad } from "./signature-pad";
import { isValidCPF, normalizeCpf } from "@/lib/cpf";
import { CertificateTemplateEditor } from "./certificate-template-editor";

type Recipient = {
  user_id: string;
  full_name: string;
  cpf: string;
  email: string;
  role: string;
  total_hours: number;
  activities: Array<{ activity: string; date: string; hours: number; status: string }>;
  _selected: boolean;
  _expanded: boolean;
};

export function CertificatesDialog({ league, open, onClose }: { league: any; open: boolean; onClose: () => void }) {
  const previewFn = useServerFn(previewCertificates);
  const sendFn = useServerFn(sendSemesterCertificates);
  const saveSigFn = useServerFn(saveSignature);
  const getSigFn = useServerFn(getSignaturePreview);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<Recipient[]>([]);
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const [presidentName, setPresidentName] = useState("");
  const [signatureDirty, setSignatureDirty] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        previewFn({ data: { league_id: league.id } }) as any,
        getSigFn({ data: { league_id: league.id } }) as any,
      ]);
      setRows((r.members ?? []).map((m: any) => ({ ...m, _selected: m.total_hours > 0, _expanded: false })));
      setSignaturePng(s?.png_base64 ?? null);
      setPresidentName(s?.president_name ?? "");
      setSignatureDirty(false);
    } catch (e: any) { toast.error(e?.message ?? "Falha ao carregar"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (open) reload(); /* eslint-disable-next-line */ }, [open]);

  function update(idx: number, patch: Partial<Recipient>) {
    setRows((rs) => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  async function saveSig() {
    if (!signaturePng) return toast.error("Adicione a assinatura antes de salvar");
    try {
      await saveSigFn({ data: { league_id: league.id, png_base64: signaturePng, president_name: presidentName || undefined } } as any);
      toast.success("Assinatura salva");
      setSignatureDirty(false);
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar assinatura"); }
  }

  async function send() {
    const selected = rows.filter((r) => r._selected);
    if (selected.length === 0) return toast.error("Selecione pelo menos um membro");
    for (const r of selected) {
      if (!r.full_name || r.full_name.length < 2) return toast.error(`Nome inválido: ${r.email}`);
      if (!isValidCPF(normalizeCpf(r.cpf))) return toast.error(`CPF inválido para ${r.full_name}`);
    }
    if (!signaturePng) {
      if (!confirm("Você não cadastrou uma assinatura. Os certificados serão enviados sem assinatura. Continuar?")) return;
    } else if (signatureDirty) {
      if (!confirm("Você editou a assinatura mas não salvou. Continuar mesmo assim com a assinatura antiga?")) return;
    }
    setSending(true);
    try {
      const res: any = await sendFn({ data: {
        league_id: league.id,
        recipients: selected.map((r) => ({ user_id: r.user_id, full_name: r.full_name, cpf: normalizeCpf(r.cpf) })),
        president_name: presidentName || undefined,
      } } as any);
      const sent = res?.sent ?? 0;
      const failed = res?.failed ?? 0;
      if (failed > 0) {
        toast.warning(`${sent} enviado(s), ${failed} falha(s)`);
        console.warn("Falhas no envio de certificados:", res?.failures);
      } else {
        toast.success(`${sent} certificado(s) enviado(s)`);
      }
    } catch (e: any) { toast.error(e?.message ?? "Falha no envio"); }
    finally { setSending(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Award className="size-5" /> Certificados do Semestre</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground"><Loader2 className="inline animate-spin size-4 mr-2" /> Carregando...</div>
        ) : (
          <div className="space-y-6">
            {/* Assinatura */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-bold">Assinatura do presidente</h3>
              <p className="text-xs text-muted-foreground">A assinatura aparece estampada em todos os certificados gerados. Desenhe com mouse/touch ou envie um PNG (preferencialmente com fundo transparente).</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do presidente (como aparece no certificado)</Label>
                  <Input value={presidentName} onChange={(e) => { setPresidentName(e.target.value); setSignatureDirty(true); }} placeholder="Ex: Dr. João da Silva" />
                </div>
                <div className="sm:col-span-2">
                  <SignaturePad initialPng={signaturePng} onChange={(p) => { setSignaturePng(p); setSignatureDirty(true); }} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveSig} disabled={!signatureDirty}>Salvar assinatura</Button>
              </div>
            </div>

            <CertificateTemplateEditor leagueId={league.id} />

            {/* Tabela de membros */}
            <div className="rounded-lg border overflow-hidden">
              <div className="p-3 bg-muted/40 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold">Membros e horas do semestre</div>
                  <div className="text-xs text-muted-foreground">Edite nome/CPF se o ligante digitou errado — as alterações vão para o certificado.</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, _selected: true })))}>Selecionar todos</Button>
                  <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, _selected: false })))}>Limpar</Button>
                </div>
              </div>
              <div className="divide-y">
                {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum membro encontrado.</div>}
                {rows.map((r, i) => (
                  <div key={r.user_id} className="p-3 space-y-2">
                    <div className="flex items-start gap-3 flex-wrap">
                      <Checkbox checked={r._selected} onCheckedChange={(v) => update(i, { _selected: !!v })} className="mt-2" />
                      <div className="flex-1 min-w-[180px]">
                        <Label className="text-[10px] uppercase">Nome (certificado)</Label>
                        <Input value={r.full_name} onChange={(e) => update(i, { full_name: e.target.value })} />
                      </div>
                      <div className="w-[160px]">
                        <Label className="text-[10px] uppercase">CPF</Label>
                        <Input value={r.cpf} onChange={(e) => update(i, { cpf: e.target.value.replace(/[^\d.-]/g, "") })} />
                      </div>
                      <div className="min-w-[140px]">
                        <Label className="text-[10px] uppercase">E-mail</Label>
                        <div className="text-xs py-2">{r.email || <span className="text-muted-foreground">—</span>}</div>
                      </div>
                      <div className="text-right">
                        <Label className="text-[10px] uppercase">Horas</Label>
                        <div className="text-lg font-black">{r.total_hours.toFixed(1).replace(".", ",")}h</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => update(i, { _expanded: !r._expanded })}>
                        {r._expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-8">
                      <Badge variant="secondary" className="text-[10px]">{r.role}</Badge>
                    </div>
                    {r._expanded && (
                      <div className="pl-8 pt-2">
                        {r.activities.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem registros de frequência.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground"><tr><th className="text-left py-1">Atividade</th><th className="text-left">Data</th><th className="text-right">Horas</th><th className="text-right">Status</th></tr></thead>
                            <tbody>
                              {r.activities.map((a, k) => (
                                <tr key={k} className="border-t">
                                  <td className="py-1">{a.activity}</td>
                                  <td>{new Date(a.date).toLocaleDateString("pt-BR")}</td>
                                  <td className="text-right">{a.hours.toFixed(1).replace(".", ",")}</td>
                                  <td className="text-right">
                                    {a.status === "presente" && <span className="text-green-600 font-bold">Presente</span>}
                                    {a.status === "justificada" && <span className="text-amber-600 font-bold">Justificada</span>}
                                    {a.status === "ausente" && <span className="text-red-500">Ausente</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Fechar</Button>
          <Button onClick={send} disabled={sending || loading}>
            {sending && <Loader2 className="size-4 animate-spin" />}
            Enviar Certificados via e-mail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
