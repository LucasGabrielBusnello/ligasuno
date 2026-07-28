import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import { Plus, Trash2, HeartHandshake, MessageCircle, Loader2 } from "lucide-react";

export type SocialAction = {
  id: string;
  athletic_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  whatsapp_url: string | null;
};

async function listActions(athleticId: string) {
  const { data } = await (supabase as any)
    .from("athletic_social_actions")
    .select("*")
    .eq("athletic_id", athleticId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SocialAction[];
}

/* ============ Página pública ============ */
export function SocialActionsSection({
  athleticId,
  primaryColor,
}: {
  athleticId: string;
  primaryColor?: string;
}) {
  const [items, setItems] = useState<SocialAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listActions(athleticId).then((r) => {
      setItems(r);
      setLoading(false);
    });
  }, [athleticId]);

  if (loading)
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="size-6 animate-spin text-white/60" />
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-white/60">
          <HeartHandshake className="size-3.5" /> Ação Social
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
          Projetos que transformam
        </h2>
        <p className="text-sm text-white/60">
          Conheça as ações sociais da atlética e entre no grupo para participar.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          <HeartHandshake className="size-10 mx-auto mb-3 opacity-70" />
          Nenhuma ação social cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <article
              key={a.id}
              className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex flex-col"
            >
              {a.image_url && (
                <img
                  src={a.image_url}
                  alt={a.name}
                  loading="lazy"
                  className="w-full aspect-video object-cover"
                />
              )}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-black text-white text-lg leading-tight">{a.name}</h3>
                {a.description && (
                  <p className="text-sm text-white/70 whitespace-pre-line">{a.description}</p>
                )}
                {a.whatsapp_url && (
                  <Button
                    asChild
                    className="mt-auto text-white font-bold"
                    style={{ background: primaryColor || "#16a34a" }}
                  >
                    <a href={a.whatsapp_url} target="_blank" rel="noreferrer noopener">
                      <MessageCircle className="size-4 mr-1.5" /> Entrar no Grupo do WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ Diretoria ============ */
export function DirectorSocialActions({ athleticId }: { athleticId: string }) {
  const [items, setItems] = useState<SocialAction[]>([]);
  const [editing, setEditing] = useState<Partial<SocialAction> | null>(null);

  async function reload() {
    setItems(await listActions(athleticId));
  }
  useEffect(() => {
    reload();
  }, [athleticId]);

  async function save() {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (!name) return toast.error("Nome é obrigatório");
    const payload: any = {
      athletic_id: athleticId,
      name,
      description: editing.description || null,
      image_url: editing.image_url || null,
      whatsapp_url: editing.whatsapp_url || null,
    };
    const q = editing.id
      ? (supabase as any).from("athletic_social_actions").update(payload).eq("id", editing.id)
      : (supabase as any).from("athletic_social_actions").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Ação social salva");
    setEditing(null);
    reload();
  }

  async function remove(a: SocialAction) {
    if (!window.confirm(`Excluir "${a.name}"?`)) return;
    const { error } = await (supabase as any)
      .from("athletic_social_actions")
      .delete()
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-white/60">Projetos exibidos na aba pública "Ação Social".</p>
        <Button
          onClick={() => setEditing({ name: "", description: "", image_url: "", whatsapp_url: "" })}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="size-4 mr-1.5" /> Nova ação social
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          Nenhuma ação social cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((a) => (
            <div key={a.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              {a.image_url && (
                <img src={a.image_url} alt="" loading="lazy" className="w-full aspect-video object-cover" />
              )}
              <div className="p-4 space-y-2">
                <div className="font-black text-white">{a.name}</div>
                {a.description && <p className="text-xs text-white/60 line-clamp-3">{a.description}</p>}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => setEditing(a)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                    onClick={() => remove(a)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar ação social" : "Nova ação social"}</DialogTitle>
            <DialogDescription className="text-white/60">
              Foto, nome, descrição e link do grupo de WhatsApp.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <ImageUpload
                label="Foto"
                folder="athletic-social"
                value={editing.image_url ?? ""}
                onChange={(url) => setEditing({ ...editing, image_url: url })}
              />
              <div>
                <Label>Nome *</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Link do grupo do WhatsApp</Label>
                <Input
                  placeholder="https://chat.whatsapp.com/..."
                  value={editing.whatsapp_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, whatsapp_url: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
