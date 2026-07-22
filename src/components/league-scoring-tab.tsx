import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Award, Plus, Paperclip, Clock, CheckCircle2, XCircle, Pencil, Trash2, Download } from "lucide-react";

type ScoreRequest = {
  id: string;
  league_id: string;
  requested_by: string | null;
  title: string;
  description: string;
  points_requested: number;
  receipt_url: string | null;
  status: "pending" | "approved" | "rejected";
  approved_points: number | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export function LeagueScoringTab({ league }: { league: any }) {
  const [items, setItems] = useState<ScoreRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = { title: "", description: "", points_requested: 10 };
  const [f, setF] = useState<{ title: string; description: string; points_requested: number }>(blank);
  const [file, setFile] = useState<File | null>(null);

  async function reload() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("league_score_requests")
      .select("*")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as ScoreRequest[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [league.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.description.trim()) return toast.error("Preencha título e descrição");
    if (!Number.isFinite(f.points_requested) || f.points_requested <= 0) return toast.error("Informe uma pontuação válida");
    setSaving(true);
    try {
      let receipt_url: string | null = null;
      if (file) {
        const path = `${league.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await supabase.storage.from("league-score-receipts").upload(path, file, { upsert: false });
        if (up.error) throw new Error(up.error.message);
        receipt_url = up.data.path;
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("league_score_requests").insert({
        league_id: league.id,
        requested_by: u.user?.id ?? null,
        title: f.title.trim(),
        description: f.description.trim(),
        points_requested: f.points_requested,
        receipt_url,
      });
      if (error) throw new Error(error.message);
      toast.success("Pedido enviado ao CAMED");
      setOpen(false); setF(blank); setFile(null);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao enviar"); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este pedido pendente?")) return;
    const { error } = await (supabase as any).from("league_score_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  const summary = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending").length;
    const approved = items.filter((i) => i.status === "approved").reduce((s, i) => s + (i.approved_points ?? 0), 0);
    return { pending, approved };
  }, [items]);

  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Award className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Pontuação da Liga</CardTitle>
              <p className="text-xs text-muted-foreground">Envie atividades ao CAMED para receber pontos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs"><Clock className="size-3 mr-1" />Pendentes: {summary.pending}</Badge>
            <Badge className="bg-emerald-600 text-white text-xs">Pontos aprovados: {summary.approved}</Badge>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Novo pedido</Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido enviado ainda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => <ScoreRequestCard key={r.id} r={r} onRemove={remove} />)}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo pedido de pontuação</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Simpósio de Cardiologia" />
            </div>
            <div>
              <Label>Descrição da atividade</Label>
              <Textarea rows={4} required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Detalhe o que foi realizado, número de participantes, etc." />
            </div>
            <div>
              <Label>Pontuação solicitada</Label>
              <Input type="number" min={1} required value={f.points_requested} onChange={(e) => setF({ ...f, points_requested: +e.target.value })} />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Paperclip className="size-4" /> Comprovante (opcional)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar ao CAMED"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScoreRequestCard({ r, onRemove }: { r: ScoreRequest; onRemove: (id: string) => void }) {
  const statusMap = {
    pending: { label: "Pendente", cls: "bg-amber-500 text-white", icon: <Clock className="size-3" /> },
    approved: { label: "Aprovado", cls: "bg-emerald-600 text-white", icon: <CheckCircle2 className="size-3" /> },
    rejected: { label: "Reprovado", cls: "bg-rose-600 text-white", icon: <XCircle className="size-3" /> },
  }[r.status];
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black">{r.title}</h4>
              <Badge className={statusMap.cls}>{statusMap.icon}<span className="ml-1">{statusMap.label}</span></Badge>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Solicitado</div>
            <div className="text-lg font-black tabular-nums">{r.points_requested}</div>
            {r.status === "approved" && r.approved_points !== r.points_requested && (
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Aprovado: {r.approved_points}</div>
            )}
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{r.description}</p>
        {r.review_note && (
          <div className="text-xs p-2 rounded border bg-muted/50 italic"><strong>CAMED:</strong> {r.review_note}</div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {r.receipt_url && <ReceiptLink path={r.receipt_url} />}
          {r.status === "pending" && (
            <Button size="sm" variant="ghost" onClick={() => onRemove(r.id)}><Trash2 className="size-3.5 text-rose-600" /> Excluir</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReceiptLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.storage.from("league-score-receipts").createSignedUrl(path, 60 * 30);
      setUrl(data?.signedUrl ?? null);
    })();
  }, [path]);
  if (!url) return <Badge variant="outline" className="text-xs"><Paperclip className="size-3 mr-1" /> Comprovante</Badge>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
      <Download className="size-3.5" /> Ver comprovante
    </a>
  );
}
