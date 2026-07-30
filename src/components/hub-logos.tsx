import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Faixa horizontal de pequenas logos (parceiros/apoiadores) exibida no hub inicial. */
export function HubLogos() {
  const [logos, setLogos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("ads")
        .select("*")
        .eq("active", true)
        .eq("placement", "logos")
        .lte("start_date", nowIso)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      setLogos((data ?? []).filter((a: any) => !a.end_date || a.end_date >= nowIso));
    })();
  }, []);

  if (logos.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      {logos.map((l) => {
        const content = (
          <img
            src={l.image_url}
            alt={l.title ?? "Parceiro"}
            loading="lazy"
            className="h-10 sm:h-12 w-auto object-contain opacity-90 transition-all group-hover:opacity-100 group-hover:scale-105"
          />
        );
        const cls =
          "group inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur px-4 py-2.5";
        return l.redirect_url ? (
          <a key={l.id} href={l.redirect_url} target="_blank" rel="noopener noreferrer" className={cls} title={l.title ?? ""}>
            {content}
          </a>
        ) : (
          <div key={l.id} className={cls} title={l.title ?? ""}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
