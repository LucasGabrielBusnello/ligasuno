import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings, ClipboardCheck, Trophy, Undo2, X, UserPlus, Info, FileQuestion } from "lucide-react";
import { generateRanking, removeFromRanking, undoLastRanking, toggleLigante } from "@/lib/selection.functions";
import { ExamBuilder } from "@/components/exam-builder";

const SEMESTERS = [1, 3, 5, 7, 9, 11] as const;

export function SelectionManagerDialog({ league, open, onClose, onMembershipUpdated }: { league: any; open: boolean; onClose: () => void; onMembershipUpdated?: () => void }) {
  if (!league) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Processo Seletivo · {league.name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="config">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="config"><Settings className="size-4 mr-1.5" />Configuração</TabsTrigger>
            <TabsTrigger value="exam"><ClipboardCheck className="size-4 mr-1.5" />Prova e Classificações</TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="mt-4"><ConfigSection league={league} /></TabsContent>
          <TabsContent value="exam" className="mt-4"><ExamSection league={league} onMembershipUpdated={onMembershipUpdated} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ConfigSection({ league }: { league: any }) {
  const [f, setF] = useState({
    selection_open: !!league.selection_open,
    selection_deadline: league.selection_deadline ?? "",
    selection_exam_date: league.selection_exam_date ?? "",
    selection_exam_time: (league.selection_exam_time ?? "").slice(0, 5),
    selection_exam_description: league.selection_exam_description ?? "",
    selection_total_seats: Number(league.selection_total_seats) || 0,
  });
  const [quotas, setQuotas] = useState<Record<number, number>>({});
  const [quotasEnabled, setQuotasEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    const [{ data: l }, { data: qs }] = await Promise.all([
      supabase.from("leagues").select("selection_open,selection_deadline,selection_exam_date,selection_exam_time,selection_exam_description,selection_total_seats").eq("id", league.id).maybeSingle(),
      supabase.from("league_selection_quotas").select("*").eq("league_id", league.id),
    ]);
    if (l) {
      const ll: any = l;
      setF({
        selection_open: !!ll.selection_open,
        selection_deadline: ll.selection_deadline ?? "",
        selection_exam_date: ll.selection_exam_date ?? "",
        selection_exam_time: (ll.selection_exam_time ?? "").slice(0, 5),
        selection_exam_description: ll.selection_exam_description ?? "",
        selection_total_seats: Number(ll.selection_total_seats) || 0,
      });
    }
    const m: Record<number, number> = {};
    (qs ?? []).forEach((q: any) => { if (q.seats > 0) m[q.semester] = q.seats; });
    setQuotas(m);
    setQuotasEnabled(Object.keys(m).length > 0);
  }
  useEffect(() => { loadAll(); }, [league.id]);

  async function save() {
    const seats = Number(f.selection_total_seats) || 0;
    if (seats < 8 || seats > 12) {
      toast.error("A quantidade de membros não é permitida pelo regulamento do CAMED");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("leagues").update({
        selection_open: f.selection_open,
        selection_deadline: f.selection_deadline || null,
        selection_exam_date: f.selection_exam_date || null,
        selection_exam_time: f.selection_exam_time || null,
        selection_exam_description: f.selection_exam_description || null,
        selection_total_seats: seats,
      } as any).eq("id", league.id);
      if (error) { toast.error(error.message); return; }

      const target = quotasEnabled ? quotas : {};
      for (const sem of SEMESTERS) {
        const seats = Number(target[sem]) || 0;
        if (seats > 0) {
          const { error: qe } = await supabase.from("league_selection_quotas").upsert(
            { league_id: league.id, semester: sem, seats } as any,
            { onConflict: "league_id,semester" } as any
          );
          if (qe) { toast.error(qe.message); return; }
        } else {
          await supabase.from("league_selection_quotas").delete().eq("league_id", league.id).eq("semester", sem);
        }
      }
      Object.assign(league, {
        selection_open: f.selection_open,
        selection_deadline: f.selection_deadline || null,
        selection_exam_date: f.selection_exam_date || null,
        selection_exam_time: f.selection_exam_time || null,
        selection_exam_description: f.selection_exam_description || null,
        selection_total_seats: f.selection_total_seats,
      });
      await loadAll();
      toast.success("Configuração salva");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="font-black">Liga Aberta para Inscrições</div>
          <div className="text-xs text-muted-foreground">Quando ativo, o botão "Inscreva-se para realizar a prova" aparece na página da liga.</div>
        </div>
        <Switch checked={f.selection_open} onCheckedChange={(v) => setF({ ...f, selection_open: v })} />
      </CardContent></Card>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Prazo final de inscrição</Label><Input type="date" value={f.selection_deadline} onChange={(e) => setF({ ...f, selection_deadline: e.target.value })} /></div>
        <div>
          <Label>Total de vagas (8 a 12 — CAMED)</Label>
          <Input type="number" min="8" max="12" value={f.selection_total_seats} onChange={(e) => setF({ ...f, selection_total_seats: +e.target.value })} />
          <p className="text-[10px] text-muted-foreground mt-1">A quantidade deve estar entre 8 e 12 conforme o regulamento do CAMED.</p>
        </div>
        <div><Label>Data da prova</Label><Input type="date" value={f.selection_exam_date} onChange={(e) => setF({ ...f, selection_exam_date: e.target.value })} /></div>
        <div><Label>Horário da prova</Label><Input type="time" value={f.selection_exam_time} onChange={(e) => setF({ ...f, selection_exam_time: e.target.value })} /></div>
      </div>
      <div><Label>Descrição da prova</Label><Textarea rows={3} value={f.selection_exam_description} onChange={(e) => setF({ ...f, selection_exam_description: e.target.value })} /></div>

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-black">Vagas exclusivas por semestre?</div>
            <div className="text-xs text-muted-foreground">Reserve vagas para semestres específicos. Sobras voltam para a vaga geral.</div>
          </div>
          <Switch checked={quotasEnabled} onCheckedChange={setQuotasEnabled} />
        </div>
        {quotasEnabled && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SEMESTERS.map(sem => (
              <div key={sem}>
                <Label className="text-xs">{sem}º semestre</Label>
                <Input type="number" min="0" placeholder="0"
                  value={quotas[sem] ?? ""}
                  onChange={(e) => setQuotas({ ...quotas, [sem]: +e.target.value })} />
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar configuração"}</Button>
    </div>
  );
}

function ExamSection({ league, onMembershipUpdated }: { league: any; onMembershipUpdated?: () => void }) {
  const [regs, setRegs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [ligantes, setLigantes] = useState<Set<string>>(new Set());
  const gen = useServerFn(generateRanking);
  const rem = useServerFn(removeFromRanking);
  const undo = useServerFn(undoLastRanking);
  const toggle = useServerFn(toggleLigante);

  async function reload() {
    setLoading(true);
    const [{ data: rs }, { data: qs }, { data: ms }] = await Promise.all([
      supabase.from("league_selection_registrations").select("*").eq("league_id", league.id).eq("status", "paid"),
      supabase.from("league_selection_quotas").select("*").eq("league_id", league.id),
      supabase.from("league_memberships").select("user_id, role").eq("league_id", league.id).eq("role", "ligante"),
    ]);
    setRegs(rs ?? []);
    setQuotas(qs ?? []);
    setLigantes(new Set((ms ?? []).map((m: any) => m.user_id)));
    setLoading(false);
  }
  useEffect(() => { reload(); }, [league.id]);

  async function patch(id: string, fields: any) {
    const cur = regs.find(r => r.id === id);
    setRegs(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    const { error } = await supabase.from("league_selection_registrations").update(fields).eq("id", id);
    if (error) {
      toast.error(error.message);
      if (cur) setRegs(prev => prev.map(r => r.id === id ? cur : r));
    }
  }

  async function doGenerate() {
    try {
      await gen({ data: { league_id: league.id } } as any);
      toast.success("Classificação gerada");
      await reload();
      onMembershipUpdated?.();
    }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function doUndo() {
    try { await undo({ data: { league_id: league.id } } as any); toast.success("Última ação desfeita"); reload(); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function doRemove(id: string) {
    if (!confirm("Remover este classificado e chamar o próximo?")) return;
    try {
      await rem({ data: { registration_id: id } } as any);
      toast.success("Substituição feita");
      await reload();
      onMembershipUpdated?.();
    }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function doAddLigante(reg: any) {
    try {
      const res: any = await toggle({ data: { registration_id: reg.id, mode: "add" } } as any);
      setLigantes(prev => {
        const next = new Set(prev);
        if (res?.isLigante) next.add(reg.user_id);
        return next;
      });
      toast.success(res?.alreadyMember ? "Já é ligante" : "Adicionado como ligante");
      onMembershipUpdated?.();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function doRemoveLigante(reg: any) {
    if (!confirm("Remover este usuário da liga (ligante)?")) return;
    try {
      await toggle({ data: { registration_id: reg.id, mode: "remove" } } as any);
      setLigantes(prev => { const next = new Set(prev); next.delete(reg.user_id); return next; });
      toast.success("Removido de ligante");
      onMembershipUpdated?.();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }


  const classified = regs.filter(r => r.ranked_via && r.ranked_via !== "waitlist" && r.ranked_via !== "eliminated")
    .sort((a,b) => (a.ranked_position ?? 0) - (b.ranked_position ?? 0));
  const waitlist = regs.filter(r => r.ranked_via === "waitlist")
    .sort((a,b) => (a.ranked_position ?? 0) - (b.ranked_position ?? 0));
  const quotaBySem: Record<number, any[]> = {};
  classified.filter(c => c.ranked_via === "quota").forEach(c => {
    const sem = c.ranked_semester || 0;
    (quotaBySem[sem] ||= []).push(c);
  });
  const generalClassified = classified.filter(c => c.ranked_via === "general");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={doUndo}><Undo2 className="size-4" /> Desfazer</Button>
        <Button size="sm" variant="outline" onClick={() => setShowWaitlist(s => !s)}><Trophy className="size-4" /> {showWaitlist ? "Esconder" : "Lista de Espera"}</Button>
        <Button size="sm" onClick={doGenerate}><Trophy className="size-4" /> Gerar Classificação</Button>
      </div>

      <Card><CardContent className="p-3">
        <h4 className="font-black mb-2 text-sm">Inscritos pagos ({regs.length})</h4>
        {loading ? <p className="text-xs text-muted-foreground">Carregando...</p> : regs.length === 0 ?
          <p className="text-xs text-muted-foreground">Nenhum inscrito pago ainda.</p> : (
          <div className="space-y-1">
            {regs.map(r => (
              <div key={r.id} className="rounded border">
                <div className="p-2 flex items-center gap-2 text-sm flex-wrap">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={!!r.present} onChange={(e) => patch(r.id, { present: e.target.checked })} />
                    <span className="text-[10px] text-muted-foreground">Presente</span>
                  </label>
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="flex-1 text-left flex items-center gap-1 min-w-0">
                    <Info className="size-3 text-muted-foreground" />
                    <span className="font-bold truncate">{r.full_name}</span>
                  </button>
                  <Badge variant="secondary" className="text-[10px]">{r.semester}º sem.</Badge>
                  <Input type="number" step="0.01" placeholder="Nota" className="w-20 h-7 text-xs"
                    value={r.grade ?? ""} onChange={(e) => patch(r.id, { grade: e.target.value === "" ? null : Number(e.target.value) })} />
                  <Input type="number" placeholder="Pos." className="w-16 h-7 text-xs"
                    value={r.delivery_position ?? ""} onChange={(e) => patch(r.id, { delivery_position: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                {expanded === r.id && (
                  <div className="px-3 pb-2 text-[11px] text-muted-foreground space-y-0.5 border-t bg-muted/30">
                    <div>CPF: {r.cpf}</div><div>Email: {r.email}</div><div>Telefone: {r.phone}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {classified.length > 0 && (
        <Card><CardContent className="p-3 space-y-3">
          <h4 className="font-black text-sm flex items-center gap-2"><Trophy className="size-4" /> Classificados</h4>
          {Object.keys(quotaBySem).sort((a,b) => +a - +b).map(sem => (
            <div key={sem} className="space-y-1">
              <Badge className="text-[10px]">Vagas destinadas ao {sem}º semestre</Badge>
              {quotaBySem[+sem].map(c => <RankRow key={c.id} reg={c} isLigante={ligantes.has(c.user_id)} onRemove={() => doRemove(c.id)} onAddLigante={() => doAddLigante(c)} onRemoveLigante={() => doRemoveLigante(c)} />)}
            </div>
          ))}
          {generalClassified.length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              <Badge variant="outline" className="text-[10px]">Vagas gerais</Badge>
              {generalClassified.map(c => <RankRow key={c.id} reg={c} isLigante={ligantes.has(c.user_id)} onRemove={() => doRemove(c.id)} onAddLigante={() => doAddLigante(c)} onRemoveLigante={() => doRemoveLigante(c)} />)}
            </div>
          )}
        </CardContent></Card>
      )}

      {showWaitlist && (
        <Card><CardContent className="p-3 space-y-1">
          <h4 className="font-black text-sm">Lista de Espera ({waitlist.length})</h4>
          {waitlist.length === 0 && <p className="text-xs text-muted-foreground">Vazia.</p>}
          {waitlist.map(w => (
            <div key={w.id} className="p-2 rounded border flex items-center justify-between text-sm">
              <span>{w.ranked_position}. <b>{w.full_name}</b> <span className="text-xs text-muted-foreground">· {w.semester}º · nota {w.grade ?? "—"}</span></span>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

function RankRow({ reg, isLigante, onRemove, onAddLigante, onRemoveLigante }: { reg: any; isLigante: boolean; onRemove: () => void; onAddLigante: () => void; onRemoveLigante: () => void }) {
  return (
    <div className="p-2 rounded border flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-bold">{reg.ranked_position}.</span> {reg.full_name}
        <span className="text-xs text-muted-foreground"> · {reg.semester}º · nota {reg.grade ?? "—"}</span>
      </div>
      <div className="flex gap-1 shrink-0">
        {isLigante ? (
          <Button size="sm" onClick={onRemoveLigante} className="bg-emerald-600 hover:bg-emerald-700 text-white" title="Já é ligante — clique para remover">
            <UserPlus className="size-3" /> Ligante
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onAddLigante}>
            <UserPlus className="size-3" /> Ligante
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={onRemove} title="Remover da classificação"><X className="size-3" /></Button>
      </div>
    </div>
  );
}

