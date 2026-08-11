import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Banknote, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  connectLeagueInfinitepay,
  disconnectLeagueInfinitepay,
  getLeaguePaymentConfig,
  setLeaguePaymentProvider,
} from "@/lib/league-payments.functions";

type ProviderKey = "mercadopago" | "infinitepay";

export function LeaguePaymentProviderCard({ leagueId }: { leagueId: string }) {
  const load = useServerFn(getLeaguePaymentConfig);
  const connectIpay = useServerFn(connectLeagueInfinitepay);
  const disconnectIpay = useServerFn(disconnectLeagueInfinitepay);
  const setProvider = useServerFn(setLeaguePaymentProvider);

  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState("");

  async function reload() {
    try {
      const r: any = await load({ data: { league_id: leagueId } });
      setCfg(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar configuração de recebimento");
    }
  }
  useEffect(() => { reload(); }, [leagueId]);

  async function saveIpay() {
    try {
      setBusy(true);
      await connectIpay({ data: { league_id: leagueId, handle: handle.trim() } });
      toast.success("InfinitePay conectada");
      setHandle("");
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao conectar"); }
    finally { setBusy(false); }
  }

  async function removeIpay() {
    if (!confirm("Desconectar a InfinitePay? A liga volta a receber pelo Mercado Pago.")) return;
    try { setBusy(true); await disconnectIpay({ data: { league_id: leagueId } }); await reload(); toast.success("Desconectado"); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(false); }
  }

  async function choose(provider: ProviderKey) {
    try {
      setBusy(true);
      await setProvider({ data: { league_id: leagueId, provider } });
      await reload();
      toast.success(`Recebendo via ${provider === "infinitepay" ? "InfinitePay" : "Mercado Pago"}`);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(false); }
  }

  const provider: ProviderKey = cfg?.provider === "infinitepay" ? "infinitepay" : "mercadopago";
  const ipayConnected = !!cfg?.infinitepay;

  return (
    <Card className="mb-6 border-emerald-500/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Banknote className="size-5" />
          Onde a liga recebe
          <Badge variant="secondary">
            {provider === "infinitepay" ? "InfinitePay" : "Mercado Pago"}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Escolha por onde os pagamentos de eventos, minicursos, processo seletivo e
          semestralidade são recebidos.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("mercadopago")}
            disabled={busy}
            className={`rounded-lg border p-4 text-left transition ${
              provider === "mercadopago" ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              Mercado Pago
              {provider === "mercadopago" && <CheckCircle2 className="size-4 text-emerald-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {cfg?.mp ? "Conta conectada." : "Nenhuma conta conectada ainda."}
            </p>
            <p className="text-xs text-emerald-600 mt-1">Confirmação automática do pagamento.</p>
          </button>

          <button
            type="button"
            onClick={() => choose("infinitepay")}
            disabled={busy || !ipayConnected}
            className={`rounded-lg border p-4 text-left transition disabled:opacity-60 ${
              provider === "infinitepay" ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              InfinitePay
              {provider === "infinitepay" && <CheckCircle2 className="size-4 text-emerald-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ipayConnected
                ? `Conectada: @${cfg.infinitepay.handle}`
                : "Conecte o handle da InfinitePay abaixo para liberar."}
            </p>
            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
              <AlertTriangle className="size-3" /> Sem confirmação automática.
            </p>
          </button>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <div className="font-semibold flex items-center gap-2 text-amber-600">
            <AlertTriangle className="size-4" /> Atenção sobre a InfinitePay
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            A InfinitePay <strong>não confirma o pagamento automaticamente</strong> no sistema.
            Depois que a pessoa paga pelo link, a presidência precisa conferir o recebimento no
            aplicativo da InfinitePay e marcar o pagamento como pago manualmente no painel.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-semibold text-sm">Conta InfinitePay da liga</div>
          {ipayConnected ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
              <div>
                <div>@{cfg.infinitepay.handle}</div>
                <div className="text-xs text-muted-foreground">
                  conectada em {new Date(cfg.infinitepay.connected_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <Button variant="destructive" onClick={removeIpay} disabled={busy}>Desconectar</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Informe o <strong>handle</strong> da conta InfinitePay da liga (o mesmo que aparece
                no link de pagamento, por exemplo <code>checkout.infinitepay.io/<strong>sua-liga</strong></code>).
                O dinheiro cai direto na conta InfinitePay da liga.
              </p>
              <Label className="text-xs">Handle da InfinitePay</Label>
              <Input
                autoComplete="off"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="sua-liga"
              />
              <Button onClick={saveIpay} disabled={busy || handle.trim().length < 2}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Conectar InfinitePay"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
