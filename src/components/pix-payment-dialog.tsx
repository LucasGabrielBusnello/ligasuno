import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export type PixPaymentData = {
  registration_id: string;
  payment_id?: string;
  amount?: number;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  expires_at?: string;
};

export function PixPaymentDialog({
  open,
  data,
  onClose,
  onPaid,
  checkStatus,
}: {
  open: boolean;
  data: PixPaymentData | null;
  onClose: () => void;
  onPaid: () => void;
  checkStatus: (registration_id: string) => Promise<{ status: string }>;
}) {
  const [status, setStatus] = useState<string>("pending");
  const [confirmed, setConfirmed] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    setConfirmed(false);
    setStatus("pending");
    if (!open || !data?.registration_id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await checkStatus(data.registration_id);
        if (cancelled) return;
        setStatus(r.status);
        if (r.status === "paid" || r.status === "approved") {
          setConfirmed(true);
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => onPaid(), 1200);
        }
      } catch {}
    };
    tick();
    timerRef.current = setInterval(tick, 3000);
    return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, data?.registration_id]);

  async function copy() {
    if (!data?.qr_code) return;
    try {
      await navigator.clipboard.writeText(data.qr_code);
      toast.success("Código Pix copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Pagamento via Pix</DialogTitle></DialogHeader>
        {!data ? (
          <p className="text-sm text-muted-foreground text-center py-6">Gerando código Pix...</p>
        ) : confirmed ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="size-16 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-black">Pagamento confirmado!</h3>
            <p className="text-sm text-muted-foreground">Inscrição liberada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {typeof data.amount === "number" && (
              <div className="text-center text-3xl font-black">R$ {data.amount.toFixed(2)}</div>
            )}
            {data.qr_code_base64 ? (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${data.qr_code_base64}`}
                  alt="QR Code Pix"
                  className="size-56 border rounded bg-white p-2"
                />
              </div>
            ) : (
              <div className="size-56 bg-muted rounded animate-pulse mx-auto" />
            )}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-muted-foreground">Pix copia e cola</label>
              <div className="flex gap-2">
                <Input readOnly value={data.qr_code ?? ""} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copy}><Copy className="size-4" /></Button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Aguardando confirmação do pagamento...
              <span className="text-[10px]">({status})</span>
            </div>
            {data.expires_at && (
              <p className="text-[11px] text-center text-muted-foreground">
                Expira em {new Date(data.expires_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
