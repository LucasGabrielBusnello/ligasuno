import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Camera, ClipboardCheck, Copy, Loader2, QrCode, Search, X } from "lucide-react";
import {
  listEventCheckinRoster, toggleEventCheckin, scanEventCheckin,
  listMinicourseCheckinRoster, toggleMinicourseCheckin, scanMinicourseCheckin,
} from "@/lib/event-checkin.functions";
import { QrScanner } from "./qr-scanner";

type Mode = { kind: "event"; event: any } | { kind: "minicourse"; minicourse: any };

export function CheckinDialog({ mode, open, onClose }: { mode: Mode | null; open: boolean; onClose: () => void }) {
  if (!mode) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5" /> Credenciamento
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {mode.kind === "event" ? mode.event.title : mode.minicourse.title}
          </p>
        </DialogHeader>
        {mode.kind === "event"
          ? <EventCheckinBody event={mode.event} />
          : <MinicourseCheckinBody minicourse={mode.minicourse} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventCheckinBody({ event }: { event: any }) {
  const listFn = useServerFn(listEventCheckinRoster);
  const toggleFn = useServerFn(toggleEventCheckin);
  const scanFn = useServerFn(scanEventCheckin);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ checkin_count: number; members: any[] } | null>(null);
  const [activeIdx, setActiveIdx] = useState(1);
  const [scannerOn, setScannerOn] = useState(false);
  const [search, setSearch] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const r: any = await listFn({ data: { event_id: event.id } } as any);
      setData(r);
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [event.id]);

  const count = Math.max(1, Number(event.checkin_count) || data?.checkin_count || 1);
  const schedule: Array<any> = Array.isArray(event.checkin_schedule) ? event.checkin_schedule : [];
  const hoursPer = Number(event.total_hours) > 0 ? (Number(event.total_hours) / count) : 0;

  async function toggle(reg: any, idx: number, present: boolean, method: "manual" | "qr" = "manual") {
    const prev = data;
    setData((d) => d ? { ...d, members: d.members.map(m => m.id === reg.id ? {
      ...m, checkins: { ...m.checkins, [idx]: present ? { ...(m.checkins[idx] ?? {}), checkin_index: idx, method } : undefined }
    } : m) } : d);
    try {
      await toggleFn({ data: { event_id: event.id, registration_id: reg.id, checkin_index: idx, present, method } } as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
      setData(prev);
    }
  }

  async function onScan(text: string) {
    try {
      const res: any = await scanFn({ data: { event_id: event.id, checkin_index: activeIdx, code: text } } as any);
      if (!res.ok) { toast.error(res.error || "Falha"); return; }
      if (res.duplicate) toast.info(`Já presente: ${res.name}`);
      else toast.success(`Presente: ${res.name}`);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  async function copyCodes() {
    if (!data) return;
    const present = data.members.filter(m => m.checkins[activeIdx]);
    const text = present.map(m => `${m.full_name || ""}\t${m.checkin_code || ""}`).join("\n");
    try { await navigator.clipboard.writeText(text); toast.success(`${present.length} códigos copiados`); }
    catch { toast.error("Não foi possível copiar"); }
  }
  async function copyForRaffle() {
    if (!data) return;
    const present = data.members.filter(m => m.checkins[activeIdx]).map(m => m.full_name).filter(Boolean);
    try { await navigator.clipboard.writeText(present.join("\n")); toast.success(`${present.length} nomes copiados para sorteio`); }
    catch { toast.error("Não foi possível copiar"); }
  }

  if (loading || !data) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="inline animate-spin size-4 mr-2" />Carregando...</div>;

  const filtered = data.members.filter(m => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (m.full_name || "").toLowerCase().includes(s) || (m.checkin_code || "").includes(s) || (m.email || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {count} credenciamento(s){hoursPer > 0 ? ` · cada um vale ${hoursPer.toFixed(2)}h no certificado` : ""}
      </div>
      <Tabs value={String(activeIdx)} onValueChange={(v) => setActiveIdx(Number(v))}>
        <TabsList className="flex-wrap h-auto">
          {Array.from({ length: count }, (_, i) => i + 1).map((idx) => {
            const sc = schedule.find((s: any) => Number(s?.idx) === idx);
            return (
              <TabsTrigger key={idx} value={String(idx)}>
                {sc?.label || `${idx}° Credenciamento`}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {Array.from({ length: count }, (_, i) => i + 1).map((idx) => {
          const sc = schedule.find((s: any) => Number(s?.idx) === idx);
          const presentCount = data.members.filter(m => m.checkins[idx]).length;
          return (
            <TabsContent key={idx} value={String(idx)} className="space-y-3 mt-3">
              {sc && (
                <div className="text-xs text-muted-foreground rounded border p-2 bg-muted/30">
                  {sc.starts_at && <>Início: <b>{new Date(sc.starts_at).toLocaleString("pt-BR")}</b> · </>}
                  {sc.interval_min && <>Janela: <b>{sc.interval_min} min</b></>}
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm" variant={scannerOn ? "secondary" : "default"} onClick={() => setScannerOn(v => !v)}>
                  {scannerOn ? <X className="size-4" /> : <QrCode className="size-4" />}
                  {scannerOn ? "Fechar QR" : "Ler QR Code"}
                </Button>
                <Button size="sm" variant="outline" onClick={copyCodes}>
                  <Copy className="size-4" /> Copiar Códigos de Participantes
                </Button>
                <Button size="sm" variant="outline" onClick={copyForRaffle}>
                  <Copy className="size-4" /> Copiar nomes para sorteio
                </Button>
                <div className="ml-auto text-xs text-muted-foreground">
                  Presentes: <b>{presentCount}</b> / {data.members.length}
                </div>
              </div>
              {scannerOn && idx === activeIdx && (
                <div className="rounded border p-2 bg-muted/20">
                  <QrScanner onScan={onScan} />
                  <p className="text-[11px] text-center text-muted-foreground mt-2">Aponte para o QR code do crachá do inscrito</p>
                </div>
              )}
              <div className="relative">
                <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input placeholder="Buscar por nome, código ou e-mail" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="border rounded divide-y max-h-[380px] overflow-y-auto">
                {filtered.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">Nenhum inscrito.</div>}
                {filtered.map((m) => {
                  const present = !!m.checkins[idx];
                  return (
                    <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-accent cursor-pointer">
                      <Checkbox checked={present} onCheckedChange={(v) => toggle(m, idx, !!v)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{m.full_name || <span className="text-muted-foreground">(sem nome)</span>}</div>
                        <div className="text-[11px] text-muted-foreground">{m.email}</div>
                      </div>
                      <Badge variant="outline" className="font-mono text-[11px]">{m.checkin_code}</Badge>
                      {present && <Badge className="text-[10px]">{m.checkins[idx]?.method === "qr" ? "QR" : "Manual"}</Badge>}
                    </label>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function MinicourseCheckinBody({ minicourse }: { minicourse: any }) {
  const listFn = useServerFn(listMinicourseCheckinRoster);
  const toggleFn = useServerFn(toggleMinicourseCheckin);
  const scanFn = useServerFn(scanMinicourseCheckin);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [scannerOn, setScannerOn] = useState(false);
  const [search, setSearch] = useState("");

  async function reload() {
    setLoading(true);
    try { const r: any = await listFn({ data: { minicourse_id: minicourse.id } } as any); setMembers(r.members ?? []); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [minicourse.id]);

  async function toggle(reg: any, present: boolean) {
    const prev = members;
    setMembers((ms) => ms.map(m => m.id === reg.id ? { ...m, present } : m));
    try { await toggleFn({ data: { minicourse_id: minicourse.id, registration_id: reg.id, present } } as any); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); setMembers(prev); }
  }
  async function onScan(text: string) {
    try {
      const res: any = await scanFn({ data: { minicourse_id: minicourse.id, code: text } } as any);
      if (!res.ok) { toast.error(res.error || "Falha"); return; }
      if (res.duplicate) toast.info(`Já presente: ${res.name}`); else toast.success(`Presente: ${res.name}`);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }
  async function copyCodes() {
    const present = members.filter(m => m.present);
    const text = present.map(m => `${m.full_name || ""}\t${m.checkin_code || ""}`).join("\n");
    try { await navigator.clipboard.writeText(text); toast.success(`${present.length} códigos copiados`); }
    catch { toast.error("Não foi possível copiar"); }
  }

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="inline animate-spin size-4 mr-2" />Carregando...</div>;
  const filtered = members.filter(m => !search || (m.full_name || "").toLowerCase().includes(search.toLowerCase()) || (m.checkin_code || "").includes(search));
  const presentCount = members.filter(m => m.present).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" variant={scannerOn ? "secondary" : "default"} onClick={() => setScannerOn(v => !v)}>
          {scannerOn ? <X className="size-4" /> : <QrCode className="size-4" />}
          {scannerOn ? "Fechar QR" : "Ler QR Code"}
        </Button>
        <Button size="sm" variant="outline" onClick={copyCodes}><Copy className="size-4" /> Copiar Códigos</Button>
        <div className="ml-auto text-xs text-muted-foreground">Presentes: <b>{presentCount}</b> / {members.length}</div>
      </div>
      {scannerOn && <div className="rounded border p-2 bg-muted/20"><QrScanner onScan={onScan} /></div>}
      <div className="relative">
        <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
        <Input placeholder="Buscar" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="border rounded divide-y max-h-[380px] overflow-y-auto">
        {filtered.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">Nenhum inscrito.</div>}
        {filtered.map((m) => (
          <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-accent cursor-pointer">
            <Checkbox checked={!!m.present} onCheckedChange={(v) => toggle(m, !!v)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{m.full_name || <span className="text-muted-foreground">(sem nome)</span>}</div>
              <div className="text-[11px] text-muted-foreground">{m.email}</div>
            </div>
            <Badge variant="outline" className="font-mono text-[11px]">{m.checkin_code}</Badge>
          </label>
        ))}
      </div>
    </div>
  );
}
