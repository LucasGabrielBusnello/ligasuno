import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, MessageSquare, Users as UsersIcon, Calendar as CalIcon, Clock, Video, MapPin, Lock, Send } from "lucide-react";

export const Route = createFileRoute("/camed")({
  head: () => ({
    meta: [
      { title: "CAMED — MEDUNO" },
      { name: "description", content: "Centro Acadêmico de Medicina da Unochapecó — conheça os membros, envie mensagens anônimas e agende horários." },
      { property: "og:title", content: "CAMED — MEDUNO" },
      { property: "og:description", content: "Conheça a equipe, envie mensagens anônimas e agende horários com o CAMED." },
    ],
  }),
  component: CamedPublicPage,
});

function CamedPublicPage() {
  const [info, setInfo] = useState<any>(null);
  useEffect(() => {
    supabase.from("camed_info").select("*").eq("id", 1).maybeSingle().then(({ data }) => setInfo(data));
  }, []);

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-20">
          <Badge className="bg-white/15 border-white/20 backdrop-blur"><Building2 className="size-3 mr-1" /> Centro Acadêmico</Badge>
          <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tighter">{info?.title || "CAMED"}</h1>
          {info?.subtitle && <p className="mt-2 text-lg md:text-xl text-white/85 font-medium">{info.subtitle}</p>}
          {info?.description && (
            <p className="mt-6 max-w-3xl text-sm md:text-base text-white/80 whitespace-pre-line leading-relaxed">{info.description}</p>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-14">
        <MembersSection />
        <div className="grid md:grid-cols-2 gap-8">
          <AnonymousMessageCard />
          <BookingCard />
        </div>
      </main>
    </div>
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

function AnonymousMessageCard() {
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
  }
  return (
    <Card className="border-emerald-200/60 dark:border-emerald-900/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquare className="size-5 text-emerald-600" /> Mensagem anônima</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground flex items-start gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 p-3">
          <Lock className="size-3.5 mt-0.5 shrink-0" />
          <span>Sua mensagem é enviada de forma <b>totalmente anônima</b>. Nenhum dado pessoal é armazenado junto com ela.</span>
        </div>
        <Textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escreva o que quiser contar ao CAMED..." />
        <Button onClick={send} disabled={sending} className="w-full"><Send className="size-4" /> Enviar mensagem</Button>
      </CardContent>
    </Card>
  );
}

function BookingCard() {
  const { user, profile } = useAuth();
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
  useEffect(() => { reload(); }, []);

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
    reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalIcon className="size-5 text-primary" /> Agendar horário</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!user && (
          <div className="text-xs rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3">
            <Lock className="size-3.5 inline mr-1" /> Faça <Link to="/auth" className="underline font-semibold">login</Link> para agendar um atendimento.
          </div>
        )}
        {available.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário disponível no momento.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
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
      </CardContent>

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
    </Card>
  );
}
