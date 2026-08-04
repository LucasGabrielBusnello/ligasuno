import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import ifmsaLogo from "@/assets/ifmsa-logo.jpeg.asset.json";
import {
  Download,
  Globe2,
  Heart,
  Instagram,
  MessageCircle,
  Quote,
  Sparkles,
  Users as UsersIcon,
  ArrowRight,
  Cat,
} from "lucide-react";

export const Route = createFileRoute("/ifmsa")({
  head: () => ({
    meta: [
      { title: "IFMSA Brazil Unochapecó — MEDUNO" },
      {
        name: "description",
        content:
          "Conheça a IFMSA Brazil Unochapecó: comitês, intercâmbios nacionais e internacionais, projetos sociais, diretoria e a Cartilha do Calouro para download.",
      },
      { property: "og:title", content: "IFMSA Brazil Unochapecó — MEDUNO" },
      {
        property: "og:description",
        content: "Comitês, intercâmbios, projetos e a Cartilha do Calouro da IFMSA Brazil Unochapecó.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IfmsaPage,
});

type Sector = {
  id: string;
  code: string;
  name: string;
  full_name: string | null;
  short_description: string | null;
  description: string | null;
  color: string;
  emoji: string | null;
  image_url: string | null;
  links: { label?: string; url?: string }[];
  highlights: string[];
  is_exchange: boolean;
  published: boolean;
  display_order: number;
};

function IfmsaPage() {
  const [info, setInfo] = useState<any>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any).from("ifmsa_info").select("*").eq("id", 1).maybeSingle().then(({ data }: any) => setInfo(data));
    (supabase as any)
      .from("ifmsa_sectors")
      .select("*")
      .eq("published", true)
      .order("display_order")
      .then(({ data }: any) => {
        const list = (data ?? []) as Sector[];
        setSectors(list);
        setActive((a) => a ?? list[0]?.code ?? null);
      });
    (supabase as any)
      .from("ifmsa_members")
      .select("*")
      .order("display_order")
      .then(({ data }: any) => setMembers(data ?? []));
    (supabase as any)
      .from("ifmsa_testimonials")
      .select("*")
      .eq("published", true)
      .order("display_order")
      .then(({ data }: any) => setTestimonials(data ?? []));
  }, []);

  const current = useMemo(() => sectors.find((s) => s.code === active) ?? null, [sectors, active]);
  const logo = info?.logo_url || ifmsaLogo.url;

  return (
    <div className="min-h-screen bg-[#f6fbf7] dark:bg-neutral-950">
      {/* HERO */}
      <section className="relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b7a3b] via-[#0a8f4a] to-[#1263a8]" />
        {info?.hero_image_url && (
          <>
            <img src={info.hero_image_url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#0b7a3b]/92 via-[#0a8f4a]/85 to-[#1263a8]/85" />
          </>
        )}
        {/* blobs decorativos */}
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-yellow-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-80 rounded-full bg-sky-300/20 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-20">
          <div className="grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] items-center">
            <div className="shrink-0 mx-auto md:mx-0 size-28 md:size-36 rounded-3xl bg-white p-3 shadow-2xl ring-4 ring-white/30 rotate-[-3deg]">
              <img src={logo} alt="Logo IFMSA Brazil Unochapecó" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 text-center md:text-left">
              <Badge className="bg-white/15 border-white/25 backdrop-blur">
                <Sparkles className="size-3 mr-1" /> Comitê Local Unochapecó
              </Badge>
              <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tighter drop-shadow">
                {info?.title || "IFMSA Brazil Unochapecó"}
              </h1>
              {info?.subtitle && <p className="mt-2 text-base md:text-lg text-white/85 font-semibold">{info.subtitle}</p>}
              {info?.description && (
                <p className="mt-5 max-w-3xl text-sm md:text-base text-white/85 whitespace-pre-line leading-relaxed">
                  {info.description}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2 justify-center md:justify-start">
                {["Humanização", "União", "Ética", "Equidade", "Cidadania"].map((v) => (
                  <span
                    key={v}
                    className="px-3 py-1 rounded-full bg-white/12 border border-white/20 text-xs font-bold backdrop-blur"
                  >
                    {v}
                  </span>
                ))}
              </div>
              {(info?.instagram_url || info?.whatsapp_url) && (
                <div className="mt-5 flex flex-wrap gap-2 justify-center md:justify-start">
                  {info?.instagram_url && (
                    <Button asChild size="sm" variant="secondary" className="bg-white text-emerald-800 hover:bg-white/90">
                      <a href={info.instagram_url} target="_blank" rel="noreferrer">
                        <Instagram className="size-4 mr-1.5" /> Instagram
                      </a>
                    </Button>
                  )}
                  {info?.whatsapp_url && (
                    <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <a href={info.whatsapp_url} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4 mr-1.5" /> Grupo no WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="relative h-6 bg-[#f6fbf7] dark:bg-neutral-950 rounded-t-[2rem]" />
      </section>

      <main className="max-w-6xl mx-auto px-4 pb-20 space-y-20">
        {/* CARTILHA */}
        {info?.cartilha_url && (
          <Reveal>
            <section className="-mt-4">
              <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/40 dark:to-sky-950/30 p-6 md:p-10 shadow-xl">
                <div className="pointer-events-none absolute -right-6 -top-8 text-[7rem] opacity-15 select-none">🐱</div>
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] items-center">
                  <div className="min-w-0">
                    <Badge className="bg-yellow-400 text-yellow-950 hover:bg-yellow-400 border-0">
                      <Cat className="size-3 mr-1" /> Miau, calouro!
                    </Badge>
                    <h2 className="mt-3 text-2xl md:text-4xl font-black tracking-tight text-emerald-900 dark:text-emerald-100">
                      {info.cartilha_cta || "Chegou agora na universidade? Comece por aqui"}
                    </h2>
                    <p className="mt-3 text-sm md:text-base text-emerald-900/75 dark:text-emerald-100/75 leading-relaxed">
                      {info.cartilha_description ||
                        "Baixe a Cartilha do Calouro e entenda tudo sobre a IFMSA: comitês, intercâmbios, atividades e siglas."}
                    </p>
                    <Button
                      asChild
                      size="lg"
                      className="mt-6 bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg"
                    >
                      <a href={info.cartilha_url} target="_blank" rel="noreferrer" download>
                        <Download className="size-4 mr-2" /> Baixar {info.cartilha_title || "Cartilha do Calouro"}
                      </a>
                    </Button>
                  </div>
                  <div className="hidden md:block">
                    <div className="size-40 rounded-2xl bg-white shadow-xl ring-1 ring-emerald-500/20 p-4 rotate-3">
                      <img src={logo} alt="" className="h-full w-full object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </Reveal>
        )}

        {/* COMITÊS / SETORES */}
        {sectors.length > 0 && (
          <Reveal>
            <section>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/10 border border-emerald-600/30 text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300 font-bold">
                  Nossos setores
                </div>
                <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">Comitês permanentes</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Cada comitê é um universo. Escolha um e descubra onde você se encaixa.
                </p>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:flex-wrap md:justify-center md:overflow-visible md:mx-0 md:px-0">
                {sectors.map((s) => {
                  const on = s.code === active;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActive(s.code)}
                      className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-all ${
                        on ? "text-white shadow-lg scale-[1.03]" : "bg-card border border-border hover:border-emerald-500/50"
                      }`}
                      style={on ? { backgroundColor: s.color } : undefined}
                    >
                      <span>{s.emoji || "🐾"}</span> {s.name}
                    </button>
                  );
                })}
              </div>

              {current && (
                <div
                  key={current.id}
                  className="mt-6 rounded-3xl border bg-card overflow-hidden shadow-lg animate-fade-up"
                >
                  <div className="h-2 w-full" style={{ backgroundColor: current.color }} />
                  <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-6 p-6 md:p-8">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-12 shrink-0 rounded-2xl grid place-items-center text-2xl"
                          style={{ backgroundColor: `${current.color}22` }}
                        >
                          {current.emoji || "🐾"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-2xl font-black tracking-tight truncate">{current.name}</h3>
                          {current.full_name && (
                            <p className="text-xs text-muted-foreground leading-snug">{current.full_name}</p>
                          )}
                        </div>
                      </div>
                      {current.description && (
                        <p className="mt-5 text-sm md:text-base leading-relaxed whitespace-pre-line text-foreground/85">
                          {current.description}
                        </p>
                      )}
                      {Array.isArray(current.highlights) && current.highlights.length > 0 && (
                        <ul className="mt-5 grid sm:grid-cols-2 gap-2">
                          {current.highlights.map((h: any, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Heart className="size-4 mt-0.5 shrink-0" style={{ color: current.color }} />
                              <span>{typeof h === "string" ? h : h?.label}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {Array.isArray(current.links) && current.links.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-2">
                          {current.links.map((l: any, i: number) =>
                            l?.url ? (
                              <Button key={i} asChild size="sm" variant="outline">
                                <a href={l.url} target="_blank" rel="noreferrer">
                                  {l.label || "Acessar"} <ArrowRight className="size-3.5 ml-1" />
                                </a>
                              </Button>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                    {current.image_url && (
                      <div className="md:w-64 shrink-0">
                        <img
                          src={current.image_url}
                          alt={current.name}
                          className="w-full h-48 md:h-full object-cover rounded-2xl"
                        />
                      </div>
                    )}
                  </div>

                  {current.is_exchange && testimonials.length > 0 && (
                    <TestimonialsMarquee items={testimonials} color={current.color} />
                  )}
                </div>
              )}
            </section>
          </Reveal>
        )}

        {/* DIRETORIA */}
        {members.length > 0 && (
          <Reveal>
            <section>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-600/10 border border-sky-600/30 text-[10px] uppercase tracking-widest text-sky-700 dark:text-sky-300 font-bold">
                  Quem faz acontecer
                </div>
                <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight flex items-center justify-center gap-2">
                  <UsersIcon className="size-7 text-emerald-600" /> Diretoria da IFMSA
                </h2>
                <p className="text-sm text-muted-foreground mt-2">Conheça quem está à frente do comitê local.</p>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {members.map((m) => (
                  <Card key={m.id} className="overflow-hidden hover:shadow-xl transition-shadow group">
                    <div className="aspect-square bg-muted overflow-hidden">
                      {m.image_url ? (
                        <img
                          src={m.image_url}
                          alt={m.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-5xl">🐱</div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">{m.role}</Badge>
                        {m.acronym && (
                          <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">{m.acronym}</Badge>
                        )}
                      </div>
                      <h4 className="font-black mt-2 leading-tight">{m.name}</h4>
                      {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{m.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </Reveal>
        )}
      </main>
    </div>
  );
}

function TestimonialsMarquee({ items, color }: { items: any[]; color: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const loop = items.length > 1 ? [...items, ...items] : items;

  return (
    <div className="border-t bg-muted/30 py-8">
      <div className="px-6 md:px-8 mb-4 flex items-center gap-2">
        <Globe2 className="size-5" style={{ color }} />
        <h4 className="font-black tracking-tight">Quem foi, conta como foi</h4>
      </div>
      <div className="relative overflow-hidden group marquee-mask">
        <div
          ref={trackRef}
          className="flex gap-4 px-6 md:px-8 w-max animate-marquee-slow group-hover:[animation-play-state:paused]"
        >
          {loop.map((t, i) => (
            <figure
              key={`${t.id}-${i}`}
              className="w-[19rem] shrink-0 rounded-2xl bg-card border p-5 shadow-sm"
            >
              <Quote className="size-5 mb-2 opacity-40" style={{ color }} />
              <blockquote className="text-sm leading-relaxed text-foreground/85 line-clamp-6">{t.quote}</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <div className="size-11 shrink-0 rounded-full overflow-hidden bg-muted grid place-items-center">
                  {t.photo_url ? (
                    <img src={t.photo_url} alt={t.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg">🐱</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-sm truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[t.program, t.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
