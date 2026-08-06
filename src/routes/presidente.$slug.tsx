import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type League } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Calendar, Settings, Users, Bell, DollarSign, BookOpen, Newspaper, HelpCircle, Image as ImageIcon, CheckCircle2, ClipboardCheck, Award, Download, FileSpreadsheet, QrCode, Copy, KeyRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { LeagueScoringTab } from "@/components/league-scoring-tab";
import { CertificatesDialog } from "@/components/certificates-dialog";
import { CheckinDialog } from "@/components/event-checkin-dialog";
import { EventCertificatesDialog } from "@/components/event-certificates-dialog";
import { ImageUpload } from "@/components/image-upload";
import { deleteStorageFiles } from "@/lib/storage-delete.functions";
import { generateBadgesPdf } from "@/lib/badge-pdf";
import { getCollectorFees } from "@/lib/mp-fees";
import { syncEventToSheet, getSheetConfig, saveSheetConfig } from "@/lib/sheets-sync.functions";
import { listEventCheckinRoster } from "@/lib/event-checkin.functions";

import { disconnectMp, connectMpManual } from "@/lib/mp-oauth.functions";
import {
  createLeagueSubscriptionCheckout,
  createLeagueSemesterPixCheckout,
  cancelLeagueSubscription,
} from "@/lib/subscription.functions";
import { SelectionManagerDialog } from "@/components/selection-manager";
import { SemesterDialog, StatusBadge as SemesterStatusBadge } from "@/components/semester-dialog";
import { LiganteSemestralidadeCard } from "@/components/ligante-semestralidade-card";
import { listCyclePayments } from "@/lib/semester.functions";
import { listLeagueLeaveRequests, processLeaveRequest } from "@/lib/leave-request.functions";
import { LeagueQuizManager } from "@/components/league-quiz-manager";

export const Route = createFileRoute("/presidente/$slug")({ component: PresidentePage });

const ABOUT_KEYS = [
  { key: "ensino", label: "Ensino", placeholder: "Aulas, discussões clínicas e estudos dirigidos." },
  { key: "pesquisa", label: "Pesquisa", placeholder: "Projetos científicos e publicações." },
  { key: "extensao", label: "Extensão", placeholder: "Eventos, ações comunitárias e simpósios." },
];

function PresidentePage() {
  const { slug } = Route.useParams();
  const { user, isAdminMaster, loading } = useAuth();
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
      setLeague(data as League | null);
      const { data: s } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      setSettings(s);
    })();
  }, [slug]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user]);

  if (!league || !user) return <div className="p-12 text-center">Carregando...</div>;
  const isOwner = league.president_id === user.id || (league as any).president2_id === user.id || isAdminMaster;
  if (!isOwner) return <div className="p-12 text-center"><h1 className="text-2xl font-black">Acesso negado</h1></div>;


  const paid = !!(league.paid_until && new Date(league.paid_until) >= new Date());
  const paidUntilFmt = league.paid_until ? new Date(league.paid_until).toLocaleDateString("pt-BR") : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/$slug" params={{ slug }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {league.name}</Link>
          <Badge>Presidente</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do Presidente</h1>
        <p className="text-muted-foreground mb-6">{league.name}</p>


        {paid ? (
          <ActiveSubscriptionCard leagueId={league.id} paidUntilFmt={paidUntilFmt} settings={settings} />
        ) : (
          <PayAnuidadeCard leagueId={league.id} settings={settings} />
        )}

        <MpConnectCard leagueId={league.id} />

        <div className="mt-4">
          <LiganteSemestralidadeCard leagueId={league.id} />
        </div>

        <Tabs defaultValue="config">
          <div className="w-full overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
            <TabsList className="inline-flex md:grid md:grid-cols-8 w-max md:w-full h-auto gap-1">
              <TabsTrigger value="config" className="whitespace-nowrap"><Settings className="size-4 mr-1" />Config</TabsTrigger>
              <TabsTrigger value="about" className="whitespace-nowrap"><BookOpen className="size-4 mr-1" />Sobre</TabsTrigger>
              <TabsTrigger value="eventos" className="whitespace-nowrap"><Calendar className="size-4 mr-1" />Eventos</TabsTrigger>
              <TabsTrigger value="news" className="whitespace-nowrap"><Newspaper className="size-4 mr-1" />Notícias</TabsTrigger>
              <TabsTrigger value="quiz" className="whitespace-nowrap"><HelpCircle className="size-4 mr-1" />Quizzes</TabsTrigger>
              <TabsTrigger value="scoring" className="whitespace-nowrap"><Award className="size-4 mr-1" />Pontuação</TabsTrigger>
              <TabsTrigger value="atividades" className="whitespace-nowrap"><ImageIcon className="size-4 mr-1" />Atividades</TabsTrigger>
              <TabsTrigger value="membros" className="whitespace-nowrap"><Users className="size-4 mr-1" />Membros</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="config" className="mt-6"><ConfigTab league={league} setLeague={setLeague} paid={paid} /></TabsContent>
          <TabsContent value="about" className="mt-6"><AboutTab league={league} /></TabsContent>
          <TabsContent value="eventos" className="mt-6"><EventsTab league={league} /></TabsContent>
          <TabsContent value="news" className="mt-6"><NewsTab league={league} /></TabsContent>
          <TabsContent value="quiz" className="mt-6"><LeagueQuizManager league={league} /></TabsContent>
          <TabsContent value="scoring" className="mt-6"><LeagueScoringTab league={league} /></TabsContent>
          <TabsContent value="atividades" className="mt-6"><ActivitiesTab league={league} /></TabsContent>
          <TabsContent value="membros" className="mt-6"><MembersTab league={league} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ActiveSubscriptionCard({ leagueId, paidUntilFmt, settings }: { leagueId: string; paidUntilFmt: string | null; settings: any }) {
  const cancelFn = useServerFn(cancelLeagueSubscription);
  const [loading, setLoading] = useState(false);
  async function doCancel() {
    if (!confirm("Cancelar a assinatura mensal? A liga permanece ativa até a data atual de validade. Pagamentos PIX semestrais não são afetados.")) return;
    try {
      setLoading(true);
      await cancelFn({ data: { league_id: leagueId } } as any);
      toast.success("Assinatura mensal cancelada.");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao cancelar");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Card className="mb-6 border-emerald-500/40 bg-emerald-500/5">
      <CardContent className="p-4 flex items-center gap-3 flex-wrap">
        <CheckCircle2 className="size-5 text-emerald-600" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-emerald-700 dark:text-emerald-400">Liga ativa</p>
          <p className="text-sm text-muted-foreground">Válida até <span className="font-bold">{paidUntilFmt}</span>.</p>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={doCancel}>
          {loading ? "Cancelando..." : "Cancelar assinatura mensal"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PayAnuidadeCard({ leagueId, settings }: { leagueId: string; settings: any }) {
  const startMonthly = useServerFn(createLeagueSubscriptionCheckout);
  const startSemester = useServerFn(createLeagueSemesterPixCheckout);
  const [loading, setLoading] = useState<null | "monthly" | "semester">(null);
  const [pixData, setPixData] = useState<any>(null);
  const [pixOpen, setPixOpen] = useState(false);

  const monthly = Number(settings?.annual_fee_credit_monthly ?? 0);
  const pixMonthly = Number(settings?.annual_fee_pix_monthly ?? settings?.annual_fee_credit_monthly ?? 0);
  const pixQuote = calculateAnuidadePixQuote(pixMonthly);
  const semesterFull = pixQuote.full;
  const semesterDiscounted = pixQuote.discounted;
  const discountValue = pixQuote.discount;

  async function payMonthly() {
    try {
      setLoading("monthly");
      const res = await startMonthly({ data: { league_id: leagueId, origin_url: window.location.origin } });
      if (res?.url) window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar pagamento");
    } finally { setLoading(null); }
  }
  async function paySemester() {
    try {
      setLoading("semester");
      const res = await startSemester({ data: { league_id: leagueId, origin_url: window.location.origin } });
      setPixData(res);
      setPixOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar pagamento");
    } finally { setLoading(null); }
  }

  async function copyPix() {
    if (!pixData?.qr_code) return;
    await navigator.clipboard.writeText(pixData.qr_code);
    toast.success("Código Pix copiado");
  }

  return (
    <Card className="mb-6 border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Anuidade pendente</CardTitle>
        <p className="text-sm text-muted-foreground">A liga não aparecerá na página inicial até a anuidade ser paga. Escolha uma das duas modalidades:</p>
      </CardHeader>
      <CardContent>
        {settings && (
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <Card className="border-primary"><CardContent className="p-4 text-center space-y-3">
              <Badge className="mb-1">Cartão — Mensal</Badge>
              <div className="text-3xl font-black">R$ {monthly.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <p className="text-xs text-muted-foreground">Cobrança recorrente automática no cartão. Cancele quando quiser.</p>
              <Button className="w-full" disabled={loading !== null} onClick={payMonthly}>
                <DollarSign className="size-4" /> {loading === "monthly" ? "Abrindo..." : "Assinar mensal"}
              </Button>
            </CardContent></Card>
            <Card className="border-emerald-500/60 bg-emerald-500/5"><CardContent className="p-4 text-center space-y-3">
              <Badge className="mb-1 bg-emerald-600 hover:bg-emerald-600">PIX — Semestral</Badge>
              <div className="text-3xl font-black">R$ {semesterDiscounted.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                <span className="line-through">R$ {semesterFull.toFixed(2)}</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">5% OFF (−R$ {discountValue.toFixed(2)})</span>
              </p>
              <p className="text-xs text-muted-foreground">Cobre proporcionalmente até {pixQuote.untilLabel}. Pagamento único via PIX.</p>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading !== null} onClick={paySemester}>
                <DollarSign className="size-4" /> {loading === "semester" ? "Abrindo..." : "Pagar semestre via PIX"}
              </Button>
            </CardContent></Card>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4 text-center">⚠ Pagamentos não são reembolsáveis. Assinaturas mensais podem ser canceladas a qualquer momento.</p>
      </CardContent>
      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pagamento via Pix</DialogTitle></DialogHeader>
          <div className="space-y-4 text-center">
            <div className="text-3xl font-black">R$ {Number(pixData?.amount ?? semesterDiscounted).toFixed(2)}</div>
            {pixData?.qr_code_base64 ? (
              <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="size-56 border rounded bg-white p-2 mx-auto" />
            ) : <div className="size-56 bg-muted rounded mx-auto" />}
            <div className="flex gap-2">
              <Input readOnly value={pixData?.qr_code ?? ""} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copyPix}><Copy className="size-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Após a confirmação do pagamento, a liga será ativada automaticamente até {pixData?.paid_until ? new Date(pixData.paid_until).toLocaleDateString("pt-BR") : pixQuote.untilLabel}.</p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function calculateAnuidadePixQuote(monthlyPix: number) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const end = m >= 1 && m <= 6 ? new Date(y, 6, 31) : m >= 7 ? new Date(y + 1, 0, 31) : new Date(y, 0, 31);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const currentMonthFraction = Math.max(0, Math.min(1, (daysInMonth - today.getDate() + 1) / daysInMonth));
  const fullMonthsAfterCurrent = Math.max(0, (end.getFullYear() - y) * 12 + (end.getMonth() - m));
  const monthsLeft = Math.min(6, Math.max(0, fullMonthsAfterCurrent + currentMonthFraction));
  const full = Math.round(monthlyPix * monthsLeft * 100) / 100;
  const discounted = Math.round(full * 0.95 * 100) / 100;
  return {
    full,
    discounted,
    discount: Math.round((full - discounted) * 100) / 100,
    untilLabel: end.toLocaleDateString("pt-BR"),
  };
}


function MpConnectCard({ leagueId }: { leagueId: string }) {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const disconnect = useServerFn(disconnectMp);
  const connectManual = useServerFn(connectMpManual);

  async function saveManual() {
    try {
      setLoading(true);
      const r: any = await connectManual({ data: { league_id: leagueId, access_token: manualToken.trim() } });
      toast.success(`Mercado Pago conectado (${r?.nickname ?? r?.mp_user_id})`);
      setManualToken(""); setShowManual(false); reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); } finally { setLoading(false); }
  }


  async function reload() {
    const { data } = await supabase.from("league_mp_accounts").select("*").eq("league_id", leagueId).maybeSingle();
    setAccount(data);
  }
  useEffect(() => { reload(); }, [leagueId]);

  // Mostra feedback do callback OAuth
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("mp_connected") === "1") { toast.success("Mercado Pago conectado!"); reload(); }
    if (p.get("mp_error")) toast.error("Falha ao conectar Mercado Pago: " + p.get("mp_error"));
  }, []);

  async function connect() {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Você precisa estar logado para conectar a conta.");

      const res = await fetch("/api/public/payments/mp-oauth-start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ league_id: leagueId }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.error || payload?.message || "Falha ao iniciar conexão.");
      }

      window.location.href = payload.url;
    } catch (e: any) { toast.error(e?.message ?? "Falha"); } finally { setLoading(false); }
  }
  async function unlink() {
    if (!confirm("Desconectar Mercado Pago? Inscrições pagas ficarão indisponíveis até reconectar.")) return;
    try { await disconnect({ data: { league_id: leagueId } }); toast.success("Desconectado"); reload(); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  const connected = !!account;

  return (
    <Card className={`mb-6 ${connected ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-5" />
          Mercado Pago {connected && <Badge className="bg-emerald-600">Conectado</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {connected
            ? "Inscrições pagas (eventos, minicursos, processo seletivo) caem direto na sua conta Mercado Pago. A plataforma retém uma pequena taxa de repasse automaticamente."
            : "Conecte sua conta Mercado Pago para começar a receber pagamentos. Os valores caem direto na sua conta. Você precisa ter CPF cadastrado no Mercado Pago — a conta é gratuita."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <Button onClick={connect} disabled={loading} size="lg">
            {loading ? "Abrindo..." : "Conectar Mercado Pago"}
          </Button>
        ) : (
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div className="text-sm">
              <div>ID Mercado Pago: <code className="font-mono">{account.mp_user_id}</code></div>
              <div className="text-muted-foreground text-xs">Conectado em {new Date(account.connected_at).toLocaleDateString("pt-BR")}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={connect} disabled={loading}>Reconectar</Button>
              <Button variant="destructive" onClick={unlink}>Desconectar</Button>
            </div>
          </div>
        )}

        <div className="rounded border p-4 space-y-2">
          <button
            type="button"
            className="text-sm font-bold underline"
            onClick={() => setShowManual((v) => !v)}
          >
            {showManual ? "Ocultar" : "O Mercado Pago recusou a autorização? Conectar manualmente"}
          </button>
          {showManual && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Se a sua conta do Mercado Pago já está vinculada à aplicação da plataforma, o botão de autorização pode dizer
                que não é possível conectar. Nesse caso, cole aqui o <strong>Access Token de produção</strong> da sua conta
                (Mercado Pago → Seus negócios → Configurações → Gestão e administração → Credenciais de produção).
                Ele começa com <code className="font-mono">APP_USR-</code>.
              </p>
              <Input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="APP_USR-..."
                type="password"
                autoComplete="off"
              />
              <Button onClick={saveManual} disabled={loading || manualToken.trim().length < 20}>
                Salvar Access Token
              </Button>
            </div>
          )}
        </div>
      </CardContent>

    </Card>
  );
}

function ConfigTab({ league, setLeague, paid }: any) {
  const [f, setF] = useState({ name: league.name, icon_url: league.icon_url ?? "", theme_color: league.theme_color, description: league.description ?? "" });
  const [pub, setPub] = useState(league.published);
  async function save() {
    const { error } = await supabase.from("leagues").update({ ...f, icon_url: f.icon_url || null }).eq("id", league.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setLeague({ ...league, ...f });
  }
  async function togglePub(v: boolean) {
    if (v && !paid) return toast.error("Você precisa pagar a anuidade para publicar");
    setPub(v);
    const { error } = await supabase.from("leagues").update({ published: v }).eq("id", league.id);
    if (error) { setPub(!v); return toast.error(error.message); }
    toast.success(v ? "Publicado" : "Despublicado");
  }
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between p-4 rounded border">
          <div><div className="font-black">Site publicado</div><div className="text-sm text-muted-foreground">Aparece na página inicial quando ativo.</div></div>
          <Switch checked={pub} onCheckedChange={togglePub} />
        </div>
        <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><ImageUpload label="Ícone" folder="leagues" value={f.icon_url} onChange={(url) => setF({ ...f, icon_url: url })} /></div>
        <div><Label>Cor tema</Label><Input type="color" value={f.theme_color} onChange={(e) => setF({ ...f, theme_color: e.target.value })} /></div>
        <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <Button onClick={save}>Salvar</Button>
      </CardContent></Card>
      
    </div>
  );
}

function SheetsSyncCard({ league }: any) {
  const getCfg = useServerFn(getSheetConfig);
  const saveCfg = useServerFn(saveSheetConfig);
  const [sid, setSid] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastErr, setLastErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r: any = await getCfg({ data: { league_id: league.id } } as any);
        if (r) { setSid(r.spreadsheet_id || ""); setLastSync(r.last_synced_at); setLastErr(r.last_error); }
      } catch {}
    })();
  }, [league.id]);
  async function save() {
    try { const r: any = await saveCfg({ data: { league_id: league.id, spreadsheet_id: sid } } as any); setSid(r.spreadsheet_id); toast.success("Planilha vinculada"); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="size-4" /> Backup em Google Sheets</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Cole o ID ou URL completa da planilha Google Sheets. Use o botão "Sync Sheets" em cada evento para enviar os inscritos.</p>
        <Input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="ID da planilha ou URL completa" />
        <Button size="sm" onClick={save}>Salvar planilha</Button>
        {lastSync && <p className="text-[11px] text-muted-foreground">Última sincronização: {new Date(lastSync).toLocaleString("pt-BR")}</p>}
        {lastErr && <p className="text-[11px] text-destructive">Último erro: {lastErr}</p>}
      </CardContent>
    </Card>
  );
}

function AboutTab({ league }: any) {
  const [items, setItems] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("league_content").select("content_key,content_value").eq("league_id", league.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.content_key] = r.content_value; });
      setItems(map);
    })();
  }, [league.id]);
  async function save(key: string) {
    const value = items[key] ?? "";
    const { error } = await supabase.from("league_content").upsert(
      { league_id: league.id, content_key: key, content_value: value },
      { onConflict: "league_id,content_key" } as any
    );
    if (error) return toast.error(error.message);
    toast.success("Salvo");
  }
  return (
    <div className="space-y-4">
      {ABOUT_KEYS.map((k) => (
        <Card key={k.key}><CardContent className="p-6 space-y-3">
          <Label className="text-lg font-black">{k.label}</Label>
          <Textarea rows={4} placeholder={k.placeholder} value={items[k.key] ?? ""} onChange={(e) => setItems({ ...items, [k.key]: e.target.value })} />
          <Button onClick={() => save(k.key)}>Salvar {k.label}</Button>
        </CardContent></Card>
      ))}
    </div>
  );
}

export function EventsTab({ league }: any) {
  const [events, setEvents] = useState<any[]>([]);
  const [allLeagues, setAllLeagues] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const blank = {
    title: "", description: "", image_url: "",
    event_date: "", end_date: "", schedule: "",
    registration_deadline: "",
    price_ligante: 0, price_partner: 0, price_visitor: 0,
    partner_league_ids: [] as string[],
    max_seats: 0,
    free_minicourse_quota: 0,
    total_hours: 0,
    checkin_count: 1,
    checkin_schedule: [{ idx: 1, label: "1° Credenciamento", starts_at: "", interval_min: 30 }] as any[],
    freeze_on_event_day: true,
  };

  const [f, setF] = useState<any>(blank);
  const deleteFiles = useServerFn(deleteStorageFiles);
  const reload = async () => {
    const { data } = await supabase.from("league_events").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setEvents(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  useEffect(() => {
    supabase.from("leagues").select("id,name").neq("id", league.id).order("name").then(({ data }) => setAllLeagues(data ?? []));
  }, [league.id]);

  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(ev: any) {
    setEditing(ev);
    const cn = Math.max(1, Number(ev.checkin_count) || 1);
    const sched = Array.isArray(ev.checkin_schedule) && ev.checkin_schedule.length > 0
      ? ev.checkin_schedule
      : Array.from({ length: cn }, (_, i) => ({ idx: i + 1, label: `${i + 1}° Credenciamento`, starts_at: "", interval_min: 30 }));
    setF({
      title: ev.title, description: ev.description ?? "", image_url: ev.image_url ?? "",
      event_date: ev.event_date ?? "", end_date: ev.end_date ? String(ev.end_date).slice(0, 16) : "", schedule: ev.schedule ?? "",
      registration_deadline: ev.registration_deadline ? new Date(ev.registration_deadline).toISOString().slice(0, 16) : "",
      price_ligante: Number(ev.price_ligante) || 0,
      price_partner: Number(ev.price_partner) || 0,
      price_visitor: Number(ev.price_visitor) || 0,
      partner_league_ids: ev.partner_league_ids ?? [],
      max_seats: Number(ev.max_seats) || 0,
      free_minicourse_quota: Number(ev.free_minicourse_quota) || 0,
      total_hours: Number(ev.total_hours) || 0,
      checkin_count: cn,
      checkin_schedule: sched,
      freeze_on_event_day: ev.freeze_on_event_day !== false,
    });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cn = Math.max(1, Math.min(10, Number(f.checkin_count) || 1));
    const sched = (f.checkin_schedule || []).slice(0, cn).map((s: any, i: number) => ({
      idx: i + 1,
      label: s?.label || `${i + 1}° Credenciamento`,
      starts_at: s?.starts_at || null,
      interval_min: Number(s?.interval_min) || 30,
    }));
    const payload: any = {
      league_id: league.id,
      title: f.title,
      description: f.description,
      image_url: f.image_url || null,
      event_date: f.event_date || null,
      end_date: f.end_date ? new Date(f.end_date).toISOString() : null,

      schedule: f.schedule || null,
      registration_deadline: f.registration_deadline ? new Date(f.registration_deadline).toISOString() : null,
      price_ligante: Number(f.price_ligante) || 0,
      price_partner: Number(f.price_partner) || 0,
      price_visitor: Number(f.price_visitor) || 0,
      partner_league_ids: f.partner_league_ids,
      max_seats: Number(f.max_seats) > 0 ? Number(f.max_seats) : null,
      free_minicourse_quota: Math.max(0, Number(f.free_minicourse_quota) || 0),
      total_hours: Number(f.total_hours) || 0,
      checkin_count: cn,
      checkin_schedule: sched,
      freeze_on_event_day: !!f.freeze_on_event_day,
    };
    const { error } = editing
      ? await supabase.from("league_events").update(payload).eq("id", editing.id)
      : await supabase.from("league_events").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Atualizado" : "Criado"); setOpen(false); setF(blank); setEditing(null); reload();
  }
  function updateScheduleCount(n: number) {
    n = Math.max(1, Math.min(10, n));
    setF((p: any) => {
      const existing = p.checkin_schedule || [];
      const sched = Array.from({ length: n }, (_, i) => existing[i] || { idx: i + 1, label: `${i + 1}° Credenciamento`, starts_at: "", interval_min: 30 });
      return { ...p, checkin_count: n, checkin_schedule: sched };
    });
  }
  function updateScheduleItem(i: number, patch: any) {
    setF((p: any) => ({ ...p, checkin_schedule: p.checkin_schedule.map((s: any, k: number) => k === i ? { ...s, ...patch } : s) }));
  }
  async function del(id: string) {
    if (!confirm("Excluir?")) return;
    const ev = events.find((e: any) => e.id === id);
    await supabase.from("league_events").delete().eq("id", id);
    if (ev?.image_url) { try { await deleteFiles({ data: { paths: [ev.image_url] } }); } catch {} }
    reload();
  }
  async function toggleField(id: string, field: "published" | "accepting_registrations", v: boolean) {
    const { error } = await supabase.from("league_events").update({ [field]: v } as any).eq("id", id);
    if (error) return toast.error(error.message);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, [field]: v } : e));
  }
  function togglePartner(id: string) {
    setF((p: any) => ({ ...p, partner_league_ids: p.partner_league_ids.includes(id) ? p.partner_league_ids.filter((x: string) => x !== id) : [...p.partner_league_ids, id] }));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="size-4" /> Novo evento</Button></div>
      <div className="space-y-3">
        {events.map((e) => (
          <EventManageCard
            key={e.id}
            event={e}
            expanded={expanded === e.id}
            onExpand={() => setExpanded(expanded === e.id ? null : e.id)}
            onToggle={toggleField}
            onEdit={() => openEdit(e)}
            onDelete={() => del(e.id)}
          />
        ))}
        {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento criado ainda.</p>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><Label>Data de início</Label><Input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></div>
              <div><Label>Data de fim (opcional)</Label><Input type="datetime-local" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">Se a data de fim for preenchida, o evento será exibido como período (ex.: 10/09 a 12/09).</p>

            <div><Label>Prazo final de inscrições</Label><Input type="datetime-local" value={f.registration_deadline} onChange={(e) => setF({ ...f, registration_deadline: e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Após esta data e hora, novas inscrições serão bloqueadas automaticamente.</p></div>

            <div><Label>Cronograma do evento</Label><Textarea rows={5} placeholder="Programação detalhada: horários, palestras, atividades..." value={f.schedule} onChange={(e) => setF({ ...f, schedule: e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Visível para inscritos no painel do inscrito.</p></div>
            <div><ImageUpload label="Imagem" folder="events" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Valor Ligante (R$)</Label><Input type="number" step="0.01" min="0" value={f.price_ligante} onChange={(e) => setF({ ...f, price_ligante: +e.target.value })} /></div>
              <div><Label className="text-xs">Valor Liga Parceira (R$)</Label><Input type="number" step="0.01" min="0" value={f.price_partner} onChange={(e) => setF({ ...f, price_partner: +e.target.value })} /></div>
              <div><Label className="text-xs">Valor Não Ligante (R$)</Label><Input type="number" step="0.01" min="0" value={f.price_visitor} onChange={(e) => setF({ ...f, price_visitor: +e.target.value })} /></div>
            </div>
            <div><Label>Número de vagas (0 = ilimitado)</Label><Input type="number" min="0" value={f.max_seats} onChange={(e) => setF({ ...f, max_seats: +e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Quando preenchidas, novos inscritos serão bloqueados automaticamente.</p></div>

            {/* CERTIFICADO E CREDENCIAMENTOS */}
            <div className="rounded border p-3 space-y-3 bg-muted/30">
              <h4 className="text-sm font-bold flex items-center gap-1"><Award className="size-4" /> Certificado e Credenciamentos</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Horas totais do evento</Label>
                  <Input type="number" min="0" step="0.5" value={f.total_hours} onChange={(e) => setF({ ...f, total_hours: +e.target.value })} />
                  <p className="text-[11px] text-muted-foreground mt-1">Essa será a quantidade de horas em certificado.</p>
                </div>
                <div>
                  <Label className="text-xs">Quantidade de credenciamentos</Label>
                  <Input type="number" min="1" max="10" value={f.checkin_count} onChange={(e) => updateScheduleCount(+e.target.value)} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Cada credenciamento valerá <b>{f.checkin_count > 0 ? (Number(f.total_hours) / f.checkin_count).toFixed(2) : "0"}h</b>.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {(f.checkin_schedule || []).map((s: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className="text-[10px]">Nome do {i + 1}° credenciamento</Label>
                      <Input value={s.label || ""} onChange={(e) => updateScheduleItem(i, { label: e.target.value })} />
                    </div>
                    <div className="col-span-5">
                      <Label className="text-[10px]">Data / Hora</Label>
                      <Input type="datetime-local" value={s.starts_at || ""} onChange={(e) => updateScheduleItem(i, { starts_at: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px]">Intervalo (min)</Label>
                      <Input type="number" min="1" value={s.interval_min || 30} onChange={(e) => updateScheduleItem(i, { interval_min: +e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>
              <label className="flex items-center justify-between gap-2 text-xs p-2 rounded border bg-background">
                <span>Congelar inscrições no dia do evento (segurança)</span>
                <Switch checked={!!f.freeze_on_event_day} onCheckedChange={(v) => setF({ ...f, freeze_on_event_day: v })} />
              </label>
            </div>

            <div>
              <Label>Ligas parceiras (recebem o valor de parceiro)</Label>
              <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1 mt-1">
                {allLeagues.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma outra liga cadastrada.</p>}
                {allLeagues.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={f.partner_league_ids.includes(l.id)} onChange={() => togglePartner(l.id)} />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter><Button type="submit">{editing ? "Salvar alterações" : "Criar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventManageCard({ event, expanded, onExpand, onToggle, onEdit, onDelete }: any) {
  const [regs, setRegs] = useState<any[] | null>(null);
  const [txnByReg, setTxnByReg] = useState<Record<string, { gross: number; fee: number }>>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [mcOpen, setMcOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const listRosterFn = useServerFn(listEventCheckinRoster);
  const syncFn = useServerFn(syncEventToSheet);

  async function exportData(kind: "csv" | "json") {
    setBusy(kind);
    try {
      const r: any = await listRosterFn({ data: { event_id: event.id } } as any);
      const members = r.members || [];
      let blob: Blob;
      let filename: string;
      if (kind === "json") {
        blob = new Blob([JSON.stringify({ event, members }, null, 2)], { type: "application/json" });
        filename = `${event.title}-inscritos.json`;
      } else {
        const header = ["Nome", "CPF", "E-mail", "Código", "Credenciamentos"].join(";");
        const lines = members.map((m: any) =>
          [m.full_name, m.cpf, m.email, m.checkin_code, Object.keys(m.checkins || {}).join(",")].map((x: any) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";"));
        blob = new Blob(["\uFEFF" + [header, ...lines].join("\n")], { type: "text/csv" });
        filename = `${event.title}-inscritos.csv`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(null); }
  }

  async function generateBadges() {
    setBusy("badges");
    try {
      const r: any = await listRosterFn({ data: { event_id: event.id } } as any);
      const rows = (r.members || []).filter((m: any) => m.full_name && m.checkin_code);
      if (rows.length === 0) return toast.error("Nenhum inscrito pago com nome");
      const blob = await generateBadgesPdf({
        eventTitle: event.title, leagueName: "LIGASUNO",
        themeColor: undefined, rows,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${event.title}-crachas.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(null); }
  }

  async function syncSheet() {
    setBusy("sync");
    try {
      const r: any = await syncFn({ data: { event_id: event.id } } as any);
      toast.success(`Sincronizado: ${r.rows} linha(s) → "${r.sheet}"`);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(null); }
  }


  useEffect(() => {
    if (!expanded || regs !== null) return;
    (async () => {
      const { data: rs } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });
      const list = rs ?? [];
      const uids = Array.from(new Set(list.map((r: any) => r.user_id)));
      let profMap: Record<string, any> = {};
      if (uids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,email,phone")
          .in("id", uids);
        (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
      }
      setRegs(list.map((r: any) => ({ ...r, profiles: profMap[r.user_id] ?? null })));

      // Carrega transações MP aprovadas para calcular valor LÍQUIDO (bruto - taxas)
      const regIds = list.map((r: any) => r.id);
      if (regIds.length > 0) {
        const { data: txns } = await supabase
          .from("payment_transactions")
          .select("reference_id, gross_amount, fee_amount, raw")
          .eq("category", "event")
          .eq("status", "approved")
          .in("reference_id", regIds);
        const map: Record<string, { gross: number; fee: number }> = {};
        (txns ?? []).forEach((t: any) => {
          const fee = getCollectorFees(t.raw) || Number(t.fee_amount || 0);
          map[t.reference_id] = { gross: Number(t.gross_amount) || 0, fee };
        });
        setTxnByReg(map);
      }
    })();
  }, [expanded]);

  const paidRegs = (regs ?? []).filter(r => r.status === "paid");
  const hasPaidRegs = paidRegs.length > 0;
  const counts = { ligante: 0, partner: 0, visitor: 0 };
  let totalGross = 0;
  let totalNet = 0;
  paidRegs.forEach(r => {
    counts[r.category as keyof typeof counts] = (counts[r.category as keyof typeof counts] ?? 0) + 1;
    const t = txnByReg[r.id];
    const gross = t ? t.gross : (Number(r.paid_price) || 0);
    const net = t ? Math.max(0, t.gross - t.fee) : gross;
    totalGross += gross;
    totalNet += net;
  });

  async function copyPaidRegistrations() {
    const names = paidRegs.map((r: any) => r.full_name).filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(names);
      toast.success(`${paidRegs.length} inscritos copiados`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-3">
          {event.image_url && <img src={event.image_url} className="size-16 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <h4 className="font-black">{event.title}</h4>
            {event.event_date && <p className="text-xs text-muted-foreground">{new Date(event.event_date).toLocaleDateString("pt-BR")}</p>}
            <div className="text-[11px] text-muted-foreground mt-1">L: R${Number(event.price_ligante).toFixed(2)} · P: R${Number(event.price_partner).toFixed(2)} · V: R${Number(event.price_visitor).toFixed(2)}</div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>
            <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="size-3" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <label className="flex items-center justify-between gap-2 text-xs p-2 rounded border">
            <span>Publicado</span>
            <Switch checked={!!event.published} onCheckedChange={(v) => onToggle(event.id, "published", v)} />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs p-2 rounded border">
            <span>Aceitar inscrições</span>
            <Switch checked={!!event.accepting_registrations} onCheckedChange={(v) => onToggle(event.id, "accepting_registrations", v)} />
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Button size="sm" variant="default" className="w-full" onClick={() => setCheckinOpen(true)}>
            <ClipboardCheck className="size-3 mr-1" /> Credenciamento
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={() => setMcOpen(true)}>
            <BookOpen className="size-3 mr-1" /> Minicursos
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={() => setCertOpen(true)}>
            <Award className="size-3 mr-1" /> Certificados
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={generateBadges} disabled={busy === "badges"}>
            <QrCode className="size-3 mr-1" /> {busy === "badges" ? "Gerando..." : "Crachás (PDF)"}
          </Button>
          <Button size="sm" variant="ghost" className="w-full col-span-2 sm:col-span-1" onClick={onExpand}>
            {expanded ? "Esconder inscritos" : "Inscritos / Arrecadação"}
          </Button>
        </div>
        <CheckinDialog mode={checkinOpen ? { kind: "event", event } : null} open={checkinOpen} onClose={() => setCheckinOpen(false)} />
        <EventCertificatesDialog mode={certOpen ? { kind: "event", event, leagueId: event.league_id } : null} open={certOpen} onClose={() => setCertOpen(false)} />
        {expanded && (
          <div className="pt-3 border-t space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded bg-muted"><div className="text-xs text-muted-foreground">Ligantes</div><div className="font-black">{counts.ligante}</div></div>
              <div className="p-2 rounded bg-muted"><div className="text-xs text-muted-foreground">Parceiros</div><div className="font-black">{counts.partner}</div></div>
              <div className="p-2 rounded bg-muted"><div className="text-xs text-muted-foreground">Visitantes</div><div className="font-black">{counts.visitor}</div></div>
              <div className="p-2 rounded bg-primary/10">
                <div className="text-xs text-muted-foreground">Arrecadado (líquido)</div>
                <div className="font-black">R$ {totalNet.toFixed(2)}</div>
                {totalGross > totalNet && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">Bruto R$ {totalGross.toFixed(2)} · Taxas −R$ {(totalGross - totalNet).toFixed(2)}</div>
                )}
              </div>
            </div>
            {regs === null && <p className="text-xs text-muted-foreground">Carregando inscritos...</p>}
            {regs !== null && !hasPaidRegs && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum inscrito confirmado ainda.</p>
            )}
            {regs !== null && hasPaidRegs && (
              <>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={copyPaidRegistrations}>Copiar Inscritos</Button>
                </div>
                <div className="space-y-1">
                  {paidRegs.map((r: any) => (
                    <button key={r.id} onClick={() => setSelected(r)} className="w-full text-left p-2 rounded border hover:bg-accent flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate">{r.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.profiles?.email}</div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <Badge variant="default" className="text-[10px]">Pago</Badge>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{r.category} · R${Number(r.paid_price).toFixed(2)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

          </div>
        )}
      </CardContent>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inscrição</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <Row k="Nome completo" v={selected.full_name} />
              {selected.social_name && <Row k="Nome social" v={selected.social_name} />}
              <Row k="CPF" v={selected.cpf} />
              <Row k="Curso" v={selected.course} />
              <Row k="Email" v={selected.profiles?.email ?? "—"} />
              <Row k="Telefone" v={selected.profiles?.phone ?? "—"} />
              <Row k="Categoria" v={selected.category} />
              <Row k="Valor pago" v={`R$ ${Number(selected.paid_price).toFixed(2)}`} />
              {selected.discount_reason && <Row k="Desconto" v={selected.discount_reason} />}
              <Row k="Status" v={selected.status} />
              <Row k="Inscrito em" v={new Date(selected.created_at).toLocaleString("pt-BR")} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <MinicoursesManager event={event} open={mcOpen} onClose={() => setMcOpen(false)} />
    </Card>
  );
}

function MinicoursesManager({ event, open, onClose }: { event: any; open: boolean; onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [regsByMc, setRegsByMc] = useState<Record<string, any[]>>({});
  const [slotsByMc, setSlotsByMc] = useState<Record<string, Array<{ id: string; league_id: string; seats: number; price?: number | null }>>>({});
  const [leaguesList, setLeaguesList] = useState<Array<{ id: string; name: string }>>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const blank = { title: "", instructor: "", starts_at: "", location: "", description: "", is_free: true, price: 0, price_ligante: null as number | null, max_registrations: 20, published: false, total_hours: 0 };
  const [f, setF] = useState<any>(blank);
  const [exclusiveDraft, setExclusiveDraft] = useState<Array<{ id?: string; league_id: string; seats: number; price?: number | null }>>([]);
  const [checkinMc, setCheckinMc] = useState<any | null>(null);
  const [certMc, setCertMc] = useState<any | null>(null);

  async function reload() {
    const { data } = await supabase.from("league_minicourses").select("*").eq("event_id", event.id).order("starts_at", { ascending: true });
    setList(data ?? []);
    const ids = (data ?? []).map((m: any) => m.id);
    if (ids.length === 0) { setRegsByMc({}); setSlotsByMc({}); return; }
    const [{ data: regs }, slotsRes] = await Promise.all([
      supabase.from("minicourse_registrations").select("*").in("minicourse_id", ids),
      (supabase as any).from("minicourse_exclusive_slots").select("*").in("minicourse_id", ids),
    ]);
    const uids = Array.from(new Set((regs ?? []).map((r: any) => r.user_id)));
    let profMap: Record<string, any> = {};
    if (uids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,username,email,phone,full_name").in("id", uids);
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
    }
    const grouped: Record<string, any[]> = {};
    (regs ?? []).forEach((r: any) => {
      (grouped[r.minicourse_id] ||= []).push({ ...r, profile: profMap[r.user_id] ?? null });
    });
    setRegsByMc(grouped);
    const slotsMap: Record<string, any[]> = {};
    ((slotsRes?.data ?? []) as any[]).forEach((s: any) => { (slotsMap[s.minicourse_id] ||= []).push(s); });
    setSlotsByMc(slotsMap);
  }
  useEffect(() => {
    if (!open) return;
    reload();
    supabase.from("leagues").select("id, name").order("name").then(({ data }) => setLeaguesList((data ?? []) as any));
  }, [open, event.id]);

  function openNew() { setEditing(null); setF(blank); setExclusiveDraft([]); setFormOpen(true); }
  function openEdit(mc: any) {
    setEditing(mc);
    setF({
      title: mc.title, instructor: mc.instructor,
      starts_at: mc.starts_at ? new Date(mc.starts_at).toISOString().slice(0, 16) : "",
      location: mc.location ?? "", description: mc.description ?? "",
      is_free: !!mc.is_free, price: Number(mc.price) || 0,
      price_ligante: mc.price_ligante === null || mc.price_ligante === undefined ? null : Number(mc.price_ligante),
      max_registrations: Number(mc.max_registrations) || 20,
      published: !!mc.published,
      total_hours: Number(mc.total_hours) || 0,
    });
    setExclusiveDraft((slotsByMc[mc.id] ?? []).map((s: any) => ({ id: s.id, league_id: s.league_id, seats: Number(s.seats), price: s.price === null || s.price === undefined ? null : Number(s.price) })));
    setFormOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.starts_at) return toast.error("Informe data e hora");
    const maxReg = Math.max(1, Number(f.max_registrations) || 1);
    const totalExcl = exclusiveDraft.reduce((a, s) => a + (Number(s.seats) || 0), 0);
    if (totalExcl > maxReg) return toast.error(`Vagas exclusivas (${totalExcl}) excedem o total de vagas (${maxReg}).`);
    if (exclusiveDraft.some((s) => !s.league_id || !s.seats || s.seats < 1)) return toast.error("Cada reserva exclusiva precisa ter liga e no mínimo 1 vaga.");
    const seen = new Set<string>();
    for (const s of exclusiveDraft) {
      if (seen.has(s.league_id)) return toast.error("Não repita a mesma liga nas reservas.");
      seen.add(s.league_id);
    }
    const payload: any = {
      event_id: event.id,
      title: f.title, instructor: f.instructor,
      starts_at: new Date(f.starts_at).toISOString(),
      location: f.location || null, description: f.description || null,
      is_free: !!f.is_free, price: f.is_free ? 0 : Number(f.price) || 0,
      price_ligante: f.is_free || f.price_ligante === null || f.price_ligante === undefined ? null : Number(f.price_ligante) || 0,
      max_registrations: maxReg,
      published: !!f.published,
      total_hours: Number(f.total_hours) || 0,
    };
    const res: any = editing
      ? await supabase.from("league_minicourses").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("league_minicourses").insert(payload).select("id").single();
    if (res.error) return toast.error(res.error.message);
    const mcId = res.data?.id ?? editing?.id;
    if (mcId) {
      const existing = slotsByMc[mcId] ?? [];
      const keepIds = new Set(exclusiveDraft.filter((s) => s.id).map((s) => s.id!));
      const toDelete = existing.filter((e: any) => !keepIds.has(e.id));
      if (toDelete.length) {
        await (supabase as any).from("minicourse_exclusive_slots").delete().in("id", toDelete.map((e: any) => e.id));
      }
      for (const s of exclusiveDraft) {
        if (s.id) {
          await (supabase as any).from("minicourse_exclusive_slots").update({ league_id: s.league_id, seats: s.seats, price: f.is_free ? null : (s.price ?? null) }).eq("id", s.id);
        } else {
          await (supabase as any).from("minicourse_exclusive_slots").insert({ minicourse_id: mcId, league_id: s.league_id, seats: s.seats, price: f.is_free ? null : (s.price ?? null) });
        }
      }
    }
    toast.success(editing ? "Atualizado" : "Criado"); setFormOpen(false); reload();
  }

  async function del(id: string) {
    if (!confirm("Excluir este minicurso? As inscrições serão removidas.")) return;
    await supabase.from("minicourse_registrations").delete().eq("minicourse_id", id);
    await supabase.from("league_minicourses").delete().eq("id", id);
    reload();
  }
  async function togglePublished(mc: any) {
    const { error } = await supabase.from("league_minicourses").update({ published: !mc.published }).eq("id", mc.id);
    if (error) return toast.error(error.message);
    setList(prev => prev.map(m => m.id === mc.id ? { ...m, published: !mc.published } : m));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Minicursos · {event.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={openNew}><Plus className="size-4" /> Novo minicurso</Button>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum minicurso ainda. Crie um para liberar inscrição aos participantes do evento.</p>
          ) : (
            <div className="space-y-2">
              {list.map((mc) => {
                const regs = regsByMc[mc.id] ?? [];
                const paidCount = regs.filter(r => r.status === "paid").length;
                const cap = Number(mc.max_registrations) || 0;
                const pct = cap ? Math.min(100, Math.round((paidCount / cap) * 100)) : 0;
                return (
                  <Card key={mc.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-black truncate">{mc.title}</h5>
                            <Badge variant={mc.is_free ? "secondary" : "default"} className="text-[10px]">{mc.is_free ? "Gratuito" : `R$ ${Number(mc.price).toFixed(2)}`}</Badge>
                            {!mc.published && <Badge variant="outline" className="text-[10px]">Rascunho</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{mc.instructor} · {new Date(mc.starts_at).toLocaleString("pt-BR")}</p>
                          {mc.location && <p className="text-[11px] text-muted-foreground">📍 {mc.location}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1 shrink-0">
                          <Button size="sm" variant="default" onClick={() => setCheckinMc(mc)} title="Credenciamento"><ClipboardCheck className="size-3" /></Button>
                          <Button size="sm" variant="secondary" onClick={() => setCertMc(mc)} title="Certificados"><Award className="size-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(mc)}>Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => del(mc.id)}><Trash2 className="size-3" /></Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch checked={!!mc.published} onCheckedChange={() => togglePublished(mc)} />
                          Publicado
                        </label>
                        <button onClick={() => setViewing(mc)} className="text-xs underline text-muted-foreground">
                          {paidCount}/{cap} inscritos ({pct}%)
                        </button>
                      </div>
                      <div className="h-1 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar minicurso" : "Novo minicurso"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Lecionador</Label><Input required value={f.instructor} onChange={(e) => setF({ ...f, instructor: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Data e hora</Label><Input type="datetime-local" required value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
              <div><Label>Vagas (máx.)</Label><Input type="number" min="1" required value={f.max_registrations} onChange={(e) => setF({ ...f, max_registrations: +e.target.value })} /></div>
            </div>
            <div><Label>Local</Label><Input placeholder="Sala, prédio, link..." value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="flex items-center justify-between gap-2 p-3 rounded border">
              <div>
                <Label className="cursor-pointer">Gratuito</Label>
                <p className="text-[11px] text-muted-foreground">Se desativado, exigirá pagamento.</p>
              </div>
              <Switch checked={f.is_free} onCheckedChange={(v) => setF({ ...f, is_free: v })} />
            </div>
            {!f.is_free && (
              <div className="space-y-3">
                <div><Label>Valor para não ligantes (R$)</Label><Input type="number" step="0.01" min="0.50" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Mínimo R$ 0,50 (limite do gateway).</p></div>
                <label className="flex items-center justify-between gap-2 p-2 rounded border">
                  <div>
                    <span className="text-sm font-medium">Valor diferente para ligantes</span>
                    <p className="text-[11px] text-muted-foreground">Vale para membros da liga organizadora.</p>
                  </div>
                  <Switch
                    checked={f.price_ligante !== null && f.price_ligante !== undefined}
                    onCheckedChange={(v) => setF({ ...f, price_ligante: v ? 0 : null })}
                  />
                </label>
                {f.price_ligante !== null && f.price_ligante !== undefined && (
                  <div><Label>Valor para ligantes (R$)</Label><Input type="number" step="0.01" min="0" value={f.price_ligante} onChange={(e) => setF({ ...f, price_ligante: Math.max(0, +e.target.value || 0) })} /><p className="text-[11px] text-muted-foreground mt-1">Use 0 para gratuito aos ligantes.</p></div>
                )}
              </div>
            )}
            <div className="rounded border p-2 bg-muted/30">
              <Label className="text-xs">Horas no certificado</Label>
              <Input type="number" min="0" step="0.5" value={f.total_hours} onChange={(e) => setF({ ...f, total_hours: +e.target.value })} />
              <p className="text-[11px] text-muted-foreground mt-1">Minicursos têm 1 credenciamento — esta é a carga horária total no certificado.</p>
            </div>
            <div className="rounded border p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label className="text-xs">Vagas exclusivas / valor por liga</Label>
                  <p className="text-[11px] text-muted-foreground leading-snug">Reserve parte das vagas totais para ligantes desta liga ou de ligas parceiras. As vagas exclusivas <strong>saem das vagas totais</strong> (não somam). Se informar um valor especial, ele vale só enquanto houver vagas dessa liga; depois volta ao valor normal.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setExclusiveDraft((d) => [...d, { league_id: event.league_id, seats: 1, price: null }])}>
                  <Plus className="size-3.5" /> Reservar
                </Button>
              </div>
              {exclusiveDraft.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Nenhuma reserva. Todas as vagas ficam abertas.</p>
              ) : (
                <div className="space-y-2">
                  {exclusiveDraft.map((s, idx) => (
                    <div key={idx} className="rounded-md border bg-background p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                          value={s.league_id}
                          onChange={(e) => setExclusiveDraft((d) => d.map((x, i) => i === idx ? { ...x, league_id: e.target.value } : x))}
                        >
                          <option value="">— liga —</option>
                          {leaguesList.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}{l.id === event.league_id ? " (organizadora)" : ""}</option>
                          ))}
                        </select>
                        <div className="w-20">
                          <Input
                            type="number" min="1" value={s.seats}
                            onChange={(e) => setExclusiveDraft((d) => d.map((x, i) => i === idx ? { ...x, seats: Math.max(1, +e.target.value || 1) } : x))}
                          />
                          <p className="text-[10px] text-muted-foreground text-center">vagas</p>
                        </div>
                        <Button type="button" size="sm" variant="destructive" onClick={() => setExclusiveDraft((d) => d.filter((_, i) => i !== idx))}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      {!f.is_free && (
                        <label className="flex items-center gap-2 text-[11px]">
                          <Switch
                            checked={s.price !== null && s.price !== undefined}
                            onCheckedChange={(v) => setExclusiveDraft((d) => d.map((x, i) => i === idx ? { ...x, price: v ? 0 : null } : x))}
                          />
                          <span>Valor diferente para esta liga</span>
                          {s.price !== null && s.price !== undefined && (
                            <Input
                              type="number" min="0" step="0.01" className="h-8 w-28 ml-auto"
                              value={s.price}
                              onChange={(e) => setExclusiveDraft((d) => d.map((x, i) => i === idx ? { ...x, price: Math.max(0, +e.target.value || 0) } : x))}
                            />
                          )}
                        </label>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    Total reservado: {exclusiveDraft.reduce((a, s) => a + (Number(s.seats) || 0), 0)} / {f.max_registrations} vagas · Restam {Math.max(0, (Number(f.max_registrations) || 0) - exclusiveDraft.reduce((a, s) => a + (Number(s.seats) || 0), 0))} vagas abertas.
                  </p>
                </div>
              )}
            </div>


            <label className="flex items-center justify-between gap-2 p-3 rounded border">
              <div>
                <span className="text-sm font-medium">Publicar imediatamente</span>
                <p className="text-[11px] text-muted-foreground">Quando publicado, aparece para inscritos no evento.</p>
              </div>
              <Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} />
            </label>
            <DialogFooter><Button type="submit">{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Inscritos · {viewing?.title}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-1">
              {(regsByMc[viewing.id] ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum inscrito ainda.</p>}
              {(regsByMc[viewing.id] ?? []).map((r) => (
                <div key={r.id} className="p-2 rounded border flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{r.profile?.full_name ?? r.profile?.username ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.profile?.email}</div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <Badge variant={r.status === "paid" ? "default" : "secondary"} className="text-[10px]">{r.status === "paid" ? "Confirmado" : "Pendente"}</Badge>
                    <span className="text-[10px] text-muted-foreground mt-0.5">R$ {Number(r.paid_price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>

      </Dialog>

      <CheckinDialog mode={checkinMc ? { kind: "minicourse", minicourse: checkinMc } : null} open={!!checkinMc} onClose={() => setCheckinMc(null)} />
      <EventCertificatesDialog
        mode={certMc ? { kind: "minicourse", minicourse: certMc, leagueId: event.league_id } : null}
        open={!!certMc} onClose={() => setCertMc(null)}
      />
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 border-b py-1.5"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}

function NewsTab({ league }: any) {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", excerpt: "", image_url: "", category: "Geral", link: "" });
  const deleteFiles = useServerFn(deleteStorageFiles);
  const reload = async () => {
    const { data } = await supabase.from("league_news").select("*").eq("league_id", league.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("league_news").insert({ ...f, league_id: league.id, image_url: f.image_url || null, link: f.link || null });
    if (error) return toast.error(error.message);
    toast.success("Publicado"); setOpen(false); setF({ title: "", excerpt: "", image_url: "", category: "Geral", link: "" }); reload();
  }
  async function del(id: string) {
    if (!confirm("Excluir?")) return;
    const n = list.find((x: any) => x.id === id);
    await supabase.from("league_news").delete().eq("id", id);
    if (n?.image_url) { try { await deleteFiles({ data: { paths: [n.image_url] } }); } catch {} }
    reload();
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="size-4" /> Nova notícia</Button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((n) => (
          <Card key={n.id}><CardContent className="p-4 flex gap-3">
            {n.image_url && <img src={n.image_url} className="size-16 rounded object-cover" />}
            <div className="flex-1"><Badge variant="secondary" className="text-[10px]">{n.category}</Badge><h4 className="font-black mt-1">{n.title}</h4><p className="text-xs text-muted-foreground line-clamp-2">{n.excerpt}</p></div>
            <Button size="sm" variant="destructive" onClick={() => del(n.id)}><Trash2 className="size-3" /></Button>
          </CardContent></Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Notícia</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
            <div><Label>Resumo</Label><Textarea value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></div>
            <div><ImageUpload label="Imagem" folder="news" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
            <div><Label>Link externo</Label><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div>
            <DialogFooter><Button type="submit">Publicar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ActivitiesTab({ league }: any) {
  const [list, setList] = useState<any[]>([]);
  const [otherLeagues, setOtherLeagues] = useState<any[]>([]);
  const emptyInternal = { image_url: "", caption: "" };
  const [internalForm, setInternalForm] = useState(emptyInternal);
  const [internalDlg, setInternalDlg] = useState(false);
  const emptyOpen = { image_url: "", title: "", description: "", participating_league_ids: [] as string[] };
  const [openForm, setOpenForm] = useState(emptyOpen);
  const [openDlg, setOpenDlg] = useState(false);
  const deleteFiles = useServerFn(deleteStorageFiles);

  const reload = async () => {
    const { data } = await supabase.from("league_activities").select("*").eq("league_id", league.id).order("display_order");
    setList(data ?? []);
  };
  useEffect(() => { reload(); }, [league.id]);
  useEffect(() => {
    supabase.from("leagues").select("id,name,icon_url").eq("published", true).neq("id", league.id).order("name")
      .then(({ data }) => setOtherLeagues(data ?? []));
  }, [league.id]);

  async function addInternal(e: React.FormEvent) {
    e.preventDefault();
    if (!internalForm.image_url) return toast.error("Imagem obrigatória");
    const { error } = await supabase.from("league_activities").insert({
      league_id: league.id,
      display_order: list.length,
      image_url: internalForm.image_url,
      caption: internalForm.caption.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Atividade adicionada");
    setInternalForm(emptyInternal); setInternalDlg(false); reload();
  }
  async function addOpen(e: React.FormEvent) {
    e.preventDefault();
    if (!openForm.image_url) return toast.error("Imagem obrigatória");
    if (!openForm.title.trim()) return toast.error("Título obrigatório");
    if (!openForm.description.trim()) return toast.error("Descrição obrigatória");
    const { error } = await (supabase.from("league_activities") as any).insert({
      league_id: league.id,
      display_order: list.length,
      image_url: openForm.image_url,
      caption: openForm.title.trim(),
      title: openForm.title.trim(),
      description: openForm.description.trim(),
      is_open: true,
      participating_league_ids: openForm.participating_league_ids,
    });
    if (error) return toast.error(error.message);
    toast.success("Atividade aberta registrada");
    setOpenForm(emptyOpen); setOpenDlg(false); reload();
  }
  function toggleLeague(id: string) {
    setOpenForm((s) => ({
      ...s,
      participating_league_ids: s.participating_league_ids.includes(id)
        ? s.participating_league_ids.filter((x) => x !== id)
        : [...s.participating_league_ids, id],
    }));
  }
  async function del(id: string) {
    const a = list.find((x: any) => x.id === id);
    await supabase.from("league_activities").delete().eq("id", id);
    if (a?.image_url) { try { await deleteFiles({ data: { paths: [a.image_url] } }); } catch {} }
    reload();
  }

  const internal = list.filter((a: any) => !a.is_open);
  const opens = list.filter((a: any) => a.is_open);

  return (
    <Card><CardContent className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-black text-lg">Atividades da liga</h3>
          <p className="text-sm text-muted-foreground">Registre momentos internos da liga ou <b>atividades abertas</b> (interligas) exibidas no painel do CAMED.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setInternalDlg(true)}>
            <Plus className="size-4 mr-1" /> Adicionar atividade
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpenDlg(true)}>
            <Plus className="size-4 mr-1" /> Registrar atividade aberta
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Atividades internas</h4>
        {internal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade interna registrada.</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {internal.map((a: any) => (
              <Card key={a.id} className="overflow-hidden relative group">
                <img src={a.image_url} className="aspect-video w-full object-cover" />
                {a.caption && <div className="p-2"><p className="text-xs text-muted-foreground">{a.caption}</p></div>}
                <Button size="sm" variant="destructive" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => del(a.id)}><Trash2 className="size-3" /></Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Atividades abertas (interligas)</h4>
        {opens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade aberta registrada.</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {opens.map((a: any) => (
              <Card key={a.id} className="overflow-hidden relative group">
                <img src={a.image_url} className="aspect-video w-full object-cover" />
                <Badge className="absolute top-2 left-2 bg-emerald-600 text-white border-0">Aberta</Badge>
                <div className="p-2 space-y-1">
                  {a.title && <p className="text-sm font-black leading-tight">{a.title}</p>}
                  {a.description && <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">{a.description}</p>}
                </div>
                <Button size="sm" variant="destructive" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => del(a.id)}><Trash2 className="size-3" /></Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={internalDlg} onOpenChange={setInternalDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adicionar atividade da liga</DialogTitle></DialogHeader>
          <form onSubmit={addInternal} className="space-y-4">
            <ImageUpload label="Imagem" folder="activities" value={internalForm.image_url} onChange={(url) => setInternalForm({ ...internalForm, image_url: url })} />
            <div>
              <Label>Legenda (opcional)</Label>
              <Input value={internalForm.caption} onChange={(e) => setInternalForm({ ...internalForm, caption: e.target.value })} placeholder="Ex.: Encontro de segunda" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInternalDlg(false)}>Cancelar</Button>
              <Button type="submit">Adicionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openDlg} onOpenChange={setOpenDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar atividade aberta</DialogTitle></DialogHeader>
          <form onSubmit={addOpen} className="space-y-4">
            <ImageUpload label="Imagem da atividade" folder="activities" value={openForm.image_url} onChange={(url) => setOpenForm({ ...openForm, image_url: url })} />
            <div>
              <Label>Título</Label>
              <Input value={openForm.title} onChange={(e) => setOpenForm({ ...openForm, title: e.target.value })} placeholder="Ex.: Simulação interligas" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={4} value={openForm.description} onChange={(e) => setOpenForm({ ...openForm, description: e.target.value })} placeholder="Conte sobre a atividade, público-alvo e como participar" />
            </div>
            <div>
              <Label>Ligas que participaram junto</Label>
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto rounded-md border p-2">
                {otherLeagues.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhuma outra liga publicada.</p>}
                {otherLeagues.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm rounded hover:bg-muted p-1.5 cursor-pointer">
                    <Checkbox checked={openForm.participating_league_ids.includes(l.id)} onCheckedChange={() => toggleLeague(l.id)} />
                    {l.icon_url ? <img src={l.icon_url} className="size-5 rounded-full object-cover" alt="" /> : <div className="size-5 rounded-full bg-muted" />}
                    <span className="truncate">{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenDlg(false)}>Cancelar</Button>
              <Button type="submit">Publicar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}



function MembersTab({ league }: any) {
  const [members, setMembers] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ligante" | "diretor">("ligante");
  const [selOpen, setSelOpen] = useState(false);
  const [semOpen, setSemOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const listPays = useServerFn(listCyclePayments);

  const reload = async () => {
    const { data: memberships, error: membershipsError } = await supabase
      .from("league_memberships")
      .select("id, league_id, user_id, role, permissions, created_at")
      .eq("league_id", league.id)
      .order("created_at", { ascending: true });

    if (membershipsError) {
      toast.error(membershipsError.message);
      setMembers([]);
      return;
    }

    const userIds = [...new Set((memberships ?? []).map((member) => member.user_id).filter(Boolean))];
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, email, full_name, registration_number")
          .in("id", userIds)
      : { data: [], error: null };

    if (profilesError) {
      toast.error(profilesError.message);
      setMembers([]);
      return;
    }

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const mergedMembers = (memberships ?? []).map((member) => ({
      ...member,
      profiles: profileMap.get(member.user_id) ?? null,
    }));

    for (const presId of [league.president_id, (league as any).president2_id] as (string | null | undefined)[]) {
      if (presId && !mergedMembers.some((member) => member.user_id === presId)) {
        const { data: presidentProfile } = await supabase
          .from("profiles")
          .select("id, username, email, full_name, registration_number")
          .eq("id", presId)
          .maybeSingle();

        if (presidentProfile) {
          mergedMembers.unshift({
            id: `presidente-${league.id}-${presId}`,
            league_id: league.id,
            user_id: presId,
            role: "presidente",
            created_at: new Date(0).toISOString(),
            permissions: null,
            profiles: presidentProfile,
          });
        }
      }
    }

    setMembers(mergedMembers);
    try {
      const r = await listPays({ data: { league_id: league.id } });
      const map: Record<string, string> = {};
      (r.payments ?? []).forEach((p: any) => { map[p.user_id] = p.status; });
      setStatusMap(map);
    } catch { /* sem ciclo ainda */ }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [league.id]);
  async function add() {
    if (!query.trim()) return;
    const q = query.trim();
    const { data: profs, error: pe } = await (supabase as any)
      .rpc("find_profile_for_league", { _league_id: league.id, _query: q });
    if (pe) return toast.error(pe.message);
    if (!profs || profs.length === 0) return toast.error("Nenhum usuário encontrado com esse e-mail/usuário. Confirme se a pessoa já criou uma conta no MEDUNO.");
    if (profs.length > 1) return toast.error("Múltiplos usuários encontrados — use o e-mail completo");
    const prof = profs[0];
    const { error } = await supabase.from("league_memberships").upsert({ league_id: league.id, user_id: prof.id, role }, { onConflict: "league_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("Adicionado"); setQuery(""); await reload();
  }
  async function remove(id: string) {
    if (!confirm("Remover este membro da liga?")) return;
    const { error } = await supabase.from("league_memberships").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); reload();
  }
  async function changeRole(id: string, newRole: "ligante" | "diretor") {
    const { error } = await supabase.from("league_memberships").update({ role: newRole }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cargo atualizado"); reload();
  }
  return (
    <Card><CardContent className="p-6 space-y-4">
      <LeaveRequestsPanel league={league} onProcessed={reload} />
      <div className="flex justify-end gap-2 flex-wrap">
        <Button onClick={() => setCertOpen(true)} variant="outline"><Award className="size-4" /> Certificados do Semestre</Button>
        <Button onClick={() => setSemOpen(true)} variant="outline"><DollarSign className="size-4" /> Semestralidade</Button>
        <Button onClick={() => setSelOpen(true)} variant="outline"><ClipboardCheck className="size-4" /> Processo Seletivo</Button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input className="flex-1 min-w-[200px]" placeholder="Email ou usuário" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="px-3 rounded border bg-background" value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="ligante">Ligante</option><option value="diretor">Diretor</option>
        </select>
        <Button onClick={add}>Adicionar</Button>
      </div>
      <div className="space-y-2">
        {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro ainda.</p>}
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 rounded border gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-bold truncate">{m.profiles?.full_name || m.profiles?.username}</span>
              <span className="text-xs text-muted-foreground truncate">{m.profiles?.email}</span>
              {m.profiles?.registration_number && <span className="text-xs text-muted-foreground">Mat. {m.profiles.registration_number}</span>}
              {["ligante","diretor"].includes(m.role) && statusMap[m.user_id] && (
                <SemesterStatusBadge status={statusMap[m.user_id]} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {m.role === "presidente" ? (
                <Badge>Presidente</Badge>
              ) : (
                <>
                  <select
                    className="px-2 py-1 rounded border bg-background text-xs"
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value as "ligante" | "diretor")}
                  >
                    <option value="ligante">Ligante</option>
                    <option value="diretor">Diretor</option>
                  </select>
                  {m.role === "diretor" && (
                    <DirectorPermissionsButton membership={m} onSaved={reload} />
                  )}
                  <Button size="sm" variant="destructive" onClick={() => remove(m.id)} title="Excluir membro"><Trash2 className="size-3" /></Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <SelectionManagerDialog league={league} open={selOpen} onClose={() => setSelOpen(false)} onMembershipUpdated={reload} />
      <SemesterDialog league={league} open={semOpen} onClose={() => setSemOpen(false)} onUpdated={reload} />
      <CertificatesDialog league={league} open={certOpen} onClose={() => setCertOpen(false)} />
    </CardContent></Card>
  );
}
export const DIRECTOR_TAB_KEYS = ["config", "about", "eventos", "news", "quiz", "scoring", "atividades", "membros"] as const;
export type DirectorTab = typeof DIRECTOR_TAB_KEYS[number];
export const DIRECTOR_TAB_LABELS: Record<DirectorTab, string> = {
  config: "Config", about: "Sobre", eventos: "Eventos", news: "Notícias", quiz: "Quizzes", scoring: "Pontuação", atividades: "Atividades", membros: "Membros",
};

function DirectorPermissionsButton({ membership, onSaved }: { membership: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const initial: DirectorTab[] = ((membership.permissions ?? DIRECTOR_TAB_KEYS) as string[])
    .filter((k): k is DirectorTab => (DIRECTOR_TAB_KEYS as readonly string[]).includes(k));
  const [perms, setPerms] = useState<DirectorTab[]>(initial);

  function toggle(k: DirectorTab) {
    setPerms((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  }
  async function save() {
    const { error } = await (supabase as any).from("league_memberships").update({ permissions: perms }).eq("id", membership.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Permissões atualizadas");
    setOpen(false);
    onSaved();
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} title="Permissões"><KeyRound className="size-3" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abas do Painel do Diretor</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Selecione quais abas este diretor pode acessar.</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {DIRECTOR_TAB_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm p-2 rounded border bg-background cursor-pointer">
                <Checkbox checked={perms.includes(k)} onCheckedChange={() => toggle(k)} />
                {DIRECTOR_TAB_LABELS[k]}
              </label>
            ))}
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function LeaveRequestsPanel({ league, onProcessed }: { league: any; onProcessed: () => void }) {
  const listFn = useServerFn(listLeagueLeaveRequests);
  const processFn = useServerFn(processLeaveRequest);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    try {
      const r: any = await listFn({ data: { league_id: league.id } });
      setItems(r?.requests ?? []);
    } catch { setItems([]); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [league.id]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      await processFn({ data: { request_id: id, action } } as any);
      toast.success(action === "approve" ? "Desistência aprovada" : "Pedido rejeitado");
      await reload();
      onProcessed();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(null); }
  }

  if (items.length === 0) return null;
  return (
    <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/5 space-y-3">
      <div className="font-black text-amber-700 dark:text-amber-400 flex items-center gap-2">
        <Bell className="size-4" /> Pedidos de desistência ({items.length})
      </div>
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="p-3 rounded border bg-background flex items-start justify-between gap-3 flex-wrap">
            <div className="text-sm flex-1 min-w-[200px]">
              <div className="font-bold">{r.profile?.full_name || r.profile?.username || "Ligante"}</div>
              <div className="text-xs text-muted-foreground">
                {r.profile?.email}{r.profile?.cpf ? ` · CPF ${r.profile.cpf}` : ""}{r.profile?.registration_number ? ` · Matrícula ${r.profile.registration_number}` : ""}
              </div>
              {r.reason && <div className="text-xs mt-1 italic">"{r.reason}"</div>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "reject")}>Rejeitar</Button>
              <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>Aprovar desistência</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
