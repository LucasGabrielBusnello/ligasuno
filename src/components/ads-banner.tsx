import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdsBannerProps {
  placement?: "home" | "ligas";
  className?: string;
  aspect?: string;
}

export function AdsBanner({ placement = "home", className, aspect = "aspect-[16/6] md:aspect-[16/5]" }: AdsBannerProps) {
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
        .eq("placement", placement)
        .lte("start_date", nowIso)
        .order("created_at", { ascending: false });
      const filtered = (data ?? []).filter((a: any) => !a.end_date || a.end_date >= nowIso);
      setAds(filtered);
    })();
  }, [placement]);

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
    if (ad.redirect_url) window.open(ad.redirect_url, "_blank", "noopener");
    supabase.auth.getUser().then(({ data }) => {
      supabase.from("ad_analytics").insert({ ad_id: ad.id, action: "click", user_id: data.user?.id ?? null }).then(() => {});
    }).catch(() => {});
  }

  return (
    <section className={className ?? "max-w-7xl mx-auto px-4"}>
      <div className="relative group">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40 blur-xl opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden />
        <button
          type="button"
          onClick={click}
          className="relative w-full block rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-950 ring-1 ring-white/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
        >
          <img
            src={ad.image_url}
            alt={ad.title ?? "Anúncio"}
            className={`w-full ${aspect} object-cover transition-transform duration-700 group-hover:scale-[1.03]`}
          />
          {ads.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {ads.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          )}
        </button>
      </div>
    </section>
  );
}
