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
import { Plus, Trash2, Drum, MessageCircle, Loader2 } from "lucide-react";

export type Instrument = {
  id: string;
  athletic_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
};

type BandConfig = {
  band_image_url: string | null;
  band_description: string | null;
  band_whatsapp_url: string | null;
};

async function loadBand(athleticId: string) {
  const [cfg, inst] = await Promise.all([
    (supabase as any)
      .from("athletics")
      .select("band_image_url, band_description, band_whatsapp_url")
      .eq("id", athleticId)
      .maybeSingle(),
    (supabase as any)
      .from("athletic_band_instruments")
      .select("*")
      .eq("athletic_id", athleticId)
      .order("sort_order", { ascending: true }),
  ]);
  return {
    config: (cfg.data ?? {
      band_image_url: null,
      band_description: null,
      band_whatsapp_url: null,
    }) as BandConfig,
    instruments: (inst.data ?? []) as Instrument[],
  };
}

/* ============ Página pública ============ */
export function BandSection({
  athleticId,
  primaryColor,
}: {
  athleticId: string;
  primaryColor?: string;
}) {
  const [config, setConfig] = useState<BandConfig | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBand(athleticId).then(({ config, instruments }) => {
      setConfig(config);
      setInstruments(instruments);
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
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-white/60">
          <Drum className="size-3.5" /> Bateria
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
          A batida da nossa torcida
        </h2>
      </header>

      <a
        href={config?.band_whatsapp_url || undefined}
        target="_blank"
        rel="noreferrer noopener"
        className="block rounded-3xl border border-white/10 bg-white/5 overflow-hidden group"
      >
        {config?.band_image_url ? (
          <img
            src={config.band_image_url}
            alt="Bateria da atlética"
            className="w-full max-h-[380px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-56 flex items-center justify-center text-white/40">
            <Drum className="size-12" />
          </div>
        )}
        <div className="p-5 space-y-3">
          {config?.band_description && (
            <p className="text-sm text-white/70 whitespace-pre-line">{config.band_description}</p>
          )}
          {config?.band_whatsapp_url && (
            <Button
              className="text-white font-bold"
              style={{ background: primaryColor || "#16a34a" }}
            >
              <MessageCircle className="size-4 mr-1.5" /> Entrar no Grupo do WhatsApp
            </Button>
          )}
        </div>
      </a>

      <section className="space-y-4">
        <h3 className="text-xl font-black tracking-tight text-white">Conheça Nossos Instrumentos</h3>
        {instruments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
            Nenhum instrumento cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {instruments.map((i) => (
              <article
                key={i.id}
                className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
              >
                {i.image_url && (
                  <img
                    src={i.image_url}
                    alt={i.name}
                    loading="lazy"
                    className="w-full aspect-video object-cover"
                  />
                )}
                <div className="p-4 space-y-1.5">
                  <h4 className="font-black text-white">{i.name}</h4>
                  {i.description && (
                    <p className="text-sm text-white/70 whitespace-pre-line">{i.description}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============ Diretoria ============ */
export function DirectorBand({ athleticId }: { athleticId: string }) {
  const [config, setConfig] = useState<BandConfig>({
    band_image_url: "",
    band_description: "",
    band_whatsapp_url: "",
  });
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [editing, setEditing] = useState<Partial<Instrument> | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const r = await loadBand(athleticId);
    setConfig(r.config);
    setInstruments(r.instruments);
  }
  useEffect(() => {
    reload();
  }, [athleticId]);

  async function saveConfig() {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("athletics")
      .update({
        band_image_url: config.band_image_url || null,
        band_description: config.band_description || null,
        band_whatsapp_url: config.band_whatsapp_url || null,
      })
      .eq("id", athleticId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Bateria atualizada");
  }

  async function saveInstrument() {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (!name) return toast.error("Nome é obrigatório");
    const payload: any = {
      athletic_id: athleticId,
      name,
      description: editing.description || null,
      image_url: editing.image_url || null,
    };
    const q = editing.id
      ? (supabase as any).from("athletic_band_instruments").update(payload).eq("id", editing.id)
      : (supabase as any).from("athletic_band_instruments").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Instrumento salvo");
    setEditing(null);
    reload();
  }

  async function removeInstrument(i: Instrument) {
    if (!window.confirm(`Excluir "${i.name}"?`)) return;
    const { error } = await (supabase as any)
      .from("athletic_band_instruments")
      .delete()
      .eq("id", i.id);
    if (error) return toast.error(error.message);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="font-black text-white">Card principal da bateria</h3>
        <ImageUpload
          label="Imagem principal"
          folder="athletic-band"
          value={config.band_image_url ?? ""}
          onChange={(url) => setConfig({ ...config, band_image_url: url })}
        />
        <div>
          <Label>Descrição</Label>
          <Textarea
            value={config.band_description ?? ""}
            onChange={(e) => setConfig({ ...config, band_description: e.target.value })}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
        <div>
          <Label>Link do grupo do WhatsApp</Label>
          <Input
            placeholder="https://chat.whatsapp.com/..."
            value={config.band_whatsapp_url ?? ""}
            onChange={(e) => setConfig({ ...config, band_whatsapp_url: e.target.value })}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null} Salvar bateria
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-white">Instrumentos</h3>
        <Button
          onClick={() => setEditing({ name: "", description: "", image_url: "" })}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="size-4 mr-1.5" /> Novo instrumento
        </Button>
      </div>

      {instruments.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          Nenhum instrumento cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {instruments.map((i) => (
            <div key={i.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              {i.image_url && (
                <img src={i.image_url} alt="" loading="lazy" className="w-full aspect-video object-cover" />
              )}
              <div className="p-4 space-y-2">
                <div className="font-black text-white">{i.name}</div>
                {i.description && <p className="text-xs text-white/60 line-clamp-3">{i.description}</p>}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => setEditing(i)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                    onClick={() => removeInstrument(i)}
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
            <DialogTitle>{editing?.id ? "Editar instrumento" : "Novo instrumento"}</DialogTitle>
            <DialogDescription className="text-white/60">
              Nome, descrição e foto do instrumento.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <ImageUpload
                label="Foto"
                folder="athletic-band"
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveInstrument} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
