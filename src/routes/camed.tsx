import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CamedCourseDocsSection } from "@/components/camed-course-docs-public";
import { Building2, MessageSquare, Users as UsersIcon, Calendar as CalIcon, Clock, Video, MapPin, Lock, Send, BookOpen, Newspaper, ExternalLink, ArrowRight, Images } from "lucide-react";

type HistoryItem = { url: string; caption?: string | null; date?: string | null };
function normalizeHistory(raw: any): HistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v: any) => (typeof v === "string" ? { url: v } : v && typeof v === "object" && v.url ? v : null))
    .filter(Boolean) as HistoryItem[];
}

export const Route = createFileRoute("/camed")({
  head: () => ({
    meta: [
      { title: "CAMED — MEDHUB" },
      { name: "description", content: "Centro Acadêmico de Medicina da Unochapecó — conheça os membros, envie mensagens anônimas e agende horários." },
      { property: "og:title", content: "CAMED — MEDHUB" },
      { property: "og:description", content: "Conheça a equipe, envie mensagens anônimas e agende horários com o CAMED." },
    ],
  }),
  component: CamedPublicPage,
});

function CamedPublicPage() {
  const [info, setInfo] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const { camedPanelTabs, isAdminMaster, isCamedPresident, loading: authLoading } = useAuth();
  useEffect(() => {
    supabase.from("camed_info").select("*").eq("id", 1).maybeSingle().then(({ data }) => setInfo(data));
    supabase.from("camed_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setSettings(data));
  }, []);

  const inMaintenance = !!(settings as any)?.maintenance_enabled;
  const hasCamedAccess = isAdminMaster || isCamedPresident || (camedPanelTabs?.length ?? 0) > 0;
  const blocked = inMaintenance && !hasCamedAccess && !authLoading;

  if (blocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="size-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30">
            <Building2 className="size-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">CAMED em Manutenção</h1>
          <p className="text-sm text-muted-foreground">
            O Centro Acadêmico está atualizando esta área. Voltaremos em breve.
          </p>
          <Button asChild variant="outline"><Link to="/">Voltar ao início</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* HERO com ações principais integradas */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white">
        {info?.hero_image_url && (
          <>
            <img
              src={info.hero_image_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/90 via-emerald-900/80 to-teal-900/80" />
          </>
        )}
        <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-20">
          <Badge className="bg-white/15 border-white/20 backdrop-blur"><Building2 className="size-3 mr-1" /> Centro Acadêmico</Badge>

          <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tighter">{info?.title || "CAMED"}</h1>
          {info?.subtitle && <p className="mt-2 text-lg md:text-xl text-white/85 font-medium">{info.subtitle}</p>}
          {info?.description && (
            <p className="mt-6 max-w-3xl text-sm md:text-base text-white/80 whitespace-pre-line leading-relaxed">{info.description}</p>
          )}

        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-12 space-y-16">
        <div className="flex flex-wrap gap-3">
          <BookingDialog />
          <AnonymousMessageDialog />
        </div>
        <NewsSection />

        <CamedCourseDocsSection />
        <OpenActivitiesSection />
        <HistoryShowcase info={info} />
        <MembersSection />
      </main>
      <NotOfficialNotice />
    </div>

  );
}


function OpenActivitiesSection() {
  const [items, setItems] = useState<any[]>([]);
  const [leaguesMap, setLeaguesMap] = useState<Record<string, { name: string; icon_url: string | null; slug: string }>>({});
  const [visible, setVisible] = useState(3);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("league_activities") as any)
        .select("id, title, description, image_url, participating_league_ids, league_id, created_at")
        .eq("is_open", true)
        .order("created_at", { ascending: false })
        .limit(12);
      const acts = (data as any[]) ?? [];
      setItems(acts);
      const ids = new Set<string>();
      acts.forEach((a) => { ids.add(a.league_id); (a.participating_league_ids ?? []).forEach((x: string) => ids.add(x)); });
      if (ids.size > 0) {
        const { data: ls } = await supabase.from("leagues").select("id,name,icon_url,slug").in("id", Array.from(ids));
        const map: Record<string, any> = {};
        (ls ?? []).forEach((l: any) => { map[l.id] = l; });
        setLeaguesMap(map);
      }
    })();
  }, []);
  if (items.length === 0) return null;
  const shown = items.slice(0, visible);
  const canExpand = visible < items.length;
  const canCollapse = visible > 3;
  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
        <UsersIcon className="size-6 text-emerald-600" /> Atividades abertas das ligas
      </h2>
      <p className="text-sm text-muted-foreground mb-6">Atividades interligas abertas a toda comunidade acadêmica.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((a) => {
          const host = leaguesMap[a.league_id];
          const partners = (a.participating_league_ids ?? []).map((id: string) => leaguesMap[id]).filter(Boolean);
          const all = [host, ...partners].filter(Boolean);
          return (
            <Card key={a.id} className="overflow-hidden hover:shadow-md transition-shadow border-emerald-200/40 dark:border-emerald-900/30">
              {a.image_url && (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4">
                {all.length > 0 && (
                  <div className="flex items-center -space-x-2 mb-2">
                    {all.slice(0, 6).map((l: any, i: number) => (
                      l.icon_url
                        ? <img key={i} src={l.icon_url} title={l.name} alt={l.name} className="size-7 rounded-full ring-2 ring-background object-cover bg-muted" />
                        : <div key={i} title={l.name} className="size-7 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-bold">{l.name?.[0]}</div>
                    ))}
                    {all.length > 6 && <span className="ml-3 text-[10px] text-muted-foreground">+{all.length - 6}</span>}
                  </div>
                )}
                <h4 className="font-black leading-tight">{a.title}</h4>
                {a.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3 whitespace-pre-line">{a.description}</p>}
                {all.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2 truncate">
                    Ligas: {all.map((l: any) => l.name).join(" · ")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {(canExpand || canCollapse) && (
        <div className="flex justify-center gap-2 mt-6">
          {canExpand && (
            <Button variant="outline" onClick={() => setVisible((v) => Math.min(v + 6, items.length))}>
              Ver mais
            </Button>
          )}
          {canCollapse && (
            <Button variant="ghost" onClick={() => setVisible((v) => Math.max(3, v - 6))}>
              Esconder mais
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function HistoryShowcase({ info }: { info: any }) {
  const allImages = useMemo<HistoryItem[]>(() => normalizeHistory(info?.history_images), [info]);
  const title: string = info?.history_title || "Conheça a Nossa História";
  const description: string | null = info?.history_description ?? null;
  const years = useMemo(() => {
    const s = new Set<number>();
    allImages.forEach((it) => {
      if (it.date) {
        const y = new Date(it.date).getFullYear();
        if (!isNaN(y)) s.add(y);
      }
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [allImages]);
  const [year, setYear] = useState<number | "all">("all");
  const images = useMemo(
    () => (year === "all" ? allImages : allImages.filter((it) => it.date && new Date(it.date).getFullYear() === year)),
    [allImages, year],
  );
  if (!info) return null;
  if (allImages.length === 0 && !description) return null;
  const track = images.length > 0 ? [...images, ...images] : [];
  return (
    <section className="rounded-2xl overflow-hidden border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-b from-emerald-50/60 to-white dark:from-emerald-950/30 dark:to-background">
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold mb-4 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30">
          <BookOpen className="size-3.5" /> Nossa história
        </div>
        <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-4">{title}</h2>
        {description && (
          <p className="text-sm md:text-base text-muted-foreground whitespace-pre-line leading-relaxed">{description}</p>
        )}
        {years.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setYear("all")}
              className={`px-3 h-8 rounded-full text-xs font-bold uppercase tracking-widest border transition ${year === "all" ? "bg-emerald-600 text-white border-emerald-600" : "bg-transparent text-muted-foreground border-emerald-600/30 hover:bg-emerald-600/10"}`}
            >
              Todos
            </button>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`px-3 h-8 rounded-full text-xs font-bold uppercase tracking-widest border transition ${year === y ? "bg-emerald-600 text-white border-emerald-600" : "bg-transparent text-muted-foreground border-emerald-600/30 hover:bg-emerald-600/10"}`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
        {images.length > 0 && (
          <div className="mt-6">
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link to="/camed-galeria"><Images className="size-4 mr-1.5" /> Expandir galeria completa <ArrowRight className="size-4 ml-1" /></Link>
            </Button>
          </div>
        )}
      </div>
      {images.length > 0 && (
        <div className="relative overflow-hidden pb-8">
          <div className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, var(--background), transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, var(--background), transparent)" }} />
          <div className="flex gap-4 w-max" style={{ animation: `camed-history-marquee ${Math.max(20, images.length * 6)}s linear infinite` }}>
            {track.map((it, i) => (
              <div key={i} className="relative shrink-0 w-72 md:w-96 aspect-[4/3] rounded-xl overflow-hidden border border-emerald-200/60 dark:border-emerald-900/40 bg-muted shadow-xl">
                <img src={it.url} alt={it.caption || "História do CAMED"} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <style>{`@keyframes camed-history-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        </div>
      )}
    </section>
  );
}


function NewsSection() {
  const [items, setItems] = useState<any[]>([]);
  const [visible, setVisible] = useState(3);
  useEffect(() => {
    supabase.from("camed_news" as any).select("*").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setItems((data as any[]) ?? []));
  }, []);
  if (items.length === 0) return null;
  const shown = items.slice(0, visible);
  const canExpand = visible < items.length;
  const canCollapse = visible > 3;
  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
        <Newspaper className="size-6 text-emerald-600" /> Notícias
      </h2>
      <p className="text-sm text-muted-foreground mb-6">Últimas publicações do Centro Acadêmico.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((n) => {
          const body = (
            <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow border-emerald-200/50 dark:border-emerald-900/40">
              {n.image_url && (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img src={n.image_url} alt={n.title} className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{n.category ?? "Geral"}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <h4 className="font-black mt-2 leading-tight flex items-start gap-1.5">
                  <span className="flex-1">{n.title}</span>
                  {n.link && <ExternalLink className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />}
                </h4>
                {n.excerpt && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3 whitespace-pre-line">{n.excerpt}</p>}
              </CardContent>
            </Card>
          );
          return n.link ? (
            <a key={n.id} href={n.link} target="_blank" rel="noopener noreferrer" className="block">{body}</a>
          ) : (
            <div key={n.id}>{body}</div>
          );
        })}
      </div>
      {(canExpand || canCollapse) && (
        <div className="flex justify-center gap-2 mt-6">
          {canExpand && (
            <Button variant="outline" onClick={() => setVisible((v) => Math.min(v + 6, items.length))}>
              Ver mais
            </Button>
          )}
          {canCollapse && (
            <Button variant="ghost" onClick={() => setVisible((v) => Math.max(3, v - 6))}>
              Esconder mais
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function MembersSection() {
  const [members, setMembers] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("camed_members").select("*").order("display_order").then(({ data }) => setMembers(data ?? []));
  }, []);
  if (members.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
        <UsersIcon className="size-6 text-primary" /> Nossos membros
      </h2>
      <p className="text-sm text-muted-foreground mb-6">Conheça quem está por trás do Centro Acadêmico.</p>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {members.map((m) => (
          <Card key={m.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-square bg-muted overflow-hidden">
              {m.image_url && <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />}
            </div>
            <CardContent className="p-4">
              <Badge variant="secondary" className="text-[10px]">{m.role}</Badge>
              <h4 className="font-black mt-2 leading-tight">{m.name}</h4>
              {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{m.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function AnonymousMessageDialog() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  async function send() {
    const text = msg.trim();
    if (text.length < 3) return toast.error("Escreva sua mensagem");
    setSending(true);
    const { error } = await supabase.from("camed_messages").insert({ message: text });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Mensagem enviada anonimamente");
    setMsg("");
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="border-emerald-700/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
          <MessageSquare className="size-4 mr-1.5" /> Mensagem anônima
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="size-5 text-emerald-600" /> Mensagem anônima</DialogTitle>
          <DialogDescription>Sua mensagem é enviada de forma <b>totalmente anônima</b>. Nenhum dado pessoal é armazenado junto com ela.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground flex items-start gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 p-3">
            <Lock className="size-3.5 mt-0.5 shrink-0" />
            <span>Envie sugestões, elogios ou críticas sem se identificar.</span>
          </div>
          <Textarea rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escreva o que quiser contar ao CAMED..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={send} disabled={sending}><Send className="size-4 mr-1.5" /> Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingDialog() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<any | null>(null);
  const [form, setForm] = useState({ modality: "presencial" as "presencial" | "online", reason: "", phone: "", extra: "" });

  async function reload() {
    const nowIso = new Date().toISOString();
    const { data: s } = await supabase.from("camed_slots").select("*").gt("slot_at", nowIso).order("slot_at");
    setSlots(s ?? []);
    const { data: b } = await supabase.from("camed_bookings").select("slot_id");
    setBusy(new Set((b ?? []).map((x: any) => x.slot_id)));
  }
  useEffect(() => { if (open) reload(); }, [open]);

  const available = useMemo(() => slots.filter((s) => !busy.has(s.id)), [slots, busy]);

  async function book() {
    if (!user) return toast.error("Faça login para agendar");
    if (!picked) return;
    if (!form.reason.trim()) return toast.error("Descreva o motivo");
    if (!form.phone.trim()) return toast.error("Informe seu WhatsApp");
    const modality = form.modality;
    if (modality === "online" && !picked.allow_online) return toast.error("Este horário não aceita online");
    if (modality === "presencial" && !picked.allow_in_person) return toast.error("Este horário não aceita presencial");
    const { error } = await supabase.from("camed_bookings").insert({
      slot_id: picked.id,
      user_id: user.id,
      modality,
      reason: form.reason.trim(),
      phone: form.phone.trim(),
      extra_participants: form.extra.trim() || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Agendamento confirmado");
    setPicked(null);
    setForm({ modality: "presencial", reason: "", phone: profile?.phone ?? "", extra: "" });
    setOpen(false);
    reload();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="bg-emerald-700 text-white hover:bg-emerald-800 shadow-md">
            <CalIcon className="size-4 mr-1.5" /> Agendar horário
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalIcon className="size-5 text-primary" /> Agendar horário com o CAMED</DialogTitle>
            <DialogDescription>Escolha um horário disponível abaixo.</DialogDescription>
          </DialogHeader>
          {!user && (
            <div className="text-xs rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3">
              <Lock className="size-3.5 inline mr-1" /> Faça <Link to="/auth" className="underline font-semibold">login</Link> para agendar um atendimento.
            </div>
          )}
          {available.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum horário disponível no momento.</p>}
          <div className="grid sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
            {available.map((s) => {
              const dt = new Date(s.slot_at);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!user}
                  onClick={() => { setPicked(s); setForm((f) => ({ ...f, modality: s.allow_in_person ? "presencial" : "online", phone: profile?.phone ?? "" })); }}
                  className="text-left rounded-xl border border-emerald-400/40 hover:border-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 p-3 transition disabled:opacity-50"
                >
                  <div className="text-xs opacity-70 capitalize">{dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}</div>
                  <div className="font-black flex items-center gap-1.5"><Clock className="size-3.5" /> {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="flex gap-1.5 mt-1.5">
                    {s.allow_online && <Badge variant="outline" className="text-[10px]"><Video className="size-3 mr-1" />Online</Badge>}
                    {s.allow_in_person && <Badge variant="outline" className="text-[10px]"><MapPin className="size-3 mr-1" />Presencial</Badge>}
                  </div>
                  {s.attendant_name && <div className="text-[11px] text-muted-foreground mt-1">Atendente: <b>{s.attendant_name}</b></div>}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar agendamento</DialogTitle></DialogHeader>
          {picked && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="font-black capitalize">{new Date(picked.slot_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
                <div className="text-muted-foreground">{new Date(picked.slot_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div>
                <Label>Modalidade</Label>
                <div className="flex gap-2 mt-1">
                  {picked.allow_in_person && (
                    <button type="button" onClick={() => setForm({ ...form, modality: "presencial" })}
                      className={`flex-1 rounded-lg border p-2 text-sm ${form.modality === "presencial" ? "border-primary bg-primary/10" : ""}`}>
                      <MapPin className="size-4 inline mr-1" /> Presencial
                    </button>
                  )}
                  {picked.allow_online && (
                    <button type="button" onClick={() => setForm({ ...form, modality: "online" })}
                      className={`flex-1 rounded-lg border p-2 text-sm ${form.modality === "online" ? "border-primary bg-primary/10" : ""}`}>
                      <Video className="size-4 inline mr-1" /> Online
                    </button>
                  )}
                </div>
              </div>
              <div><Label>Motivo</Label><Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="O que você gostaria de tratar?" /></div>
              <div><Label>WhatsApp para contato</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" /></div>
              <div><Label>Outros participantes (opcional)</Label><Input value={form.extra} onChange={(e) => setForm({ ...form, extra: e.target.value })} placeholder="Nomes de quem virá junto" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicked(null)}>Cancelar</Button>
            <Button onClick={book}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
