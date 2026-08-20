import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, CAMED_TAB_LABELS, ALL_CAMED_TABS_LIST, type CamedTab } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit, Users as UsersIcon, Settings as SettingsIcon, Building2, AlertTriangle, Mail, MessageSquare, Calendar as CalIcon, Clock, Eye, Phone, Video, MapPin, History, Trophy, Medal, Crown, ChevronDown, ChevronUp, Newspaper, KeyRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "@/components/image-upload";
import { useServerFn } from "@tanstack/react-start";
import { deleteStorageFiles } from "@/lib/storage-delete.functions";
import { CamedScoringApprovals } from "@/components/camed-scoring-approvals";
import { setCamedMaintenance } from "@/lib/athletic-extras.functions";
import { Wrench, FolderOpen } from "lucide-react";
import { CamedDocumentsTab } from "@/components/camed-documents";
import { CamedCourseDocumentsManager } from "@/components/camed-course-documents";
import { CamedCourseInfoManager } from "@/components/camed-course-info";
import { CamedOpenActivities } from "@/components/camed-open-activities";

export const Route = createFileRoute("/camed-painel")({ component: CamedPage });

function CamedPage() {
  const { user, camedPanelTabs, isCamedPresident, isAdminMaster, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
  }, [loading, user]);

  const allowed = isCamedPresident || isAdminMaster || camedPanelTabs.length > 0;

  if (loading) return <div className="p-12 text-center">Carregando...</div>;
  if (!allowed) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="text-2xl font-black">Acesso negado</h1>
      <p className="text-muted-foreground mt-2">Apenas presidentes do CAMED ou pessoas autorizadas têm acesso a esta área.</p>
      <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
    </div>
  );

  const visible = camedPanelTabs;
  const first = visible[0] ?? "info";

  const tabDefs: { key: CamedTab; icon: React.ReactNode }[] = [
    { key: "info", icon: <SettingsIcon className="size-4 mr-1.5" /> },
    { key: "membros", icon: <UsersIcon className="size-4 mr-1.5" /> },
    { key: "noticias", icon: <Newspaper className="size-4 mr-1.5" /> },
    { key: "ligas", icon: <Building2 className="size-4 mr-1.5" /> },
    { key: "mensagens", icon: <MessageSquare className="size-4 mr-1.5" /> },
    { key: "horarios", icon: <CalIcon className="size-4 mr-1.5" /> },
    { key: "documentos", icon: <FolderOpen className="size-4 mr-1.5" /> },
  ];
  const shown = tabDefs.filter((t) => visible.includes(t.key));

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Início</Link>
          <Badge className="bg-gradient-to-r from-primary to-accent"><Building2 className="size-3 mr-1" /> CAMED</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Painel do CAMED</h1>
        <p className="text-muted-foreground mb-6">Gerencie informações, membros e configurações de ligas.</p>
        <MultiLeagueAlert />
        <Tabs defaultValue={first}>
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 p-1">
            {shown.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="py-2 flex-1 min-w-[7.5rem] whitespace-nowrap">{t.icon}{CAMED_TAB_LABELS[t.key]}</TabsTrigger>
            ))}
          </TabsList>

          {visible.includes("info") && <TabsContent value="info" className="mt-6"><InfoTab /></TabsContent>}
          {visible.includes("membros") && <TabsContent value="membros" className="mt-6"><MembersTab canManageAccess={isCamedPresident || isAdminMaster} /></TabsContent>}
          {visible.includes("noticias") && <TabsContent value="noticias" className="mt-6"><NewsTab /></TabsContent>}
          {visible.includes("ligas") && <TabsContent value="ligas" className="mt-6"><LeaguesSettingsTab /></TabsContent>}
          {visible.includes("mensagens") && <TabsContent value="mensagens" className="mt-6"><MessagesTab /></TabsContent>}
          {visible.includes("horarios") && <TabsContent value="horarios" className="mt-6"><SlotsTab /></TabsContent>}
          {visible.includes("documentos") && (
            <TabsContent value="documentos" className="mt-6 space-y-6">
              <CamedDocumentsTab />
              <CamedCourseDocumentsManager />
              <CamedCourseInfoManager />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

type HistoryItem = { url: string; caption?: string | null; date?: string | null };
function normalizeHistory(raw: any): HistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v: any) => (typeof v === "string" ? { url: v, caption: "", date: "" } : v && typeof v === "object" && v.url ? { url: v.url, caption: v.caption ?? "", date: v.date ?? "" } : null))
    .filter(Boolean) as HistoryItem[];
}

function CamedMaintenanceCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const toggle = useServerFn(setCamedMaintenance);
  useEffect(() => {
    supabase.from("camed_settings").select("maintenance_enabled").eq("id", 1).maybeSingle().then(({ data }) => {
      setEnabled(!!(data as any)?.maintenance_enabled);
    });
  }, []);
  if (enabled === null) return null;
  return (
    <Card className={enabled ? "border-orange-500/40 bg-orange-50 dark:bg-orange-950/20" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`size-10 rounded-xl flex items-center justify-center ${enabled ? "bg-orange-500/20 text-orange-600 dark:text-orange-400" : "bg-muted"}`}>
          <Wrench className="size-5" />
        </div>
        <div className="flex-1">
          <div className="font-black text-sm">Modo manutenção do CAMED</div>
          <div className="text-xs text-muted-foreground">
            {enabled ? "A página pública do CAMED está bloqueada — só membros do painel entram." : "A página pública do CAMED está aberta para todos."}
          </div>
        </div>
        <Button
          variant={enabled ? "destructive" : "default"}
          size="sm"
          onClick={async () => {
            try {
              const next = !enabled;
              await toggle({ data: { enabled: next } });
              setEnabled(next);
              toast.success(next ? "CAMED em manutenção" : "CAMED reaberto ao público");
            } catch (e: any) { toast.error(e?.message); }
          }}
        >
          {enabled ? "Desativar manutenção" : "Ativar manutenção"}
        </Button>
      </CardContent>
    </Card>
  );
}

function WhatsappTestButton() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const { testCamedWhatsapp } = await import("@/lib/camed.functions");
            const r: any = await testCamedWhatsapp();
            if (r?.ok) toast.success("Mensagem de teste enviada no WhatsApp!");
            else toast.error(r?.reason || "Falha ao enviar", { duration: 10000 });
          } catch (e: any) {
            toast.error(e?.message ?? "Falha ao enviar");
          } finally { setLoading(false); }
        }}
      >
        {loading ? "Enviando..." : "Enviar mensagem de teste"}
      </Button>
      <p className="text-xs text-muted-foreground">Salve as informações antes de testar. Se a chave estiver inválida, peça uma nova ao bot no WhatsApp.</p>
    </div>
  );
}

function InfoTab() {
  const [info, setInfo] = useState<any>({ title: "", subtitle: "", description: "", email: "", hero_image_url: "", whatsapp_phone: "", whatsapp_apikey: "", history_title: "Conheça a Nossa História", history_description: "", history_images: [] as HistoryItem[] });
  useEffect(() => {
    supabase.from("camed_info").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      const d = (data as any) ?? {};
      setInfo({
        title: d.title ?? "",
        subtitle: d.subtitle ?? "",
        description: d.description ?? "",
        email: d.email ?? "",
        hero_image_url: d.hero_image_url ?? "",
        whatsapp_phone: d.whatsapp_phone ?? "",
        whatsapp_apikey: d.whatsapp_apikey ?? "",

        history_title: d.history_title ?? "Conheça a Nossa História",
        history_description: d.history_description ?? "",
        history_images: normalizeHistory(d.history_images),
      });
    });
  }, []);
  const email = info.email?.trim() || null;
  async function save() {
    const { error } = await supabase.from("camed_info").update({
      title: info.title,
      subtitle: info.subtitle,
      description: info.description,
      email,
      hero_image_url: info.hero_image_url?.trim() || null,
      whatsapp_phone: info.whatsapp_phone?.trim() || null,
      whatsapp_apikey: info.whatsapp_apikey?.trim() || null,

      history_title: info.history_title || "Conheça a Nossa História",
      history_description: info.history_description || null,
      history_images: info.history_images ?? [],
    } as any).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Informações atualizadas");
  }

  const images: HistoryItem[] = info.history_images ?? [];
  function setImages(next: HistoryItem[]) { setInfo({ ...info, history_images: next }); }
  function updateItem(i: number, patch: Partial<HistoryItem>) {
    setImages(images.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-6">
      <CamedMaintenanceCard />

      <Card><CardHeader><CardTitle>Informações do CAMED</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} /></div>
          <div><Label>Subtítulo</Label><Input value={info.subtitle} onChange={(e) => setInfo({ ...info, subtitle: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={6} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} /></div>
          <div>
            <Label className="flex items-center gap-1.5"><Mail className="size-4" /> E-mail do CAMED</Label>
            <Input type="email" placeholder="camed@exemplo.com" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Para onde o MEDPLEX envia mensagens anônimas e notificações de agendamento.</p>
          </div>
          <div className="pt-2">
            <ImageUpload
              label="Imagem de fundo do cabeçalho"
              folder="camed/hero"
              value={info.hero_image_url ?? ""}
              onChange={(url) => setInfo({ ...info, hero_image_url: url })}
            />
            <p className="text-xs text-muted-foreground mt-1">Preenche toda a faixa verde atrás do título na página do CAMED. Use uma imagem horizontal (recomendado 1920×800).</p>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
            <div>
              <Label className="font-bold">Aviso no WhatsApp do responsável (grátis via CallMeBot)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Como ativar: no WhatsApp do responsável, envie <strong>“I allow callmebot to send me messages”</strong> para o número
                <strong> +34 644 51 95 23</strong>. O bot responde com uma <strong>API key</strong>. Cole o número e a chave abaixo — a cada horário marcado, o responsável recebe a mensagem automaticamente.
              </p>
            </div>
            <div>
              <Label>Número do responsável (com DDI, ex: 5549999999999)</Label>
              <Input inputMode="numeric" placeholder="5549999999999" value={info.whatsapp_phone} onChange={(e) => setInfo({ ...info, whatsapp_phone: e.target.value })} />
            </div>
            <div>
              <Label>API key do CallMeBot</Label>
              <Input placeholder="123456" value={info.whatsapp_apikey} onChange={(e) => setInfo({ ...info, whatsapp_apikey: e.target.value })} />
            </div>
            <WhatsappTestButton />
          </div>


        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5" /> Nossa história</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Título, descrição e fotos exibidas na página pública e na galeria completa do CAMED. Cada foto pode ter uma legenda e uma data.</p>
          <div><Label>Título</Label><Input value={info.history_title} onChange={(e) => setInfo({ ...info, history_title: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={4} value={info.history_description} onChange={(e) => setInfo({ ...info, history_description: e.target.value })} placeholder="Conte a trajetória do CAMED..." /></div>
          <div className="space-y-3">
            <Label>Imagens da galeria</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {images.map((it, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                    <img src={it.url} alt={it.caption || `História ${i + 1}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/70 text-white flex items-center justify-center" aria-label="Remover"><Trash2 className="size-3.5" /></button>
                    <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                      <button type="button" disabled={i === 0} onClick={() => { const a = images.slice(); [a[i-1], a[i]] = [a[i], a[i-1]]; setImages(a); }} className="size-6 rounded-full bg-black/70 text-white text-xs disabled:opacity-30">←</button>
                      <button type="button" disabled={i === images.length - 1} onClick={() => { const a = images.slice(); [a[i], a[i+1]] = [a[i+1], a[i]]; setImages(a); }} className="size-6 rounded-full bg-black/70 text-white text-xs disabled:opacity-30">→</button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Legenda</Label>
                    <Textarea rows={2} value={it.caption ?? ""} onChange={(e) => updateItem(i, { caption: e.target.value })} placeholder="O que essa foto mostra?" />
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={it.date ?? ""} onChange={(e) => updateItem(i, { date: e.target.value })} />
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-dashed p-3 flex items-center justify-center min-h-[220px]">
                <ImageUpload value="" onChange={(url) => { if (url) setImages([...images, { url, caption: "", date: "" }]); }} folder="camed/history" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save}>Salvar tudo</Button>
    </div>
  );
}


function MessagesTab() {
  const [items, setItems] = useState<any[]>([]);
  async function reload() {
    const { data } = await supabase.from("camed_messages").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { reload(); }, []);
  async function del(id: string) {
    if (!confirm("Excluir mensagem?")) return;
    await supabase.from("camed_messages").delete().eq("id", id);
    reload();
  }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="size-5" /> Mensagens anônimas recebidas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
        {items.map((m) => (
          <div key={m.id} className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/30 dark:to-background p-4">
            <div className="flex justify-between items-center mb-2">
              <Badge variant="secondary" className="text-[10px]">{new Date(m.created_at).toLocaleString("pt-BR")}</Badge>
              <Button size="sm" variant="ghost" onClick={() => del(m.id)}><Trash2 className="size-3.5" /></Button>
            </div>
            <p className="text-sm whitespace-pre-wrap italic text-emerald-900 dark:text-emerald-100">“{m.message}”</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SlotsTab() {
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Record<string, any>>({});
  const [open, setOpen] = useState(false);
  const [viewBooking, setViewBooking] = useState<any | null>(null);
  const [f, setF] = useState({ date: "", time: "", allow_online: true, allow_in_person: true, attendant_name: "" });

  async function reload() {
    const { data } = await supabase.from("camed_slots").select("*").order("slot_at");
    setSlots(data ?? []);
    const { data: bks } = await supabase.from("camed_bookings").select("*");
    const userIds = Array.from(new Set((bks ?? []).map((b: any) => b.user_id).filter(Boolean)));
    const profMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, username, email").in("id", userIds);
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
    }
    const m: Record<string, any> = {};
    (bks ?? []).forEach((b: any) => { m[b.slot_id] = { ...b, profiles: profMap[b.user_id] ?? null }; });
    setBookings(m);
  }
  useEffect(() => { reload(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.date || !f.time) return toast.error("Defina data e horário");
    if (!f.allow_online && !f.allow_in_person) return toast.error("Selecione ao menos uma modalidade");
    const dt = new Date(`${f.date}T${f.time}:00`);
    const { error } = await supabase.from("camed_slots").insert({
      slot_at: dt.toISOString(),
      allow_online: f.allow_online,
      allow_in_person: f.allow_in_person,
      attendant_name: f.attendant_name || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Horário criado");
    setOpen(false);
    setF({ date: "", time: "", allow_online: true, allow_in_person: true, attendant_name: "" });
    reload();
  }

  async function del(id: string) {
    if (!confirm("Excluir este horário? Eventual agendamento também será removido.")) return;
    await supabase.from("camed_slots").delete().eq("id", id);
    reload();
  }

  const upcoming = slots.filter((s) => new Date(s.slot_at) > new Date());
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><CalIcon className="size-5" /> Horários semanais</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Novo horário</Button>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário cadastrado. Use "Novo horário" para abrir slots da semana.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {upcoming.map((s) => {
              const bk = bookings[s.id];
              const dt = new Date(s.slot_at);
              return (
                <div key={s.id} className={`rounded-xl border p-4 ${bk ? "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20" : "border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={bk ? "bg-amber-500" : "bg-emerald-500"}>{bk ? "Agendado" : "Disponível"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => del(s.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                  <div className="mt-2 font-black">{dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock className="size-3.5" /> {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {s.allow_online && <Badge variant="outline" className="text-[10px]"><Video className="size-3 mr-1" />Online</Badge>}
                    {s.allow_in_person && <Badge variant="outline" className="text-[10px]"><MapPin className="size-3 mr-1" />Presencial</Badge>}
                  </div>
                  {s.attendant_name && <div className="text-xs text-muted-foreground mt-2">Atendente: <b>{s.attendant_name}</b></div>}
                  {bk && (
                    <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => setViewBooking({ ...bk, slot: s })}><Eye className="size-3.5" /> Ver informações</Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo horário</DialogTitle></DialogHeader>
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-100">
            ℹ️ Os horários são resetados toda semana às <b>20h de sábado</b>. Horários devem ser marcados com pelo menos <b>24 horas de antecedência</b>.
          </div>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              <div><Label>Horário</Label><Input type="time" required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
            </div>
            <div className="space-y-2 p-3 rounded-lg border">
              <Label>Modalidades aceitas</Label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_online} onCheckedChange={(v) => setF({ ...f, allow_online: !!v })} /> <Video className="size-4" /> Online</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.allow_in_person} onCheckedChange={(v) => setF({ ...f, allow_in_person: !!v })} /> <MapPin className="size-4" /> Presencial</label>
            </div>
            <div>
              <Label>Quem irá atender (opcional)</Label>
              <Input placeholder="Ex.: João Silva (Presidente)" value={f.attendant_name} onChange={(e) => setF({ ...f, attendant_name: e.target.value })} />
            </div>
            <DialogFooter><Button type="submit">Criar horário</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do agendamento</DialogTitle></DialogHeader>
          {viewBooking && (
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-muted">
                <div className="font-black">{new Date(viewBooking.slot.slot_at).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}</div>
                <Badge variant="secondary" className="mt-1">{viewBooking.modality === "online" ? "Online" : "Presencial"}</Badge>
              </div>
              <div><b>Quem marcou:</b> {viewBooking.profiles?.full_name || viewBooking.profiles?.username || "—"}<br /><span className="text-muted-foreground text-xs">{viewBooking.profiles?.email}</span></div>
              <div><b>Motivo:</b> <p className="text-muted-foreground">{viewBooking.reason}</p></div>
              {viewBooking.extra_participants && <div><b>Outros participantes:</b> <p className="text-muted-foreground">{viewBooking.extra_participants}</p></div>}
              <div>
                <b>WhatsApp:</b> {viewBooking.phone}{" "}
                <Button asChild size="sm" variant="outline" className="ml-2">
                  <a href={`https://wa.me/${viewBooking.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Phone className="size-3.5" /> Abrir</a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersTab({ canManageAccess = false }: { canManageAccess?: boolean }) {
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const blank = { name: "", role: "", description: "", image_url: "", display_order: 0 };
  const [f, setF] = useState<any>(blank);
  async function reload() {
    const { data } = await supabase.from("camed_members").select("*").order("display_order");
    setMembers(data ?? []);
  }
  useEffect(() => { reload(); }, []);
  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(m: any) { setEditing(m); setF({ ...m, image_url: m.image_url ?? "", description: m.description ?? "" }); setOpen(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, image_url: f.image_url || null };
    const { error } = editing
      ? await supabase.from("camed_members").update(payload).eq("id", editing.id)
      : await supabase.from("camed_members").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setOpen(false); reload();
  }
  const deleteFiles = useServerFn(deleteStorageFiles);
  async function del(id: string) {
    if (!confirm("Excluir membro?")) return;
    const m = members.find((x: any) => x.id === id);
    const { error } = await supabase.from("camed_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (m?.image_url) { try { await deleteFiles({ data: { paths: [m.image_url] } }); } catch {} }
    reload();
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Membros</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> Novo</Button>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="aspect-square rounded-lg bg-muted mb-3 overflow-hidden">
                  {m.image_url && <img src={m.image_url} className="w-full h-full object-cover" />}
                </div>
                <Badge variant="secondary">{m.role}</Badge>
                <h4 className="font-black mt-2">{m.name}</h4>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}><Edit className="size-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => del(m.id)}><Trash2 className="size-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar membro" : "Novo membro"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input required value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><ImageUpload label="Imagem" folder="camed-members" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: +e.target.value })} /></div>
            <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {canManageAccess && <CamedPanelAccessSection />}
    </Card>
  );
}

function CamedPanelAccessSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<CamedTab[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function reload() {
    const { data } = await (supabase as any).from("camed_panel_access").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { reload(); }, []);

  function toggle(k: CamedTab) {
    setPerms((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const target = editing?.email?.trim() || email.trim();
    if (!target) return toast.error("Informe o e-mail");
    if (perms.length === 0) return toast.error("Selecione ao menos uma aba");
    const { error } = await (supabase as any).from("camed_panel_access").upsert(
      { email: target, permissions: perms, updated_at: new Date().toISOString() },
      { onConflict: "email" }
    );
    if (error) return toast.error(error.message);
    toast.success(editing ? "Permissões atualizadas" : "Acesso concedido");
    setEmail(""); setPerms([]); setEditing(null);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Revogar acesso ao painel?")) return;
    const { error } = await (supabase as any).from("camed_panel_access").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  function beginEdit(r: any) {
    setEditing(r); setEmail(r.email);
    setPerms((r.permissions ?? []).filter((k: string): k is CamedTab => (ALL_CAMED_TABS_LIST as readonly string[]).includes(k)));
  }

  return (
    <div className="border-t p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-primary" />
        <h3 className="font-black">Adicionar acesso ao Painel do CAMED</h3>
      </div>
      <p className="text-xs text-muted-foreground">Conceda acesso parcial ao painel para pessoas registradas no site. A pessoa verá apenas as abas selecionadas.</p>
      <form onSubmit={save} className="space-y-3 p-4 rounded-lg border bg-muted/30">
        <div>
          <Label>E-mail cadastrado no site</Label>
          <Input type="email" required disabled={!!editing} value={editing?.email ?? email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" />
        </div>
        <div>
          <Label>Abas liberadas</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
            {ALL_CAMED_TABS_LIST.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm p-2 rounded border bg-background cursor-pointer">
                <Checkbox checked={perms.includes(k)} onCheckedChange={() => toggle(k)} />
                {CAMED_TAB_LABELS[k]}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{editing ? "Salvar alterações" : "Conceder acesso"}</Button>
          {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setEmail(""); setPerms([]); }}>Cancelar</Button>}
        </div>
      </form>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-muted-foreground italic">Ninguém adicionado ainda.</p>}
        {rows.map((r) => (
          <div key={r.id} className="p-3 rounded border flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold truncate">{r.email}</div>
              <div className="flex gap-1 flex-wrap mt-1">
                {(r.permissions ?? []).map((k: string) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">{CAMED_TAB_LABELS[k as CamedTab] ?? k}</Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => beginEdit(r)}><Edit className="size-3" /></Button>
              <Button size="sm" variant="destructive" onClick={() => remove(r.id)}><Trash2 className="size-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaguesSettingsTab() {
  const [s, setS] = useState({ league_registration_fee: 0, semestrality_fee: 0 });
  const [leagues, setLeagues] = useState<any[]>([]);
  const [pointsByLeague, setPointsByLeague] = useState<Record<string, any[]>>({});
  const [presidents, setPresidents] = useState<Record<string, any>>({});
  const [addOpen, setAddOpen] = useState<any | null>(null);
  const [histOpen, setHistOpen] = useState<Record<string, boolean>>({});
  const [addF, setAddF] = useState({ points: 0, description: "" });

  async function loadSettings() {
    const { data } = await supabase.from("camed_settings").select("*").eq("id", 1).maybeSingle();
    if (data) setS({ league_registration_fee: Number((data as any).league_registration_fee) || 0, semestrality_fee: Number((data as any).semestrality_fee) || 0 });
  }
  async function loadLeagues() {
    const { data: lg } = await supabase.from("leagues").select("id, name, slug, theme_color, icon_url, president_id");
    setLeagues(lg ?? []);
    const ids = (lg ?? []).map((l: any) => l.president_id).filter(Boolean);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, full_name, email").in("id", ids);
      const pm: Record<string, any> = {}; (profs ?? []).forEach((p: any) => pm[p.id] = p);
      setPresidents(pm);
    }
    const { data: pts } = await supabase.from("league_points").select("*").order("created_at", { ascending: false });
    const map: Record<string, any[]> = {};
    (pts ?? []).forEach((p: any) => { (map[p.league_id] ||= []).push(p); });
    setPointsByLeague(map);
  }
  useEffect(() => { loadSettings(); loadLeagues(); }, []);

  async function saveSettings() {
    const { error } = await supabase.from("camed_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  }

  async function addPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!addOpen) return;
    if (!addF.description.trim()) return toast.error("Informe uma descrição");
    if (!addF.points) return toast.error("Informe quantos pontos");
    const { error } = await supabase.from("league_points").insert({ league_id: addOpen.id, points: addF.points, description: addF.description.trim() });
    if (error) return toast.error(error.message);
    toast.success(`+${addF.points} pontos para ${addOpen.name}`);
    setAddOpen(null); setAddF({ points: 0, description: "" });
    loadLeagues();
  }

  async function removePoints(id: string) {
    if (!confirm("Remover esta pontuação? Os pontos serão descontados.")) return;
    const { error } = await supabase.from("league_points").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadLeagues();
  }

  const ranked = leagues
    .map((l) => ({ ...l, total: (pointsByLeague[l.id] ?? []).reduce((sum, p) => sum + p.points, 0) }))
    .sort((a, b) => b.total - a.total);

  function rankStyle(pos: number) {
    if (pos === 0) return { border: "border-yellow-400/70", bg: "bg-gradient-to-br from-yellow-50 to-amber-100/40 dark:from-yellow-950/40 dark:to-amber-900/20", icon: <Crown className="size-5 text-yellow-600" />, badge: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white" };
    if (pos === 1) return { border: "border-slate-400/70", bg: "bg-gradient-to-br from-slate-50 to-zinc-100/40 dark:from-slate-900/40 dark:to-zinc-800/20", icon: <Medal className="size-5 text-slate-500" />, badge: "bg-gradient-to-r from-slate-400 to-zinc-400 text-white" };
    if (pos === 2) return { border: "border-orange-400/70", bg: "bg-gradient-to-br from-orange-50 to-amber-100/40 dark:from-orange-950/40 dark:to-amber-900/20", icon: <Trophy className="size-5 text-orange-600" />, badge: "bg-gradient-to-r from-orange-500 to-amber-600 text-white" };
    return { border: "border-border", bg: "bg-card", icon: <Building2 className="size-5 text-muted-foreground" />, badge: "bg-muted text-foreground" };
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="size-5 text-yellow-600" /> Classificação das Ligas</CardTitle>
          <p className="text-sm text-muted-foreground">Ordenadas pela pontuação total atribuída pelo CAMED.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {ranked.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma liga cadastrada ainda.</p>}
          {ranked.map((l, idx) => {
            const st = rankStyle(idx);
            const pres = l.president_id ? presidents[l.president_id] : null;
            const history = pointsByLeague[l.id] ?? [];
            const open = !!histOpen[l.id];
            return (
              <div key={l.id} className={`rounded-2xl border-2 ${st.border} ${st.bg} overflow-hidden transition-all`}>
                <div className="p-4 flex items-center gap-3 flex-wrap">
                  <div className={`flex items-center justify-center size-12 rounded-xl font-black text-lg ${st.badge}`}>
                    {idx + 1}°
                  </div>
                  <div className="size-12 rounded-xl flex items-center justify-center text-white font-black overflow-hidden shrink-0" style={{ background: l.theme_color }}>
                    {l.icon_url ? <img src={l.icon_url} className="size-full object-cover" /> : l.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      {st.icon}
                      <h4 className="font-black text-base sm:text-lg">{l.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">Presidente: <span className="font-semibold text-foreground">{pres?.full_name || pres?.username || "—"}</span></p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black tabular-nums">{l.total}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pontos</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => { setAddOpen(l); setAddF({ points: 0, description: "" }); }}><Plus className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setHistOpen((p) => ({ ...p, [l.id]: !p[l.id] }))}>
                      <History className="size-4" /> {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </Button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-border/50 bg-background/60 p-4 space-y-2">
                    <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Histórico de pontuação</div>
                    {history.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhuma pontuação atribuída ainda.</p>}
                    {history.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{h.description}</div>
                          <div className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                        </div>
                        <Badge className={h.points >= 0 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                          {h.points >= 0 ? "+" : ""}{h.points}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => removePoints(h.id)}><Trash2 className="size-3.5 text-rose-600" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!addOpen} onOpenChange={(o) => !o && setAddOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar pontos — {addOpen?.name}</DialogTitle></DialogHeader>
          <form onSubmit={addPoints} className="space-y-3">
            <div>
              <Label>Pontos a adicionar</Label>
              <Input type="number" required value={addF.points} onChange={(e) => setAddF({ ...addF, points: +e.target.value })} placeholder="Use número negativo para descontar" />
              <p className="text-xs text-muted-foreground mt-1">Use número negativo para descontar pontos.</p>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} required value={addF.description} onChange={(e) => setAddF({ ...addF, description: e.target.value })} placeholder="Ex.: Participação no evento X" />
            </div>
            <DialogFooter><Button type="submit">Adicionar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CamedScoringApprovals onChanged={loadLeagues} />

      <CamedOpenActivities />

      <details className="rounded-xl border bg-card/50">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2">
          <SettingsIcon className="size-4" /> Valores padrão das ligas
        </summary>
        <div className="p-4 pt-0 space-y-4">
          <div>
            <Label className="text-xs">Taxa de inscrição na prova de seleção (R$)</Label>
            <Input type="number" step="0.01" min="0" value={s.league_registration_fee} onChange={(e) => setS({ ...s, league_registration_fee: +e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">Valor cobrado de candidatos. Aplica-se a todas as ligas.</p>
          </div>
          <div>
            <Label className="text-xs">Semestralidade padrão (R$)</Label>
            <Input type="number" step="0.01" min="0" value={s.semestrality_fee} onChange={(e) => setS({ ...s, semestrality_fee: +e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">Valor de referência (sem cobrança automática).</p>
          </div>
          <Button size="sm" onClick={saveSettings}>Salvar valores padrão</Button>
        </div>
      </details>
    </div>
  );
}

function MultiLeagueAlert() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from("league_memberships")
        .select("user_id, league_id, role, leagues(name), profiles(full_name, username, cpf, registration_number, email)")
        .in("role", ["ligante", "diretor", "presidente"]);
      const byUser = new Map<string, any>();
      (m ?? []).forEach((row: any) => {
        const u = byUser.get(row.user_id) ?? { user_id: row.user_id, profile: row.profiles, leagues: [] };
        u.leagues.push(row.leagues?.name ?? "—");
        byUser.set(row.user_id, u);
      });
      setItems(Array.from(byUser.values()).filter((u: any) => u.leagues.length > 3));
    })();
  }, []);

  if (items.length === 0) return null;
  return (
    <>
      <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 text-amber-600" />
            <div className="text-sm">
              <div className="font-black text-amber-700 dark:text-amber-400">Existem {items.length} membro(s) em mais de 3 ligas</div>
              <div className="text-muted-foreground">Verifique a situação para garantir o cumprimento do regulamento do CAMED.</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Verificar</Button>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Membros em mais de 3 ligas</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {items.map((it: any) => (
              <div key={it.user_id} className="p-3 rounded border">
                <div className="font-bold">{it.profile?.full_name || it.profile?.username || "Membro"}</div>
                <div className="text-xs text-muted-foreground">
                  {it.profile?.email}
                  {it.profile?.cpf ? ` · CPF ${it.profile.cpf}` : ""}
                  {it.profile?.registration_number ? ` · Matrícula ${it.profile.registration_number}` : ""}
                </div>
                <div className="text-sm mt-1"><b>Ligas ({it.leagues.length}):</b> {it.leagues.join(", ")}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewsTab() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const blank = { title: "", excerpt: "", image_url: "", category: "Geral", link: "" };
  const [f, setF] = useState<any>(blank);
  const deleteFiles = useServerFn(deleteStorageFiles);
  async function reload() {
    const { data } = await supabase.from("camed_news" as any).select("*").order("created_at", { ascending: false });
    setList((data as any[]) ?? []);
  }
  useEffect(() => { reload(); }, []);
  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(n: any) { setEditing(n); setF({ title: n.title, excerpt: n.excerpt ?? "", image_url: n.image_url ?? "", category: n.category ?? "Geral", link: n.link ?? "" }); setOpen(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { title: f.title, excerpt: f.excerpt || null, image_url: f.image_url || null, category: f.category || "Geral", link: f.link || null };
    const { error } = editing
      ? await supabase.from("camed_news" as any).update(payload).eq("id", editing.id)
      : await supabase.from("camed_news" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Notícia atualizada" : "Notícia publicada");
    setOpen(false); reload();
  }
  async function del(id: string) {
    if (!confirm("Excluir notícia?")) return;
    const n = list.find((x: any) => x.id === id);
    const { error } = await supabase.from("camed_news" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (n?.image_url) { try { await deleteFiles({ data: { paths: [n.image_url] } }); } catch {} }
    reload();
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Newspaper className="size-5" /> Notícias do CAMED</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="size-4" /> Nova notícia</Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma notícia publicada ainda.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((n) => (
            <div key={n.id} className="rounded-xl border p-4 flex gap-3">
              {n.image_url && <img src={n.image_url} className="size-20 rounded object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{n.category ?? "Geral"}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <h4 className="font-black mt-1 truncate">{n.title}</h4>
                {n.excerpt && <p className="text-xs text-muted-foreground line-clamp-2">{n.excerpt}</p>}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(n)}><Edit className="size-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => del(n.id)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar notícia" : "Nova notícia"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
            <div><Label>Resumo</Label><Textarea rows={4} value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></div>
            <div><ImageUpload label="Imagem" folder="camed-news" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></div>
            <div><Label>Link externo (opcional)</Label><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div>
            <DialogFooter><Button type="submit">{editing ? "Salvar" : "Publicar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
