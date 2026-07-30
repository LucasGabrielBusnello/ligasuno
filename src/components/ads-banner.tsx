import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdsBannerProps {
  placement?: "home" | "ligas";
  className?: string;
  aspect?: string;
}

/** Marca uma visualização apenas uma vez por sessão do navegador. */
function markSessionView(adId: string): boolean {
  try {
    const key = `ad_view_${adId}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export function AdsBanner({ placement = "home", className, aspect = "aspect-[16/6] md:aspect-[21/6]" }: AdsBannerProps) {
  const [ads, setAds] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const tracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("ads")
        .select("*")
        .eq("active", true)
        .eq("placement", placement)
        .lte("start_date", nowIso)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      const filtered = (data ?? []).filter((a: any) => !a.end_date || a.end_date >= nowIso);
      setAds(filtered);
      setIdx(0);
    })();
  }, [placement]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % ads.length), 5500);
    return () => clearInterval(t);
  }, [ads.length]);

  // Registra visualização do anúncio realmente exibido (1x por sessão)
  useEffect(() => {
    const ad = ads[idx];
    if (!ad || tracked.current.has(ad.id)) return;
    tracked.current.add(ad.id);
    if (!markSessionView(ad.id)) return;
    supabase.auth.getUser().then(({ data }) => {
      supabase.from("ad_analytics").insert({ ad_id: ad.id, action: "view", user_id: data.user?.id ?? null }).then(() => {});
    });
  }, [ads, idx]);

  const click = useCallback((ad: any) => {
    if (ad.redirect_url) window.open(ad.redirect_url, "_blank", "noopener");
    supabase.auth.getUser().then(({ data }) => {
      supabase.from("ad_analytics").insert({ ad_id: ad.id, action: "click", user_id: data.user?.id ?? null }).then(() => {});
    });
  }, []);

  if (ads.length === 0) return null;

  return (
    <section className={className ?? "max-w-4xl mx-auto px-4"}>
      <div className="relative group">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 blur-lg opacity-60 group-hover:opacity-90 transition-opacity" aria-hidden />
        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-neutral-950 ring-1 ring-white/5">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {ads.map((ad) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => click(ad)}
                className="w-full shrink-0 block focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
                aria-label={ad.title ?? "Anúncio"}
              >
                <img
                  src={ad.image_url}
                  alt={ad.title ?? "Anúncio"}
                  loading="lazy"
                  className={`w-full ${aspect} object-cover`}
                />
              </button>
            ))}
          </div>
          {ads.length > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {ads.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`Anúncio ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
