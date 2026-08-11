import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  connectLeagueAsaas,
  disconnectLeagueAsaas,
  getLeaguePaymentConfig,
  setLeaguePaymentProvider,
} from "@/lib/asaas.functions";
import { connectLeagueEfi, disconnectLeagueEfi } from "@/lib/efi.functions";
import {
  ASAAS_REFERENCE_FEES,
  EFI_REFERENCE_FEES,
  METHOD_LABEL,
  PROVIDER_LABEL,
  brl,
  compareProviders,
  type PayMethod,
  type ProviderFeeTable,
  type ProviderKey,
} from "@/lib/payment-fees";

const CATEGORIES = [
  { value: "event", label: "Inscrição em evento" },
  { value: "minicourse", label: "Minicurso" },
  { value: "selection", label: "Processo seletivo" },
  { value: "semester", label: "Semestralidade" },
] as const;

export function LeaguePaymentProviderCard({ leagueId }: { leagueId: string }) {
  const load = useServerFn(getLeaguePaymentConfig);
  const connectAsaas = useServerFn(connectLeagueAsaas);
  const disconnectAsaas = useServerFn(disconnectLeagueAsaas);
  const connectEfi = useServerFn(connectLeagueEfi);
  const disconnectEfi = useServerFn(disconnectLeagueEfi);
  const setProvider = useServerFn(setLeaguePaymentProvider);

  const [cfg, setCfg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [efiId, setEfiId] = useState("");
  const [efiSecret, setEfiSecret] = useState("");
  const [efiSandbox, setEfiSandbox] = useState(false);
  const [amount, setAmount] = useState(50);
  const [category, setCategory] = useState<string>("event");

  async function reload() {
    try {
      const r: any = await load({ data: { league_id: leagueId } });
      setCfg(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar configuração de recebimento");
    }
  }
  useEffect(() => { reload(); }, [leagueId]);

  const asaasTable: ProviderFeeTable = cfg?.asaasFees ?? ASAAS_REFERENCE_FEES;
  const platform = cfg?.platformFees?.[category] ?? { pct: 0, fixed: 0 };

  const comparison = useMemo(
    () => compareProviders(Number(amount) || 0, platform, asaasTable, EFI_REFERENCE_FEES),
    [amount, platform, asaasTable],
  );

  async function saveAsaas() {
    try {
      setBusy(true);
      const r: any = await connectAsaas({ data: { league_id: leagueId, api_key: apiKey.trim() } });
      toast.success(`Asaas conectado${r?.account_name ? ` (${r.account_name})` : ""}`);
      setApiKey("");
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao conectar"); }
    finally { setBusy(false); }
  }

  async function removeAsaas() {
    if (!confirm("Desconectar o Asaas? A liga volta a receber pelo Mercado Pago.")) return;
    try { setBusy(true); await disconnectAsaas({ data: { league_id: leagueId } }); await reload(); toast.success("Desconectado"); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(false); }
  }

  async function saveEfi() {
    try {
      setBusy(true);
      await connectEfi({
        data: {
          league_id: leagueId,
          client_id: efiId.trim(),
          client_secret: efiSecret.trim(),
          sandbox: efiSandbox,
        },
      });
      toast.success("Efí conectada");
      setEfiId(""); setEfiSecret("");
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao conectar a Efí"); }
    finally { setBusy(false); }
  }

  async function removeEfi() {
    if (!confirm("Desconectar a Efí?")) return;
    try { setBusy(true); await disconnectEfi({ data: { league_id: leagueId } }); await reload(); toast.success("Desconectado"); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(false); }
  }

  async function choose(provider: ProviderKey) {
    try {
      setBusy(true);
      await setProvider({ data: { league_id: leagueId, provider } });
      await reload();
      toast.success(`Recebendo via ${PROVIDER_LABEL[provider]}`);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(false); }
  }

  const provider: ProviderKey = cfg?.provider ?? "mercadopago";
  const asaasConnected = !!cfg?.asaas;
  const efiConnected = !!cfg?.efi;
  const methods: PayMethod[] = ["pix", "debit", "credit"];
  const providers: ProviderKey[] = ["mercadopago", "asaas", "efi"];

  return (
    <Card className="mb-6 border-emerald-500/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Banknote className="size-5" />
          Onde a liga recebe
          <Badge variant="secondary">
            {provider === "asaas"
              ? "Asaas (qualquer banco)"
              : provider === "efi"
                ? "Efí (qualquer banco)"
                : "Mercado Pago"}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Escolha por onde os pagamentos de eventos, minicursos, processo seletivo e semestralidade
          são recebidos. Com o <strong>Asaas</strong> ou a <strong>Efí</strong> o dinheiro pode ser
          sacado para a conta da liga em <strong>qualquer banco</strong> (Nubank, Caixa, Santander…),
          aceitando Pix, cartão e boleto.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Escolha do provedor */}
        <div className="grid gap-3 sm:grid-cols-3">
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
          </button>

          <button
            type="button"
            onClick={() => choose("asaas")}
            disabled={busy || !asaasConnected}
            className={`rounded-lg border p-4 text-left transition disabled:opacity-60 ${
              provider === "asaas" ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              Asaas — outros bancos
              {provider === "asaas" && <CheckCircle2 className="size-4 text-emerald-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {asaasConnected
                ? `Conectado${cfg?.asaas?.account_name ? `: ${cfg.asaas.account_name}` : ""}${cfg?.asaas?.sandbox ? " (ambiente de testes)" : ""}`
                : "Conecte a conta Asaas abaixo para liberar."}
            </p>
          </button>

          <button
            type="button"
            onClick={() => choose("efi")}
            disabled={busy || !efiConnected}
            className={`rounded-lg border p-4 text-left transition disabled:opacity-60 ${
              provider === "efi" ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              Efí — outros bancos
              {provider === "efi" && <CheckCircle2 className="size-4 text-emerald-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {efiConnected
                ? `Conectada${cfg?.efi?.sandbox ? " (ambiente de testes)" : ""}`
                : "Conecte a conta Efí abaixo para liberar."}
            </p>
          </button>
        </div>

        {/* Conexão Asaas */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-semibold text-sm">Conta Asaas da liga</div>
          {asaasConnected ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
              <div>
                <div>{cfg.asaas.account_name ?? "Conta conectada"}</div>
                <div className="text-xs text-muted-foreground">
                  {cfg.asaas.account_email} · conectada em{" "}
                  {new Date(cfg.asaas.connected_at).toLocaleDateString("pt-BR")}
                </div>
                {cfg.asaasError && (
                  <div className="text-xs text-amber-500 mt-1">{cfg.asaasError}</div>
                )}
              </div>
              <Button variant="destructive" onClick={removeAsaas} disabled={busy}>Desconectar</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Crie a conta gratuita em <strong>asaas.com</strong>, cadastre a conta bancária da liga
                (qualquer banco) e cole aqui a <strong>Chave de API</strong>
                (Asaas → Configurações → Integrações → Chave de API).
              </p>
              <Label className="text-xs">Chave de API do Asaas</Label>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="$aact_..."
              />
              <Button onClick={saveAsaas} disabled={busy || apiKey.trim().length < 20}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Conectar Asaas"}
              </Button>
            </div>
          )}
        </div>

        {/* Conexão Efí */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-semibold text-sm">Conta Efí (Gerencianet) da liga</div>
          {efiConnected ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
              <div>
                <div>{cfg.efi.account_name ?? "Conta conectada"}</div>
                <div className="text-xs text-muted-foreground">
                  conectada em {new Date(cfg.efi.connected_at).toLocaleDateString("pt-BR")}
                  {cfg.efi.sandbox ? " · ambiente de testes" : ""}
                </div>
              </div>
              <Button variant="destructive" onClick={removeEfi} disabled={busy}>Desconectar</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Crie a conta gratuita em <strong>sejaefi.com.br</strong> (não é preciso abrir conta em
                outro banco — o saldo é sacado para a conta atual da liga). Depois vá em
                <strong> Efí → API → Minhas aplicações</strong>, crie uma aplicação com a
                <strong> API de Cobranças</strong> e cole abaixo o <strong>Client ID</strong> e o
                <strong> Client Secret</strong>.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Client ID</Label>
                  <Input
                    autoComplete="off"
                    value={efiId}
                    onChange={(e) => setEfiId(e.target.value)}
                    placeholder="Client_Id_..."
                  />
                </div>
                <div>
                  <Label className="text-xs">Client Secret</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    value={efiSecret}
                    onChange={(e) => setEfiSecret(e.target.value)}
                    placeholder="Client_Secret_..."
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={efiSandbox} onCheckedChange={setEfiSandbox} id="efi-sandbox" />
                <Label htmlFor="efi-sandbox" className="text-xs">
                  Usar ambiente de testes (homologação)
                </Label>
              </div>
              <Button
                onClick={saveEfi}
                disabled={busy || efiId.trim().length < 10 || efiSecret.trim().length < 10}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Conectar Efí"}
              </Button>
            </div>
          )}
        </div>

        {/* Comparativo de taxas */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Info className="size-4" /> Comparativo de taxa total
          </div>
          <p className="text-xs text-muted-foreground">
            Taxa total = taxa do meio de pagamento + taxa da plataforma cobrada nesta categoria
            ({(platform.pct ?? 0)}% + {brl(platform.fixed ?? 0)}).
            {cfg?.asaasFees
              ? " As taxas do Asaas abaixo são as reais da conta conectada."
              : " As taxas do Asaas são valores de referência até conectar a conta."}
            {" "}As taxas da Efí são valores de referência do plano gratuito.
          </p>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Valor da cobrança</Label>
              <Input
                type="number" min={1} step="0.01" className="w-36"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2">Método</th>
                  {providers.map((p) => (
                    <th key={p} className="py-2">{PROVIDER_LABEL[p]} (total)</th>
                  ))}
                  <th className="py-2">Melhor</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => {
                  const row = comparison[m];
                  const best = providers.reduce<ProviderKey>(
                    (acc, p) => (row[p].totalFee < row[acc].totalFee ? p : acc),
                    "mercadopago",
                  );
                  return (
                    <tr key={m} className="border-t">
                      <td className="py-2 font-medium">{METHOD_LABEL[m]}</td>
                      {providers.map((p) => (
                        <td key={p} className="py-2">
                          {brl(row[p].totalFee)}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({row[p].totalPercent}%) · líquido {brl(row[p].net)}
                          </span>
                        </td>
                      ))}
                      <td className="py-2">
                        <Badge className="bg-emerald-600">{PROVIDER_LABEL[best]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Taxas do Mercado Pago e da Efí são as públicas de recebimento imediato e podem variar
            conforme a conta e o plano contratado.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
