import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MEDUNO — Medicina Unochapecó" },
      { name: "description", content: "Plataforma integrada para estudantes, ligas acadêmicas, atlética e CAMED de Medicina da Unochapecó." },
      { property: "og:title", content: "MEDUNO — Medicina Unochapecó" },
      { property: "og:description", content: "Plataforma integrada para estudantes, ligas, atlética e CAMED." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <section className="hub-hero text-white">
        <div className="max-w-5xl mx-auto px-4 py-24 md:py-32 text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-widest mb-6">
            <Sparkles className="size-3.5" /> Centro Integrado
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
            MEDUNO
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/85 font-medium">
            Plataforma integrada de Medicina da Unochapecó — cronograma, ligas acadêmicas,
            atlética e CAMED em um só lugar. Navegue pelas seções na barra acima.
          </p>
        </div>
      </section>

      <AdsBanner />

      <footer className="border-t border-border/50 mt-16 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MEDUNO · Medicina Unochapecó
      </footer>
    </div>
  );
}

function AdsBanner() {
  const [ads, setAds] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const trackedViews = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("ads")
        .select("*")
        .eq("active", true)
        .lte("start_date", nowIso)
        .order("created_at", { ascending: false });
      const filtered = (data ?? []).filter((a: any) => !a.end_date || a.end_date >= nowIso);
      setAds(filtered);
    })();
  }, []);
  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % ads.length), 6000);
    return () => clearInterval(t);
  }, [ads.length]);
  useEffect(() => {
    const ad = ads[idx];
    if (!ad || trackedViews.current.has(ad.id)) return;
    trackedViews.current.add(ad.id);
    supabase.auth.getUser().then(({ data }) => {
      supabase.from("ad_analytics").insert({ ad_id: ad.id, action: "view", user_id: data.user?.id ?? null }).then(() => {});
    });
  }, [ads, idx]);
  if (ads.length === 0) return null;
  const ad = ads[idx];
  function click() {
    supabase.auth.getUser().then(({ data }) => {
      supabase.from("ad_analytics").insert({ ad_id: ad.id, action: "click", user_id: data.user?.id ?? null }).then(() => {
        if (ad.redirect_url) window.open(ad.redirect_url, "_blank", "noopener");
      });
    });
  }
  return (
    <section className="max-w-7xl mx-auto px-4 mt-8">
      <button type="button" onClick={click} className="group relative w-full block rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-950">
        <img src={ad.image_url} alt={ad.title} className="w-full aspect-[3/1] object-cover transition-transform duration-500 group-hover:scale-105" />
        {ads.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {ads.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
        )}
      </button>
    </section>
  );
}
