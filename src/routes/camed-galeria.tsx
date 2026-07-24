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

function yearOf(it: HistoryItem): number | null {
  if (!it.date) return null;
  const y = new Date(it.date).getFullYear();
  return isNaN(y) ? null : y;
}

export const Route = createFileRoute("/camed-galeria")({
  head: () => ({
    meta: [
      { title: "Galeria da História — CAMED" },
      { name: "description", content: "Galeria de fotos que contam a trajetória do Centro Acadêmico de Medicina da Unochapecó." },
      { property: "og:title", content: "Galeria — CAMED" },
      { property: "og:description", content: "Fotos e momentos marcantes do CAMED." },
    ],
  }),
  component: CamedGalleryPage,
});

function CamedGalleryPage() {
  const [info, setInfo] = useState<any>(null);
  const [open, setOpen] = useState<HistoryItem | null>(null);
  const [year, setYear] = useState<number | "all">("all");

  useEffect(() => {
    supabase.from("camed_info").select("*").eq("id", 1).maybeSingle().then(({ data }) => setInfo(data));
  }, []);

  const all = useMemo<HistoryItem[]>(() => normalize(info?.history_images), [info]);
  const years = useMemo(() => {
    const s = new Set<number>();
    all.forEach((it) => { const y = yearOf(it); if (y) s.add(y); });
    return Array.from(s).sort((a, b) => a - b);
  }, [all]);
  const items = useMemo(() => (year === "all" ? all : all.filter((it) => yearOf(it) === year)), [all, year]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
          <Button asChild variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 -ml-3 mb-3">
            <Link to="/camed"><ArrowLeft className="size-4 mr-1" /> Voltar ao CAMED</Link>
          </Button>
          <Badge className="bg-white/15 border-white/20 backdrop-blur"><ImageIcon className="size-3 mr-1" /> Galeria</Badge>
          <h1 className="mt-3 text-3xl md:text-5xl font-black tracking-tighter">{info?.history_title || "Nossa história"}</h1>
          {info?.history_description && (
            <p className="mt-4 max-w-3xl text-sm md:text-base text-white/80 whitespace-pre-line leading-relaxed">{info.history_description}</p>
          )}
        </div>
      </header>

      {years.length > 0 && (
        <div className="border-b border-border/60 bg-background/80 sticky top-0 z-20 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setYear("all")}
              className={`px-3 h-8 rounded-full text-xs font-bold uppercase tracking-widest border shrink-0 transition ${year === "all" ? "bg-emerald-600 text-white border-emerald-600" : "bg-transparent text-muted-foreground border-emerald-600/30 hover:bg-emerald-600/10"}`}
            >
              Todos
            </button>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`px-3 h-8 rounded-full text-xs font-bold uppercase tracking-widest border shrink-0 transition ${year === y ? "bg-emerald-600 text-white border-emerald-600" : "bg-transparent text-muted-foreground border-emerald-600/30 hover:bg-emerald-600/10"}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">Nenhuma foto para {year === "all" ? "esta seção" : `o ano ${year}`}.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(it)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-muted border border-border/50 hover:border-emerald-500/60 transition"
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
