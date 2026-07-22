import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Pencil, Award } from "lucide-react";
import { ReceiptLink } from "@/components/league-scoring-tab";

type Req = any;

export function CamedScoringApprovals({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<Req[]>([]);
  const [leagues, setLeagues] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<Req | null>(null);
  const [edit, setEdit] = useState({ points: 0, note: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");

  async function reload() {
    const { data } = await (supabase as any)
      .from("league_score_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data as Req[]) ?? [];
    setItems(list);
    const ids = [...new Set(list.map((i) => i.league_id))];
    if (ids.length) {
      const { data: lg } = await supabase.from("leagues").select("id,name,theme_color,icon_url").in("id", ids);
      const map: Record<string, any> = {}; (lg ?? []).forEach((l: any) => map[l.id] = l);
      setLeagues(map);
    }
  }
  useEffect(() => { reload(); }, []);

  async function decide(r: Req, action: "approved" | "rejected", overridePoints?: number, note?: string) {
    setBusy(r.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      const approved_points = action === "approved" ? (overridePoints ?? r.points_requested) : null;
      const { error } = await (supabase as any)
        .from("league_score_requests")
        .update({
          status: action,
          approved_points,
          review_note: note?.trim() || null,
          reviewed_by: u.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw new Error(error.message);
      if (action === "approved") {
        const { error: pErr } = await supabase.from("league_points").insert({
          league_id: r.league_id,
          points: approved_points!,
          description: `${r.title}${note?.trim() ? ` — ${note.trim()}` : ""}`,
        });
        if (pErr) throw new Error(pErr.message);
      }
      toast.success(action === "approved" ? "Pontuação aprovada" : "Pedido reprovado");
      setEditing(null);
      await reload();
      onChanged?.();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setBusy(null); }
  }

  const filtered = items.filter((i) => tab === "pending" ? i.status === "pending" : i.status !== "pending");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="flex items-center gap-2"><Award className="size-5 text-primary" /> Aprovação de pontuações</CardTitle>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          <button onClick={() => setTab("pending")} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${tab === "pending" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Pendentes ({items.filter(i => i.status === "pending").length})</button>
          <button onClick={() => setTab("history")} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${tab === "history" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Histórico</button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{tab === "pending" ? "Nenhum pedido pendente." : "Sem histórico ainda."}</p>}
        {filtered.map((r) => {
          const l = leagues[r.league_id];
          const status = r.status === "approved" ? { cls: "bg-emerald-600 text-white", label: "Aprovado" }
            : r.status === "rejected" ? { cls: "bg-rose-600 text-white", label: "Reprovado" }
            : { cls: "bg-amber-500 text-white", label: "Pendente" };
          return (
            <div key={r.id} className="rounded-2xl border-2 border-border p-4 space-y-3 bg-card">
              <div className="flex items-start gap-3 flex-wrap">
                {l && (
                  <div className="size-10 rounded-xl flex items-center justify-center text-white font-black overflow-hidden shrink-0" style={{ background: l.theme_color }}>
                    {l.icon_url ? <img src={l.icon_url} className="size-full object-cover" /> : (l.name || "??").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{l?.name ?? "Liga"}</span>
                    <Badge className={status.cls}>{status.label}</Badge>
                  </div>
                  <h4 className="font-black">{r.title}</h4>
                  <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Solicitado</div>
                  <div className="text-2xl font-black tabular-nums">{r.points_requested}</div>
                  {r.status === "approved" && r.approved_points !== r.points_requested && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Aprovado: {r.approved_points}</div>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.description}</p>
              {r.review_note && <div className="text-xs p-2 rounded border bg-muted/50 italic"><strong>Nota do CAMED:</strong> {r.review_note}</div>}
              <div className="flex items-center gap-2 flex-wrap">
                {r.receipt_url && <ReceiptLink path={r.receipt_url} />}
                {r.status === "pending" && (
                  <div className="ml-auto flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r, "rejected")}>
                      <XCircle className="size-4" /> Reprovar
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => { setEditing(r); setEdit({ points: r.points_requested, note: "" }); }}>
                      <Pencil className="size-4" /> Aprovar c/ mudanças
                    </Button>
                    <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, "approved")}>
                      <CheckCircle2 className="size-4" /> Aprovar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar com mudanças</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editing && decide(editing, "approved", edit.points, edit.note); }} className="space-y-3">
            <div>
              <Label>Pontuação final</Label>
              <Input type="number" required value={edit.points} onChange={(e) => setEdit({ ...edit, points: +e.target.value })} />
              <p className="text-[11px] text-muted-foreground mt-1">Original: {editing?.points_requested} pontos.</p>
            </div>
            <div>
              <Label>Nota (visível para a liga)</Label>
              <Textarea rows={3} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Explique brevemente o ajuste" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit">Aprovar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
