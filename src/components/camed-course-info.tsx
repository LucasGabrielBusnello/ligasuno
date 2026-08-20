import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import { ExternalLink, FileText, Pencil, Phone, Plus, Trash2 } from "lucide-react";

export type CourseInfo = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  display_order: number;
};

export type ContactButton = {
  id: string;
  label: string;
  url: string;
  display_order: number;
};

const db = supabase as any;

export function useCourseInfoData() {
  const [infos, setInfos] = useState<CourseInfo[]>([]);
  const [buttons, setButtons] = useState<ContactButton[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [a, b] = await Promise.all([
      db.from("camed_course_infos").select("*").order("display_order").order("created_at", { ascending: false }),
      db.from("camed_contact_buttons").select("*").order("display_order").order("created_at", { ascending: true }),
    ]);
    setInfos((a.data ?? []) as CourseInfo[]);
    setButtons((b.data ?? []) as ContactButton[]);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  return { infos, buttons, loading, reload };
}

/* ---------------------------- PUBLIC ---------------------------- */

export function CamedCourseInfoSection() {
  const { infos, buttons } = useCourseInfoData();
  const [open, setOpen] = useState<CourseInfo | null>(null);

  if (infos.length === 0 && buttons.length === 0) return null;

  return (
    <section>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
        <FileText className="size-6 text-emerald-600" /> Informações do curso
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Portarias, comunicados e informações importantes divulgadas pelo CAMED.
      </p>

      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {buttons.map((b) => (
            <Button key={b.id} asChild variant="outline" className="rounded-full">
              <a href={b.url} target="_blank" rel="noopener noreferrer">
                <Phone className="size-4 mr-1.5" /> {b.label}
              </a>
            </Button>
          ))}
        </div>
      )}

      {infos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {infos.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setOpen(it)}
              className="text-left rounded-2xl border border-border/70 bg-card overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              {it.image_url ? (
                <img src={it.image_url} alt={it.title} loading="lazy" className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 w-full bg-gradient-to-br from-emerald-900 to-teal-800 flex items-center justify-center">
                  <FileText className="size-10 text-white/80" />
                </div>
              )}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-bold leading-tight">{it.title}</h3>
                {it.description && <p className="text-sm text-muted-foreground line-clamp-3">{it.description}</p>}
                <span className="mt-auto pt-2 text-xs font-bold text-emerald-600 inline-flex items-center gap-1">
                  Ver detalhes <ExternalLink className="size-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription>Informação divulgada pelo CAMED.</DialogDescription>
          </DialogHeader>
          {open?.image_url && (
            <img src={open.image_url} alt={open.title} className="w-full rounded-xl object-cover max-h-64" />
          )}
          {open?.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{open.description}</p>
          )}
          {open?.link_url && (
            <Button asChild className="w-full">
              <a href={open.link_url} target="_blank" rel="noopener noreferrer">
                Acessar <ExternalLink className="size-4 ml-1.5" />
              </a>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ---------------------------- MANAGER ---------------------------- */

const emptyInfo = { title: "", description: "", image_url: "", link_url: "", display_order: 0 };

export function CamedCourseInfoManager() {
  const { infos, buttons, reload } = useCourseInfoData();
  const [infoOpen, setInfoOpen] = useState(false);
  const [editing, setEditing] = useState<CourseInfo | null>(null);
  const [f, setF] = useState({ ...emptyInfo });
  const [btnOpen, setBtnOpen] = useState(false);
  const [editingBtn, setEditingBtn] = useState<ContactButton | null>(null);
  const [bf, setBf] = useState({ label: "", url: "", display_order: 0 });
  const [saving, setSaving] = useState(false);

  function openNewInfo() {
    setEditing(null);
    setF({ ...emptyInfo, display_order: infos.length });
    setInfoOpen(true);
  }
  function openEditInfo(it: CourseInfo) {
    setEditing(it);
    setF({
      title: it.title,
      description: it.description ?? "",
      image_url: it.image_url ?? "",
      link_url: it.link_url ?? "",
      display_order: it.display_order,
    });
    setInfoOpen(true);
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      image_url: f.image_url.trim() || null,
      link_url: f.link_url.trim() || null,
      display_order: f.display_order,
    };
    const { error } = editing
      ? await db.from("camed_course_infos").update(payload).eq("id", editing.id)
      : await db.from("camed_course_infos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Informação salva");
    setInfoOpen(false);
    reload();
  }

  async function removeInfo(id: string) {
    if (!confirm("Excluir esta informação?")) return;
    const { error } = await db.from("camed_course_infos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    reload();
  }

  function openNewBtn() {
    setEditingBtn(null);
    setBf({ label: "", url: "", display_order: buttons.length });
    setBtnOpen(true);
  }
  function openEditBtn(b: ContactButton) {
    setEditingBtn(b);
    setBf({ label: b.label, url: b.url, display_order: b.display_order });
    setBtnOpen(true);
  }

  async function saveBtn(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { label: bf.label.trim(), url: bf.url.trim(), display_order: bf.display_order };
    const { error } = editingBtn
      ? await db.from("camed_contact_buttons").update(payload).eq("id", editingBtn.id)
      : await db.from("camed_contact_buttons").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Botão salvo");
    setBtnOpen(false);
    reload();
  }

  async function removeBtn(id: string) {
    if (!confirm("Excluir este botão?")) return;
    const { error } = await db.from("camed_contact_buttons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    reload();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4 text-emerald-600" /> Informações e portarias do curso
          </CardTitle>
          <Button size="sm" onClick={openNewInfo}>
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {infos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma informação cadastrada.</p>}
          {infos.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
              {it.image_url ? (
                <img src={it.image_url} alt="" className="size-12 rounded-lg object-cover" />
              ) : (
                <div className="size-12 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{it.title}</p>
                {it.link_url && <p className="text-xs text-muted-foreground truncate">{it.link_url}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => openEditInfo(it)}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => removeInfo(it.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="size-4 text-emerald-600" /> Botões de contato
          </CardTitle>
          <Button size="sm" onClick={openNewBtn}>
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {buttons.length === 0 && <p className="text-sm text-muted-foreground">Nenhum botão cadastrado.</p>}
          {buttons.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{b.label}</p>
                <p className="text-xs text-muted-foreground truncate">{b.url}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => openEditBtn(b)}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => removeBtn(b.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar informação" : "Nova informação"}</DialogTitle>
            <DialogDescription>Portarias, comunicados e materiais do curso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveInfo} className="space-y-3">
            <div><Label>Título</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div><ImageUpload label="Imagem" folder="camed/course-info" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url ?? "" })} /></div>
            <div><Label>Link de redirecionamento</Label><Input type="url" placeholder="https://..." value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: +e.target.value })} /></div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={btnOpen} onOpenChange={setBtnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBtn ? "Editar botão" : "Novo botão de contato"}</DialogTitle>
            <DialogDescription>Defina o texto do botão e o link de redirecionamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBtn} className="space-y-3">
            <div><Label>Texto do botão</Label><Input required placeholder="Ex.: Falar com a coordenação" value={bf.label} onChange={(e) => setBf({ ...bf, label: e.target.value })} /></div>
            <div><Label>Link de redirecionamento</Label><Input required type="url" placeholder="https://wa.me/55..." value={bf.url} onChange={(e) => setBf({ ...bf, url: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={bf.display_order} onChange={(e) => setBf({ ...bf, display_order: +e.target.value })} /></div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
