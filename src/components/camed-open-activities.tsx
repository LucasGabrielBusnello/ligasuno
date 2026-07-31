import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";

type LeagueLite = { id: string; name: string; icon_url: string | null; theme_color: string | null };

const empty = { image_url: "", title: "", description: "", participating_league_ids: [] as string[] };

export function CamedOpenActivities() {
  const [leagues, setLeagues] = useState<LeagueLite[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const [{ data: lg }, { data: acts }] = await Promise.all([
      supabase.from("leagues").select("id,name,icon_url,theme_color").order("name"),
      supabase.from("league_activities").select("*").eq("is_open", true).order("created_at", { ascending: false }),
    ]);
    setLeagues((lg as any) ?? []);
    setList(acts ?? []);
  }
  useEffect(() => { reload(); }, []);

  function toggle(id: string) {
    setForm((s) => ({
      ...s,
      participating_league_ids: s.participating_league_ids.includes(id)
        ? s.participating_league_ids.filter((x) => x !== id)
        : [...s.participating_league_ids, id],
    }));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image_url) return toast.error("Imagem obrigatória");
    if (!form.title.trim()) return toast.error("Título obrigatório");
    if (form.participating_league_ids.length === 0) return toast.error("Selecione ao menos uma liga participante");
    setSaving(true);
    const { error } = await (supabase.from("league_activities") as any).insert({
      league_id: form.participating_league_ids[0],
      display_order: list.length,
      image_url: form.image_url,
      caption: form.title.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      is_open: true,
      participating_league_ids: form.participating_league_ids,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Atividade aberta registrada");
    setForm(empty); setDlg(false); reload();
  }

  async function del(id: string) {
    if (!confirm("Remover esta atividade aberta?")) return;
    const { error } = await supabase.from("league_activities").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  const byId = new Map(leagues.map((l) => [l.id, l]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="size-5 text-emerald-600" /> Atividades abertas</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Registre atividades abertas e marque quais ligas participaram.</p>
        </div>
        <Button size="sm" onClick={() => { setForm(empty); setDlg(true); }}><Plus className="size-4 mr-1" /> Nova</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade aberta registrada.</p>}
        {list.map((a) => (
          <div key={a.id} className="flex gap-3 p-3 rounded-xl border bg-card">
            <img src={a.image_url} alt={a.title ?? "Atividade"} className="size-20 rounded-lg object-cover border shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{a.title ?? a.caption}</div>
              {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(a.participating_league_ids ?? []).map((id: string) => {
                  const l = byId.get(id);
                  if (!l) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-muted">
                      {l.icon_url ? <img src={l.icon_url} className="size-3.5 rounded-full object-contain" alt="" /> : null}
                      {l.name}
                    </span>
                  );
                })}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(a.id)}><Trash2 className="size-4 text-rose-600" /></Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova atividade aberta</DialogTitle></DialogHeader>
          <form onSubmit={add} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <ImageUpload label="Imagem" folder="league-activities" value={form.image_url} onChange={(url) => setForm((s) => ({ ...s, image_url: url }))} />
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Mutirão de saúde" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block">Ligas participantes</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto rounded-lg border p-2">
                {leagues.map((l) => {
                  const on = form.participating_league_ids.includes(l.id);
                  return (
                    <button
                      type="button"
                      key={l.id}
                      onClick={() => toggle(l.id)}
                      className={`flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md border transition-colors ${on ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-semibold" : "border-transparent hover:bg-muted"}`}
                    >
                      {l.icon_url ? <img src={l.icon_url} className="size-5 rounded object-contain" alt="" /> : <span className="size-5 rounded" style={{ background: l.theme_color ?? "#10b981" }} />}
                      <span className="truncate">{l.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
