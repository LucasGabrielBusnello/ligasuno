import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ImageIcon, Calendar as CalIcon } from "lucide-react";

type HistoryItem = { url: string; caption?: string | null; date?: string | null };

function normalize(raw: any): HistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (typeof v === "string" ? { url: v } : v && typeof v === "object" && v.url ? v : null))
    .filter(Boolean) as HistoryItem[];
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

export const Route = createFileRoute("/atletica-galeria")({
  head: () => ({
    meta: [
      { title: "Galeria da História — Atlética" },
      { name: "description", content: "Galeria de fotos que contam a trajetória da AAAMD Desbravadores." },
      { property: "og:title", content: "Galeria — Atlética" },
      { property: "og:description", content: "Fotos e momentos marcantes da atlética." },
    ],
  }),
  component: AtleticaGalleryPage,
});

function AtleticaGalleryPage() {
  const [ath, setAth] = useState<any>(null);
  const [open, setOpen] = useState<HistoryItem | null>(null);

  useEffect(() => {
    supabase.from("athletics").select("*").eq("slug", "aaamd-desbravadores").maybeSingle().then(({ data }) => setAth(data));
  }, []);

  const items = useMemo<HistoryItem[]>(() => normalize((ath as any)?.history_images), [ath]);
  const primary = (ath as any)?.primary_color || "#f97316";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900 to-black">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
          <Button asChild variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 -ml-3 mb-3">
            <Link to="/atletica"><ArrowLeft className="size-4 mr-1" /> Voltar à Atlética</Link>
          </Button>
          <Badge className="bg-white/15 border-white/20 backdrop-blur"><ImageIcon className="size-3 mr-1" /> Galeria</Badge>
          <h1 className="mt-3 text-3xl md:text-5xl font-black tracking-tighter" style={{ color: "#fff" }}>{(ath as any)?.history_title || "Nossa história"}</h1>
          {(ath as any)?.history_description && (
            <p className="mt-4 max-w-3xl text-sm md:text-base text-white/80 whitespace-pre-line leading-relaxed">{(ath as any).history_description}</p>
          )}
          <div className="mt-4 h-1 w-24 rounded-full" style={{ background: primary }} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {items.length === 0 ? (
          <p className="text-center text-white/60 py-16">Nenhuma foto disponível ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(it)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-white/5 border border-white/10 hover:border-white/40 transition"
              >
                <img src={it.url} alt={it.caption || `Foto ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                {(it.caption || it.date) && (
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition">
                    {it.caption && <div className="text-[11px] text-white font-medium line-clamp-2">{it.caption}</div>}
                    {it.date && <div className="text-[10px] text-white/70">{fmtDate(it.date)}</div>}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {open && (
            <div>
              <div className="bg-black flex items-center justify-center max-h-[70vh] overflow-hidden">
                <img src={open.url} alt={open.caption || "Foto"} className="max-h-[70vh] w-auto object-contain" />
              </div>
              {(open.caption || open.date) && (
                <div className="p-4 md:p-5 space-y-2">
                  {open.caption && <p className="text-sm md:text-base leading-relaxed whitespace-pre-line">{open.caption}</p>}
                  {open.date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalIcon className="size-3.5" /> {fmtDate(open.date)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
