import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Save, Trash2, Plus, Coins, Cpu, DollarSign, TrendingUp } from "lucide-react";
import {
  adminSimFinance,
  adminSimStudents,
  adminGetSimFinanceSettings,
  adminSaveSimFinanceSettings,
  adminSaveCreditPackage,
  adminDeleteCreditPackage,
  adminGrantCredits,
  adminSearchSimUsers,
} from "@/lib/sim-credits.functions";

type Period = "month" | "quarter" | "year" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "Último mês" },
  { key: "quarter", label: "3 meses" },
  { key: "year", label: "Último ano" },
  { key: "all", label: "Tudo" },
];
const brl = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SimFinanceAdmin() {
  const [period, setPeriod] = useState<Period>("month");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button key={p.key} size="sm" variant={period === p.key ? "default" : "outline"} onClick={() => setPeriod(p.key)}>
            {p.label}
          </Button>
        ))}
      </div>
      <Tabs defaultValue="financeiro">
        <TabsList className="w-full overflow-x-auto flex justify-start">
          <TabsTrigger value="financeiro" className="whitespace-nowrap">Log financeiro</TabsTrigger>
          <TabsTrigger value="alunos" className="whitespace-nowrap">Evolução dos alunos</TabsTrigger>
          <TabsTrigger value="config" className="whitespace-nowrap">Configurações e pacotes</TabsTrigger>
        </TabsList>
        <TabsContent value="financeiro" className="mt-4"><FinanceLog period={period} /></TabsContent>
        <TabsContent value="alunos" className="mt-4"><StudentsTable period={period} /></TabsContent>
        <TabsContent value="config" className="mt-4"><FinanceSettings /></TabsContent>
      </Tabs>
    </div>
  );
}

function FinanceLog({ period }: { period: Period }) {
  const load = useServerFn(adminSimFinance);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    load({ data: { period } }).then(setData).catch((e: any) => toast.error(e?.message)).finally(() => setLoading(false));
  }, [load, period]);

  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline mr-2" />Carregando…</div>;
  const k = data?.kpis ?? {};

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Lucro (créditos pagos usados)" value={brl(k.totalProfit)} icon={<TrendingUp className="size-5" />} tone="green" />
        <Kpi label="Tokens processados" value={Number(k.totalTokens || 0).toLocaleString("pt-BR")} icon={<Cpu className="size-5" />} tone="blue" />
        <Kpi label="Custo total de API" value={brl(k.totalCost)} icon={<DollarSign className="size-5" />} tone="red" />
        <Kpi label="Créditos consumidos" value={Number(k.totalCredits || 0).toLocaleString("pt-BR")} icon={<Coins className="size-5" />} tone="amber" />
      </div>
      <p className="text-xs text-muted-foreground">
        Receita de pacotes pagos no período: <b className="text-muted-foreground">{brl(k.revenue)}</b> · {k.cases} casos · {Number(k.totalPaidCredits || 0).toLocaleString("pt-BR")} créditos pagos consumidos ·
        preço = custo ÷ {data?.settings?.divisor} (taxa gateway {data?.settings?.feePct}%)
      </p>
      <p className="text-xs text-muted-foreground">
        Tokens de entrada: <b className="text-foreground">{Number(k.totalTokensIn || 0).toLocaleString("pt-BR")}</b> ·
        tokens de saída: <b className="text-foreground">{Number(k.totalTokensOut || 0).toLocaleString("pt-BR")}</b>
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr>
              {["Caso", "Aluno", "Tokens (entrada/saída)", "Custo API", "Debitado", "Lucro líquido", "Avaliação"].map((h) => (
                <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">{r.area} · {r.level}º ano · {new Date(r.created_at).toLocaleDateString("pt-BR")}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.student}</td>
                <td className="px-3 py-2 tabular-nums">
                  <div className="font-medium text-foreground">{r.tokens.toLocaleString("pt-BR")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    ↓ {Number(r.tokens_in || 0).toLocaleString("pt-BR")} entrada · ↑ {Number(r.tokens_out || 0).toLocaleString("pt-BR")} saída
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-rose-400">{brl(r.cost)}</td>
                <td className="px-3 py-2 tabular-nums">{r.credits} cr · {brl(r.charged)}</td>
                <td className={`px-3 py-2 tabular-nums font-semibold ${r.profit >= 0 ? "text-primary" : "text-rose-400"}`}>{brl(r.profit)}</td>
                <td className="px-3 py-2">
                  {r.status === "finished"
                    ? <Badge className={r.score >= 70 ? "bg-primary text-primary-foreground" : r.score >= 50 ? "bg-amber-600" : "bg-rose-600"}>{r.score}/100</Badge>
                    : <Badge variant="outline" className="border-border text-muted-foreground">em andamento</Badge>}
                </td>
              </tr>
            ))}
            {!data?.rows?.length && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum caso no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GrantCreditsBox({ onDone }: { onDone: () => void }) {
  const search = useServerFn(adminSearchSimUsers);
  const grant = useServerFn(adminGrantCredits);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const run = useCallback(async () => {
    setBusy(true);
    try { setRows((await search({ data: { query: q } })) as any[]); }
    catch (e: any) { toast.error(e?.message); }
    finally { setBusy(false); }
  }, [search, q]);
  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function give(userId: string) {
    const n = Number((amounts[userId] ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n === 0) return toast.error("Informe a quantidade de créditos.");
    try {
      await grant({ data: { userId, credits: n, note: "Créditos concedidos pelo admin (cortesia)" } });
      toast.success("Saldo atualizado. Cortesias não entram como receita.");
      setAmounts({ ...amounts, [userId]: "" });
      run();
      onDone();
    } catch (e: any) { toast.error(e?.message); }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="text-sm font-bold text-foreground">Adicionar créditos manualmente</div>
          <p className="text-xs text-muted-foreground">Cortesias não contam como dinheiro recebido nem geram lucro quando usadas.</p>
        </div>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Buscar por nome, e-mail ou usuário" />
          <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}</Button>
        </div>
        <div className="space-y-2">
          {rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
              <div className="min-w-40 flex-1">
                <div className="text-sm text-foreground">{u.name}</div>
                <div className="text-[11px] text-muted-foreground">{u.email} · saldo {Number(u.credits).toFixed(2)} cr</div>
              </div>
              <Input
                className="w-28" inputMode="decimal" placeholder="créditos"
                value={amounts[u.id] ?? ""}
                onChange={(e) => setAmounts({ ...amounts, [u.id]: e.target.value })}
              />
              <Button size="sm" onClick={() => give(u.id)}><Plus className="size-4 mr-1" /> Conceder</Button>
            </div>
          ))}
          {!rows.length && !busy && <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function StudentsTable({ period }: { period: Period }) {
  const load = useServerFn(adminSimStudents);
  const grant = useServerFn(adminGrantCredits);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    load({ data: { period } }).then((r: any) => setRows(r ?? [])).catch((e: any) => toast.error(e?.message)).finally(() => setLoading(false));
  }, [load, period]);
  useEffect(() => { refresh(); }, [refresh]);

  async function addCredits(userId: string) {
    const v = window.prompt("Quantos créditos adicionar? (use negativo para remover)");
    if (!v) return;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) return toast.error("Valor inválido.");
    try {
      await grant({ data: { userId, credits: n, note: "Ajuste manual do admin" } });
      toast.success("Saldo atualizado.");
      refresh();
    } catch (e: any) { toast.error(e?.message); }
  }

  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline mr-2" />Carregando…</div>;

  return (
    <div className="space-y-4">
    <GrantCreditsBox onDone={refresh} />
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card text-muted-foreground">
          <tr>
            {["Aluno", "Estações", "Resolvidos", "Não resolvidos", "Média", "Créditos", ""].map((h) => (
              <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-2">
                <div className="text-foreground">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">{r.email}</div>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.total}</td>
              <td className="px-3 py-2 tabular-nums text-primary">{r.solved}</td>
              <td className="px-3 py-2 tabular-nums text-rose-400">{r.unsolved}</td>
              <td className="px-3 py-2 tabular-nums font-semibold">{r.average}</td>
              <td className="px-3 py-2 tabular-nums">{Number(r.credits).toFixed(2)}</td>
              <td className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => addCredits(r.id)}>Ajustar</Button></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum aluno no período.</td></tr>}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function FinanceSettings() {
  const load = useServerFn(adminGetSimFinanceSettings);
  const save = useServerFn(adminSaveSimFinanceSettings);
  const savePkg = useServerFn(adminSaveCreditPackage);
  const delPkg = useServerFn(adminDeleteCreditPackage);

  const [form, setForm] = useState<any>(null);
  const [keys, setKeys] = useState<any>({});
  const [secrets, setSecrets] = useState({ mp_access_token: "", openai_key: "", anthropic_key: "" });
  const [packages, setPackages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    load({} as any).then((r: any) => {
      setForm(r.settings);
      setKeys(r.keys);
      setPackages(r.packages ?? []);
    }).catch((e: any) => toast.error(e?.message));
  }, [load]);
  useEffect(() => { refresh(); }, [refresh]);

  if (!form) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline mr-2" />Carregando…</div>;

  const num = (k: string) => (e: any) => setForm({ ...form, [k]: Number(e.target.value) });

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { ...form, ...secrets } });
      setSecrets({ mp_access_token: "", openai_key: "", anthropic_key: "" });
      toast.success("Configurações salvas.");
      refresh();
    } catch (e: any) { toast.error(e?.message); } finally { setSaving(false); }
  }

  const suggested = (credits: number) => {
    // custo estimado de 1 crédito no modelo de conversa (60% entrada / 40% saída)
    const perCredit =
      (form.tokens_per_credit / 1_000_000) *
      (0.6 * form.chat_cost_in_brl_per_mtok + 0.4 * form.chat_cost_out_brl_per_mtok);
    return (perCredit * credits) / (form.price_divisor || 0.47);
  };

  return (
    <div className="space-y-5">
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-bold text-foreground">Roteamento de modelos</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Modelo do chat (paciente — rápido/barato)">
              <Input value={form.chat_model} onChange={(e) => setForm({ ...form, chat_model: e.target.value })} />
            </Field>
            <Field label="Modelo da correção (preceptor — alto raciocínio)">
              <Input value={form.grade_model} onChange={(e) => setForm({ ...form, grade_model: e.target.value })} />
            </Field>
            <Field label="Custo chat entrada (R$/1M tokens)"><Input type="number" step="0.01" value={form.chat_cost_in_brl_per_mtok} onChange={num("chat_cost_in_brl_per_mtok")} /></Field>
            <Field label="Custo chat saída (R$/1M tokens)"><Input type="number" step="0.01" value={form.chat_cost_out_brl_per_mtok} onChange={num("chat_cost_out_brl_per_mtok")} /></Field>
            <Field label="Custo correção entrada (R$/1M tokens)"><Input type="number" step="0.01" value={form.grade_cost_in_brl_per_mtok} onChange={num("grade_cost_in_brl_per_mtok")} /></Field>
            <Field label="Custo correção saída (R$/1M tokens)"><Input type="number" step="0.01" value={form.grade_cost_out_brl_per_mtok} onChange={num("grade_cost_out_brl_per_mtok")} /></Field>
          </div>

          <h3 className="font-bold text-foreground pt-2">Economia de créditos</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Tokens por crédito"><Input type="number" value={form.tokens_per_credit} onChange={num("tokens_per_credit")} /></Field>
            <Field label="Taxa do gateway (%)"><Input type="number" step="0.1" value={form.gateway_fee_pct} onChange={num("gateway_fee_pct")} /></Field>
            <Field label="Divisor de preço (0,47 = 50% lucro + 3%)"><Input type="number" step="0.01" value={form.price_divisor} onChange={num("price_divisor")} /></Field>
            <Field label="Créditos grátis de boas-vindas"><Input type="number" value={form.free_credits} onChange={num("free_credits")} /></Field>
          </div>

          <h3 className="font-bold text-foreground pt-2">Chaves</h3>
          <p className="text-xs text-muted-foreground">
            As chamadas de IA já rodam pelo gateway da plataforma (sem chave sua). Os campos abaixo guardam chaves próprias
            criptografadas para uso futuro. Deixe em branco para manter a chave atual.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={`Mercado Pago (checkout) ${keys.mercadopago ? "· salva" : ""}`}>
              <Input type="password" placeholder="APP_USR-…" value={secrets.mp_access_token} onChange={(e) => setSecrets({ ...secrets, mp_access_token: e.target.value })} />
            </Field>
            <Field label={`OpenAI ${keys.openai ? "· salva" : ""}`}>
              <Input type="password" placeholder="sk-…" value={secrets.openai_key} onChange={(e) => setSecrets({ ...secrets, openai_key: e.target.value })} />
            </Field>
            <Field label={`Anthropic ${keys.anthropic ? "· salva" : ""}`}>
              <Input type="password" placeholder="sk-ant-…" value={secrets.anthropic_key} onChange={(e) => setSecrets({ ...secrets, anthropic_key: e.target.value })} />
            </Field>
          </div>

          <Button onClick={submit} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />} Salvar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">Pacotes de créditos</h3>
            <Button size="sm" variant="outline" onClick={() => setPackages([...packages, { id: null, name: "Novo pacote", credits: 100, price_brl: 19.9, active: true, sort: packages.length + 1 }])}>
              <Plus className="size-4 mr-1" /> Novo
            </Button>
          </div>
          {packages.map((p, i) => (
            <div key={p.id ?? `new-${i}`} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto] items-end border-t border-border pt-3">
              <Field label="Nome"><Input value={p.name} onChange={(e) => setPackages(packages.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></Field>
              <Field label="Créditos"><Input type="number" value={p.credits} onChange={(e) => setPackages(packages.map((x, j) => j === i ? { ...x, credits: Number(e.target.value) } : x))} /></Field>
              <Field label={`Preço (sugerido ${brl(suggested(Number(p.credits)))})`}>
                <Input type="number" step="0.01" value={p.price_brl} onChange={(e) => setPackages(packages.map((x, j) => j === i ? { ...x, price_brl: Number(e.target.value) } : x))} />
              </Field>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await savePkg({ data: { id: p.id ?? null, name: p.name, credits: Number(p.credits), price_brl: Number(p.price_brl), active: !!p.active, sort: Number(p.sort ?? i) } });
                    toast.success("Pacote salvo."); refresh();
                  } catch (e: any) { toast.error(e?.message); }
                }}
              >
                <Save className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!p.id) return setPackages(packages.filter((_, j) => j !== i));
                  try { await delPkg({ data: { id: p.id } }); toast.success("Pacote removido."); refresh(); }
                  catch (e: any) { toast.error(e?.message); }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "green" | "blue" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    green: "text-primary bg-primary/10 ring-primary/25",
    blue: "text-sky-400 bg-sky-500/10 ring-sky-500/30",
    red: "text-rose-400 bg-rose-500/10 ring-rose-500/30",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
  };
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`size-10 rounded-xl flex items-center justify-center ring-1 ${tones[tone]}`}>{icon}</div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-black text-foreground leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
