import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Handshake, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/parceiros")({
  head: () => ({
    meta: [
      { title: "Parceiros — MEDPLEX" },
      { name: "description", content: "Conheça os parceiros e apoiadores da Medicina Unochapecó: descontos, serviços e oportunidades para estudantes." },
      { property: "og:title", content: "Parceiros — MEDPLEX" },
      { property: "og:description", content: "Parceiros e apoiadores da Medicina Unochapecó." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnersPage,
});

function PartnersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("ads")
        .select("*")
        .eq("active", true)
        .eq("placement", "parceiros")
        .lte("start_date", nowIso)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      setItems((data ?? []).filter((a: any) => !a.end_date || a.end_date >= nowIso));
      setLoading(false);
    })();
  }, []);

  function track(ad: any) {
    supabase.auth.getUser().then(({ data }) => {
      supabase.from("ad_analytics").insert({ ad_id: ad.id, action: "click", user_id: data.user?.id ?? null }).then(() => {});
    });
  }

  return (
    <div className="min-h-screen">
      <section className="hub-hero text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-widest mb-5 backdrop-blur">
            <Handshake className="size-3.5" /> Rede MEDPLEX
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">Parceiros</h1>
          <p className="max-w-2xl mx-auto text-base md:text-lg text-white/85 font-medium">
            Empresas e instituições que apoiam a Medicina da Unochapecó — com benefícios e oportunidades para você.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-12">
        {loading ? (
          <p className="text-center text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhum parceiro cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((p) => (
              <article
                key={p.id}
                className="group rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-xl transition-all hover:-translate-y-0.5 flex flex-col"
              >
                <div className="aspect-[16/9] bg-muted overflow-hidden">
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.title ?? "Parceiro"}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h2 className="text-lg font-black tracking-tight">{p.title}</h2>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap flex-1">{p.description}</p>
                  )}
                  {p.redirect_url && (
                    <a
                      href={p.redirect_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track(p)}
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm px-4 py-2.5 hover:opacity-90 transition-opacity"
                    >
                      {p.cta_label || "Saiba mais!"} <ArrowUpRight className="size-4" />
                    </a>
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
