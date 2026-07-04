import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { QrScanner } from "@/components/qr-scanner";
import { ImageUpload } from "@/components/image-upload";
import { generateTicketsPdf } from "@/lib/athletic-tickets-pdf";
import {
  ArrowLeft, ShoppingBag, Ticket, Users, Shield, Sparkles, Plus, Trash2, QrCode, FileDown,
  Wallet, Settings, Trophy, Store, PartyPopper, Loader2, Camera, Crown, CheckCircle2,
} from "lucide-react";
import {
  upsertAthleticMember, deleteAthleticMember, requestSelfMembership, confirmMembershipPayment,
  upsertCollection, deleteCollection, upsertProduct, deleteProduct,
  upsertEvent, deleteEvent, generateTicketBatch, registerManualTicketSale,
  addAthleticCashEntry, updateAthletic, upsertSport, deleteSport,
} from "@/lib/athletic.functions";
import {
  createMembershipPixPayment, createEventTicketPixPayment, createProductPixPayment,
} from "@/lib/athletic-payments.functions";


export const Route = createFileRoute("/atletica")({
  component: AtleticaPage,
  head: () => ({
    meta: [
      { title: "AAAMD Desbravadores — Atlética" },
      { name: "description", content: "Atlética Acadêmica de Medicina Desbravadores. Produtos, eventos e área do sócio." },
      { property: "og:title", content: "AAAMD Desbravadores" },
      { property: "og:description", content: "Há 19 anos a maior do Oeste. Produtos, eventos e área do sócio." },
    ],
  }),
});

type Athletic = {
  id: string; slug: string; name: string; short_name: string | null; description: string | null;
  logo_url: string | null; cover_url: string | null; primary_color: string; secondary_color: string;
  president_id: string | null; membership_price: number; membership_period_days: number; published: boolean;
};
type Membership = {
  id: string; athletic_id: string; user_id: string | null; full_name: string; email: string;
  phone: string | null; cpf: string | null; matricula: string | null; semestre: string | null;
  role: "socio" | "diretor" | "presidente"; member_until: string | null; active: boolean;
};
type Collection = { id: string; athletic_id: string; name: string; slug: string; description: string | null; cover_url: string | null; display_order: number; active: boolean };
type Product = {
  id: string; athletic_id: string; collection_id: string | null; title: string; description: string | null;
  images: string[]; price: number; member_price: number | null; discount_pct: number;
  second_item_discount_pct: number; stock: number | null; is_highlight: boolean; is_new: boolean;
  badge_text: string | null; active: boolean;
};
type EventRow = {
  id: string; athletic_id: string; title: string; description: string | null; location: string | null;
  starts_at: string | null; ends_at: string | null; image_url: string | null; theme_color: string | null;
  price_member: number; price_visitor: number; total_tickets: number; tickets_sold: number;
  published: boolean; online_sales_open: boolean;
};

function AtleticaPage() {
  const { user, profile } = useAuth();
  const [ath, setAth] = useState<Athletic | null>(null);
  const [myMembership, setMyMembership] = useState<Membership | null>(null);
  const [isDirector, setIsDirector] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("athletics").select("*").eq("slug", "aaamd-desbravadores").maybeSingle();
      setAth(data as any);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user || !ath) { setMyMembership(null); setIsDirector(false); return; }
    (async () => {
      const [{ data: mem }, { data: dRes }] = await Promise.all([
        supabase.from("athletic_memberships").select("*").eq("athletic_id", ath.id).eq("user_id", user.id).maybeSingle(),
        supabase.rpc("is_athletic_director", { _user_id: user.id, _athletic_id: ath.id }),
      ]);
      setMyMembership((mem as any) ?? null);
      setIsDirector(Boolean(dRes));
    })();
  }, [user, ath]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin size-8" /></div>;
  }
  if (!ath) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p>Atlética não encontrada.</p>
      <Button asChild><Link to="/">Voltar</Link></Button>
    </div>;
  }

  const isActiveMember = !!myMembership && myMembership.active && (!myMembership.member_until || new Date(myMembership.member_until) >= new Date());

  return (
    <div className="min-h-screen bg-black text-white" style={{
      // Injeta as cores como CSS vars para os componentes filhos
      // @ts-expect-error
      "--ath-primary": ath.primary_color, "--ath-secondary": ath.secondary_color,
    }}>
      {/* HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/70 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
            <Link to="/"><ArrowLeft className="size-4" /> Voltar</Link>
          </Button>
          <div className="flex items-center gap-2">
            {ath.logo_url && <img src={ath.logo_url} alt="" className="size-9 rounded-full object-cover border border-white/20" />}
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest opacity-70">Atlética</div>
              <div className="font-black text-sm leading-tight" style={{ color: ath.primary_color }}>{ath.short_name ?? ath.name}</div>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden min-h-[520px] flex items-center">
        {ath.cover_url ? (
          <>
            <img src={ath.cover_url} className="absolute inset-0 w-full h-full object-cover" alt={ath.name} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
            <div className="absolute inset-0" style={{
              background: `radial-gradient(ellipse at top left, ${ath.primary_color}55, transparent 55%), radial-gradient(ellipse at bottom right, ${ath.secondary_color}55, transparent 55%)`,
            }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse at top left, ${ath.primary_color}44, transparent 60%), radial-gradient(ellipse at bottom right, ${ath.secondary_color}44, transparent 60%), #000`,
          }} />
        )}
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24 text-center w-full">
          {ath.logo_url && (
            <img src={ath.logo_url} alt={ath.name} className="mx-auto size-32 md:size-40 rounded-full border-4 shadow-2xl object-cover mb-6"
              style={{ borderColor: ath.primary_color }} />
          )}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-xs uppercase tracking-widest font-bold backdrop-blur"
            style={{ background: `${ath.primary_color}33`, color: "#fff", border: `1px solid ${ath.primary_color}88` }}>
            <Trophy className="size-3.5" /> Campeã Geral Série B Intermed 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 uppercase drop-shadow-2xl">
            {ath.name}
          </h1>
          <p className="max-w-2xl mx-auto text-lg opacity-95 drop-shadow-lg">
            {ath.description ?? "Há 19 anos a maior do Oeste."}
          </p>
          {!isActiveMember && (
            <div className="mt-8">
              <AssociarButton athletic={ath} onDone={() => window.location.reload()} />
            </div>
          )}
          {isActiveMember && (
            <Badge className="mt-8 text-sm px-4 py-1.5" style={{ background: ath.secondary_color, color: "white" }}>
              <Crown className="size-3.5 mr-1.5" /> Sócio ativo até {new Date(myMembership!.member_until!).toLocaleDateString("pt-BR")}
            </Badge>
          )}
        </div>
      </section>

      {/* MARQUEE COLEÇÕES + ESPORTES */}
      <CollectionsMarquee athletic={ath} />
      <SportsShowcase athletic={ath} />


      {/* TABS */}
      <main className="max-w-7xl mx-auto px-3 md:px-4 py-8">
        <Tabs defaultValue="produtos">
          <TabsList className={`w-full grid ${isDirector ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"} h-auto p-1 bg-white/5 border border-white/10`}>
            <TabsTrigger value="produtos" className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-black"><Store className="size-4 mr-1.5" />Produtos</TabsTrigger>
            <TabsTrigger value="eventos" className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-black"><PartyPopper className="size-4 mr-1.5" />Eventos</TabsTrigger>
            <TabsTrigger value="socios" className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-black"><Users className="size-4 mr-1.5" />Sócios</TabsTrigger>
            {isDirector && <TabsTrigger value="diretoria" className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-black"><Shield className="size-4 mr-1.5" />Diretoria</TabsTrigger>}
            <TabsTrigger value="sobre" className="py-2.5 data-[state=active]:bg-white data-[state=active]:text-black"><Sparkles className="size-4 mr-1.5" />Sobre</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-6"><PublicProducts athletic={ath} /></TabsContent>
          <TabsContent value="eventos" className="mt-6"><PublicEvents athletic={ath} isMember={isActiveMember} /></TabsContent>
          <TabsContent value="socios" className="mt-6"><SociosArea athletic={ath} isMember={isActiveMember} user={user} /></TabsContent>
          {isDirector && <TabsContent value="diretoria" className="mt-6"><DirectorPanel athletic={ath} /></TabsContent>}
          <TabsContent value="sobre" className="mt-6"><SobrePanel athletic={ath} /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-16 border-t border-white/10 py-8 text-center text-xs opacity-60">
        <p>{ath.name} • ligasuno.com.br</p>
      </footer>
    </div>
  );
}

/* ============ ASSOCIAR-SE ============ */
/* ============ Modal Pix genérico ============ */
function PixDialog({ open, onClose, data, title }: {
  open: boolean; onClose: () => void;
  data: { qr_code?: string; qr_code_base64?: string; ticket_url?: string; amount: number } | null;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pague com Pix escaneando o QR ou copiando o código. A confirmação é automática (leva alguns segundos após o pagamento).
          </DialogDescription>
        </DialogHeader>
        {data ? (
          <div className="space-y-3 text-center">
            {data.qr_code_base64 && (
              <img src={`data:image/png;base64,${data.qr_code_base64}`} alt="QR Pix" className="mx-auto w-64 h-64 rounded-lg border" />
            )}
            <div className="text-2xl font-black">R$ {data.amount.toFixed(2)}</div>
            {data.qr_code && (
              <div className="space-y-2">
                <Label className="text-xs">Pix Copia e Cola</Label>
                <Textarea readOnly value={data.qr_code} className="text-xs font-mono h-20" onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(data.qr_code!); toast.success("Código copiado"); }}>
                  Copiar código
                </Button>
              </div>
            )}
            {data.ticket_url && (
              <a href={data.ticket_url} target="_blank" rel="noreferrer" className="text-sm underline opacity-80">Abrir no Mercado Pago</a>
            )}
          </div>
        ) : (
          <div className="py-8 text-center opacity-70"><Loader2 className="animate-spin mx-auto size-8" /></div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ ASSOCIAR-SE ============ */
function AssociarButton({ athletic, onDone }: { athletic: Athletic; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "", email: profile?.email ?? "", phone: profile?.phone ?? "",
    cpf: "", matricula: "", semestre: "",
  });
  useEffect(() => {
    if (profile) setForm((f) => ({
      ...f, full_name: f.full_name || profile.full_name || "",
      email: f.email || profile.email || "", phone: f.phone || profile.phone || "",
    }));
  }, [profile]);
  const request = useServerFn(requestSelfMembership);
  const createPix = useServerFn(createMembershipPixPayment);
  const [pixData, setPixData] = useState<any>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const { user } = useAuth();
  if (!user) {
    return (
      <Button asChild size="lg"
        className="text-lg px-8 py-6 h-auto font-black uppercase tracking-wider shadow-2xl text-white border-0 hover:scale-105 transition-transform"
        style={{ background: `linear-gradient(135deg, ${athletic.primary_color}, ${athletic.secondary_color})` }}>
        <Link to="/auth"><Crown className="size-5" /> Associar-se • R$ {Number(athletic.membership_price).toFixed(2)}</Link>
      </Button>
    );
  }
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}
        className="text-lg px-8 py-6 h-auto font-black uppercase tracking-wider shadow-2xl hover:scale-105 transition-transform text-white border-0"
        style={{ background: `linear-gradient(135deg, ${athletic.primary_color}, ${athletic.secondary_color})` }}>
        <Crown className="size-5" /> Associar-se • R$ {Number(athletic.membership_price).toFixed(2)}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Associar-se à {athletic.name}</DialogTitle>
            <DialogDescription>
              Preencha seus dados. Após confirmar, você recebe o Pix de R$ {Number(athletic.membership_price).toFixed(2)} — a associação é liberada automaticamente por {athletic.membership_period_days} dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail *</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>CPF *</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matrícula *</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
              <div><Label>Semestre *</Label><Input value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                const r = await request({ data: { athletic_id: athletic.id, ...form } });
                const pix = await createPix({ data: { payment_id: r.payment_id } });
                setPixData(pix);
                setOpen(false);
                setPixOpen(true);
                onDone();
              } catch (e: any) { toast.error(e?.message ?? "Erro"); } finally { setSaving(false); }
            }}>{saving ? "Gerando Pix..." : "Continuar → gerar Pix"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixDialog open={pixOpen} onClose={() => setPixOpen(false)} data={pixData} title="Pix — Associação AAAMD" />
    </>
  );
}


/* ============ PÚBLICO: PRODUTOS ============ */
function PublicProducts({ athletic }: { athletic: Athletic }) {
  const [cols, setCols] = useState<Collection[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("athletic_collections").select("*").eq("athletic_id", athletic.id).eq("active", true).order("display_order"),
        supabase.from("athletic_products").select("*").eq("athletic_id", athletic.id).eq("active", true).order("is_highlight", { ascending: false }),
      ]);
      setCols((c as any) ?? []);
      setProds((p as any) ?? []);
    })();
  }, [athletic.id]);

  const filtered = filter === "all" ? prods : prods.filter((p) => p.collection_id === filter);
  if (prods.length === 0) {
    return <EmptyDark icon={<Store className="size-12" />} title="Nenhum produto disponível ainda"
      desc="A diretoria ainda não publicou produtos. Volte em breve!" />;
  }
  return (
    <div className="space-y-6">
      {cols.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todos</Chip>
          {cols.map((c) => <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} color={athletic.primary_color}>{c.name}</Chip>)}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((p) => <ProductCard key={p.id} product={p} athletic={athletic} />)}
      </div>
    </div>
  );
}

function ProductCard({ product, athletic }: { product: Product; athletic: Athletic }) {
  const { user, profile } = useAuth();
  const finalPrice = product.discount_pct > 0
    ? product.price * (1 - product.discount_pct / 100) : product.price;
  const img = product.images?.[0];
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({
    buyer_name: profile?.full_name ?? "", buyer_email: profile?.email ?? "",
    buyer_phone: profile?.phone ?? "", buyer_cpf: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const createPix = useServerFn(createProductPixPayment);
  return (
    <Card className="overflow-hidden bg-white/5 border-white/10 text-white group hover:border-white/30 transition">
      <div className="aspect-square bg-black/40 relative overflow-hidden">
        {img
          ? <img src={img} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
          : <div className="w-full h-full flex items-center justify-center opacity-30"><ShoppingBag className="size-16" /></div>}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.is_new && <Badge style={{ background: athletic.secondary_color }}>NOVO</Badge>}
          {product.discount_pct > 0 && <Badge className="bg-red-500">-{Math.round(product.discount_pct)}%</Badge>}
          {product.badge_text && <Badge style={{ background: athletic.primary_color }}>{product.badge_text}</Badge>}
        </div>
        {product.second_item_discount_pct > 0 && (
          <div className="absolute bottom-0 inset-x-0 py-1.5 text-center text-xs font-black uppercase tracking-wider"
            style={{ background: `linear-gradient(90deg, ${athletic.primary_color}, ${athletic.secondary_color})` }}>
            🔥 -{Math.round(product.second_item_discount_pct)}% na 2ª peça!
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <div className="font-bold text-sm leading-tight line-clamp-2 h-10">{product.title}</div>
        <div className="flex items-baseline gap-2">
          {product.discount_pct > 0 && <span className="text-xs line-through opacity-50">R$ {product.price.toFixed(2)}</span>}
          <span className="font-black text-lg" style={{ color: athletic.primary_color }}>R$ {finalPrice.toFixed(2)}</span>
        </div>
        {user ? (
          <Button size="sm" className="w-full mt-2" onClick={() => setOpen(true)}>
            <ShoppingBag className="size-3.5" /> Comprar via Pix
          </Button>
        ) : (
          <Button size="sm" className="w-full mt-2" asChild>
            <Link to="/auth"><ShoppingBag className="size-3.5" /> Entrar para comprar</Link>
          </Button>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comprar — {product.title}</DialogTitle>
            <DialogDescription>Preencha seus dados e finalize com Pix.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Quantidade</Label><Input type="number" min={1} max={product.stock ?? 20} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} /></div>
            <div><Label>Nome completo *</Label><Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail *</Label><Input value={form.buyer_email} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.buyer_phone ?? ""} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} /></div>
            </div>
            <div><Label>CPF *</Label><Input value={form.buyer_cpf} onChange={(e) => setForm({ ...form, buyer_cpf: e.target.value })} /></div>
            <div><Label>Observações (tamanho, cor…)</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                const pix = await createPix({ data: { product_id: product.id, quantity: qty, ...form } });
                setPixData(pix); setOpen(false); setPixOpen(true);
              } catch (e: any) { toast.error(e?.message ?? "Erro"); } finally { setSaving(false); }
            }}>{saving ? "Gerando Pix..." : "Gerar Pix"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixDialog open={pixOpen} onClose={() => setPixOpen(false)} data={pixData} title={`Pix — ${product.title}`} />
    </Card>
  );
}


/* ============ PÚBLICO: EVENTOS ============ */
function PublicEvents({ athletic, isMember }: { athletic: Athletic; isMember: boolean }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    supabase.from("athletic_events").select("*").eq("athletic_id", athletic.id).eq("published", true)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .then(({ data }) => setEvents((data as any) ?? []));
  }, [athletic.id]);
  if (events.length === 0) {
    return <EmptyDark icon={<PartyPopper className="size-12" />} title="Nenhum evento no momento" desc="Fique de olho! Novidades em breve." />;
  }
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {events.map((e) => (
        <EventCard key={e.id} event={e} athletic={athletic} isMember={isMember} />
      ))}
    </div>
  );
}

function EventCard({ event: e, athletic, isMember }: { event: EventRow; athletic: Athletic; isMember: boolean }) {
  const { user, profile } = useAuth();
  const price = isMember ? e.price_member : e.price_visitor;
  const remaining = e.total_tickets - e.tickets_sold;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    buyer_name: profile?.full_name ?? "", buyer_email: profile?.email ?? "",
    buyer_phone: profile?.phone ?? "", buyer_cpf: "",
  });
  const [saving, setSaving] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const createPix = useServerFn(createEventTicketPixPayment);
  const canBuy = e.online_sales_open && remaining > 0 && price > 0;
  return (
    <Card className="overflow-hidden bg-white/5 border-white/10 text-white group">
      <div className="aspect-video bg-black/40 relative">
        {e.image_url
          ? <img src={e.image_url} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
          : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${e.theme_color ?? athletic.primary_color}, ${athletic.secondary_color})` }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-black text-xl uppercase tracking-tight">{e.title}</h3>
          {e.starts_at && <p className="text-xs opacity-80">{new Date(e.starts_at).toLocaleString("pt-BR")}</p>}
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        {e.location && <p className="text-xs opacity-70">📍 {e.location}</p>}
        {e.description && <p className="text-sm opacity-80 line-clamp-3">{e.description}</p>}
        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <div>
            <div className="text-xs opacity-60">{isMember ? "Sócio" : "Visitante"}</div>
            <div className="font-black text-2xl" style={{ color: athletic.primary_color }}>
              {price === 0 ? "Grátis" : `R$ ${price.toFixed(2)}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-60">Disponíveis</div>
            <div className="font-bold">{remaining} / {e.total_tickets}</div>
          </div>
        </div>
        {!user ? (
          <Button className="w-full" asChild><Link to="/auth"><Ticket className="size-4" /> Entrar para comprar</Link></Button>
        ) : !canBuy ? (
          <Button className="w-full" disabled>
            <Ticket className="size-4" /> {remaining <= 0 ? "Esgotado" : "Vendas fechadas"}
          </Button>
        ) : (
          <Button className="w-full" onClick={() => setOpen(true)}>
            <Ticket className="size-4" /> Comprar via Pix
          </Button>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ingresso — {e.title}</DialogTitle>
            <DialogDescription>
              Valor {isMember ? "sócio" : "visitante"}: <strong>R$ {price.toFixed(2)}</strong>. Confirmação automática após o Pix.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.buyer_name} onChange={(ev) => setForm({ ...form, buyer_name: ev.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail *</Label><Input value={form.buyer_email} onChange={(ev) => setForm({ ...form, buyer_email: ev.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.buyer_phone ?? ""} onChange={(ev) => setForm({ ...form, buyer_phone: ev.target.value })} /></div>
            </div>
            <div><Label>CPF *</Label><Input value={form.buyer_cpf} onChange={(ev) => setForm({ ...form, buyer_cpf: ev.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                const pix = await createPix({ data: { event_id: e.id, ...form } });
                setPixData(pix); setOpen(false); setPixOpen(true);
              } catch (err: any) { toast.error(err?.message ?? "Erro"); } finally { setSaving(false); }
            }}>{saving ? "Gerando Pix..." : "Gerar Pix"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixDialog open={pixOpen} onClose={() => setPixOpen(false)} data={pixData} title={`Pix — ${e.title}`} />
    </Card>
  );
}


/* ============ SÓCIOS ============ */
function SociosArea({ athletic, isMember, user }: { athletic: Athletic; isMember: boolean; user: any }) {
  if (!user) {
    return <EmptyDark icon={<Users className="size-12" />} title="Faça login para acessar a área do sócio"
      action={<Button asChild><Link to="/auth">Entrar</Link></Button>} />;
  }
  if (!isMember) {
    return <EmptyDark icon={<Crown className="size-12" />} title="Área exclusiva para sócios"
      desc={`Associe-se por R$ ${Number(athletic.membership_price).toFixed(2)} para ter acesso.`}
      action={<AssociarButton athletic={athletic} onDone={() => window.location.reload()} />} />;
  }
  return (
    <div className="space-y-4">
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="p-6">
          <h3 className="font-black text-2xl uppercase mb-2" style={{ color: athletic.primary_color }}>Bem-vindo, sócio!</h3>
          <p className="opacity-80">Área exclusiva com benefícios da {athletic.name}.</p>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-6">
            <h4 className="font-black text-lg mb-2">🏆 Grupo de Esportes</h4>
            <p className="text-sm opacity-70">Em breve: acesso ao grupo, treinos e competições.</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-6">
            <h4 className="font-black text-lg mb-2">🎉 Benefícios exclusivos</h4>
            <p className="text-sm opacity-70">Descontos em produtos e ingressos.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============ SOBRE ============ */
function SobrePanel({ athletic }: { athletic: Athletic }) {
  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardContent className="p-8 space-y-4">
        <h2 className="text-3xl font-black uppercase" style={{ color: athletic.primary_color }}>{athletic.name}</h2>
        {athletic.description && <p className="opacity-80 whitespace-pre-line">{athletic.description}</p>}
      </CardContent>
    </Card>
  );
}

/* ============ DIRETORIA ============ */
function DirectorPanel({ athletic }: { athletic: Athletic }) {
  return (
    <Tabs defaultValue="socios">
      <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto bg-white/5 border border-white/10">
        <TabsTrigger value="socios" className="data-[state=active]:bg-white data-[state=active]:text-black"><Users className="size-4 mr-1.5" />Sócios</TabsTrigger>
        <TabsTrigger value="produtos" className="data-[state=active]:bg-white data-[state=active]:text-black"><ShoppingBag className="size-4 mr-1.5" />Produtos</TabsTrigger>
        <TabsTrigger value="eventos" className="data-[state=active]:bg-white data-[state=active]:text-black"><PartyPopper className="size-4 mr-1.5" />Eventos</TabsTrigger>
        <TabsTrigger value="caixa" className="data-[state=active]:bg-white data-[state=active]:text-black"><Wallet className="size-4 mr-1.5" />Caixa</TabsTrigger>
        <TabsTrigger value="config" className="data-[state=active]:bg-white data-[state=active]:text-black"><Settings className="size-4 mr-1.5" />Config</TabsTrigger>
      </TabsList>
      <TabsContent value="socios" className="mt-4"><DirectorMembers athletic={athletic} /></TabsContent>
      <TabsContent value="produtos" className="mt-4"><DirectorProducts athletic={athletic} /></TabsContent>
      <TabsContent value="eventos" className="mt-4"><DirectorEvents athletic={athletic} /></TabsContent>
      <TabsContent value="caixa" className="mt-4"><DirectorCash athletic={athletic} /></TabsContent>
      <TabsContent value="config" className="mt-4"><DirectorConfig athletic={athletic} /></TabsContent>
    </Tabs>
  );
}

/* --- Sócios (Diretoria) --- */
function DirectorMembers({ athletic }: { athletic: Athletic }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [editing, setEditing] = useState<Partial<Membership> | null>(null);
  const upsert = useServerFn(upsertAthleticMember);
  const del = useServerFn(deleteAthleticMember);
  const confirm = useServerFn(confirmMembershipPayment);

  async function reload() {
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from("athletic_memberships").select("*").eq("athletic_id", athletic.id).order("created_at", { ascending: false }),
      supabase.from("athletic_membership_payments").select("*").eq("athletic_id", athletic.id).eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setMembers((data as any) ?? []);
    setPending((p as any) ?? []);
  }
  useEffect(() => { reload(); }, [athletic.id]);

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/40 text-white">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-black flex items-center gap-2"><Sparkles className="size-4" /> Pagamentos pendentes ({pending.length})</h4>
            {pending.map((p) => (
              <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-black/30 rounded border border-white/10">
                <div className="flex-1 text-sm">
                  <div className="font-bold">{p.buyer_name} — R$ {Number(p.amount).toFixed(2)}</div>
                  <div className="opacity-70 text-xs">{p.buyer_email} • Matr {p.matricula} • {p.semestre}º sem • CPF {p.buyer_cpf}</div>
                </div>
                <div className="flex gap-2">
                  {["pix", "dinheiro", "cartao"].map((m) => (
                    <Button key={m} size="sm" variant="outline" onClick={async () => {
                      try { await confirm({ data: { athletic_id: athletic.id, payment_id: p.id, method: m as any } }); toast.success("Confirmado"); reload(); } catch (e: any) { toast.error(e?.message); }
                    }}>{m}</Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h3 className="font-black text-lg">Sócios ({members.length})</h3>
        <Button size="sm" onClick={() => setEditing({ athletic_id: athletic.id, role: "socio", active: true, member_until: null } as any)}>
          <Plus className="size-4" /> Adicionar manualmente
        </Button>
      </div>

      <Card className="bg-white/5 border-white/10 text-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-2">Nome</th><th className="text-left p-2">E-mail</th>
              <th className="text-left p-2">Matr.</th><th className="text-left p-2">Sem</th>
              <th className="text-left p-2">CPF</th><th className="text-left p-2">Cargo</th>
              <th className="text-left p-2">Até</th><th></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && <tr><td colSpan={8} className="p-6 text-center opacity-60">Ninguém ainda</td></tr>}
            {members.map((m) => (
              <tr key={m.id} className="border-t border-white/10">
                <td className="p-2 font-medium">{m.full_name} {!m.active && <Badge variant="secondary" className="ml-1 text-[10px]">inativo</Badge>}</td>
                <td className="p-2 opacity-80">{m.email}</td>
                <td className="p-2 opacity-80">{m.matricula ?? "—"}</td>
                <td className="p-2 opacity-80">{m.semestre ?? "—"}</td>
                <td className="p-2 opacity-80">{m.cpf ?? "—"}</td>
                <td className="p-2">
                  <Badge style={m.role !== "socio" ? { background: athletic.primary_color } : {}}>{m.role}</Badge>
                </td>
                <td className="p-2 opacity-80">{m.member_until ? new Date(m.member_until).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Editar</Button>
                  <Button size="sm" variant="ghost" className="text-red-400" onClick={async () => {
                    if (!confirm2(`Remover ${m.full_name}?`)) return;
                    try { await del({ data: { athletic_id: athletic.id, member_id: m.id } }); toast.success("Removido"); reload(); } catch (e: any) { toast.error(e?.message); }
                  }}><Trash2 className="size-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar sócio" : "Adicionar sócio"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome completo *</Label><Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>E-mail *</Label><Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>CPF</Label><Input value={editing.cpf ?? ""} onChange={(e) => setEditing({ ...editing, cpf: e.target.value })} /></div>
                <div><Label>Matrícula</Label><Input value={editing.matricula ?? ""} onChange={(e) => setEditing({ ...editing, matricula: e.target.value })} /></div>
                <div><Label>Semestre</Label><Input value={editing.semestre ?? ""} onChange={(e) => setEditing({ ...editing, semestre: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cargo</Label>
                  <Select value={editing.role ?? "socio"} onValueChange={(v) => setEditing({ ...editing, role: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="socio">Sócio</SelectItem><SelectItem value="diretor">Diretor</SelectItem><SelectItem value="presidente">Presidente</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Sócio até (data)</Label><Input type="date" value={editing.member_until ?? ""} onChange={(e) => setEditing({ ...editing, member_until: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                await upsert({ data: { ...(editing as any), added_manually: !editing?.id } });
                toast.success("Salvo"); setEditing(null); reload();
              } catch (e: any) { toast.error(e?.message); }
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function confirm2(msg: string): boolean { return typeof window !== "undefined" && window.confirm(msg); }

/* --- Produtos (Diretoria) --- */
function DirectorProducts({ athletic }: { athletic: Athletic }) {
  const [cols, setCols] = useState<Collection[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [editCol, setEditCol] = useState<Partial<Collection> | null>(null);
  const [editProd, setEditProd] = useState<Partial<Product> | null>(null);
  const uc = useServerFn(upsertCollection); const dc = useServerFn(deleteCollection);
  const up = useServerFn(upsertProduct); const dp = useServerFn(deleteProduct);
  async function reload() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("athletic_collections").select("*").eq("athletic_id", athletic.id).order("display_order"),
      supabase.from("athletic_products").select("*").eq("athletic_id", athletic.id).order("created_at", { ascending: false }),
    ]);
    setCols((c as any) ?? []); setProds((p as any) ?? []);
  }
  useEffect(() => { reload(); }, [athletic.id]);

  return (
    <div className="space-y-6">
      {/* Coleções */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-black text-lg">Coleções ({cols.length})</h3>
          <Button size="sm" onClick={() => setEditCol({ athletic_id: athletic.id, active: true, display_order: 0 })}><Plus className="size-4" /> Nova coleção</Button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {cols.map((c) => (
            <Card key={c.id} className="bg-white/5 border-white/10 text-white">
              <CardContent className="p-3 flex justify-between items-center">
                <div><div className="font-bold">{c.name}</div><div className="text-xs opacity-60">{c.slug}</div></div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditCol(c)}>Editar</Button>
                  <Button size="sm" variant="ghost" className="text-red-400" onClick={async () => { if (!confirm2("Remover?")) return; await dc({ data: { athletic_id: athletic.id, id: c.id } }); reload(); }}><Trash2 className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Produtos */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-black text-lg">Produtos ({prods.length})</h3>
          <Button size="sm" onClick={() => setEditProd({ athletic_id: athletic.id, active: true, price: 0, discount_pct: 0, second_item_discount_pct: 0, images: [] })}><Plus className="size-4" /> Novo produto</Button>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
          {prods.map((p) => (
            <Card key={p.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
              <div className="aspect-square bg-black/40">
                {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center opacity-30"><ShoppingBag className="size-12" /></div>}
              </div>
              <CardContent className="p-3">
                <div className="font-bold text-sm line-clamp-2 h-10">{p.title}</div>
                <div className="text-xs opacity-70">R$ {Number(p.price).toFixed(2)} • Est: {p.stock ?? "∞"}</div>
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditProd(p)}>Editar</Button>
                  <Button size="sm" variant="ghost" className="text-red-400" onClick={async () => { if (!confirm2("Remover?")) return; await dp({ data: { athletic_id: athletic.id, id: p.id } }); reload(); }}><Trash2 className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog coleção */}
      <Dialog open={!!editCol} onOpenChange={(o) => !o && setEditCol(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCol?.id ? "Editar coleção" : "Nova coleção"}</DialogTitle></DialogHeader>
          {editCol && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editCol.name ?? ""} onChange={(e) => setEditCol({ ...editCol, name: e.target.value })} /></div>
              <div><Label>Slug (identificador)</Label><Input value={editCol.slug ?? ""} onChange={(e) => setEditCol({ ...editCol, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
              <div><Label>Descrição</Label><Textarea value={editCol.description ?? ""} onChange={(e) => setEditCol({ ...editCol, description: e.target.value })} /></div>
              <div><Label>Capa</Label><ImageUpload value={editCol.cover_url ?? ""} onChange={(url) => setEditCol({ ...editCol, cover_url: url })} folder="atletica/collections" /></div>
              <div><Label>Ordem</Label><Input type="number" value={editCol.display_order ?? 0} onChange={(e) => setEditCol({ ...editCol, display_order: +e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCol(null)}>Cancelar</Button>
            <Button onClick={async () => { try { await uc({ data: editCol as any }); toast.success("Salvo"); setEditCol(null); reload(); } catch (e: any) { toast.error(e?.message); } }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog produto */}
      <Dialog open={!!editProd} onOpenChange={(o) => !o && setEditProd(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editProd?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {editProd && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editProd.title ?? ""} onChange={(e) => setEditProd({ ...editProd, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editProd.description ?? ""} onChange={(e) => setEditProd({ ...editProd, description: e.target.value })} /></div>
              <div><Label>Coleção</Label>
                <Select value={editProd.collection_id ?? "__none"} onValueChange={(v) => setEditProd({ ...editProd, collection_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem coleção" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem coleção</SelectItem>
                    {cols.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Imagem principal</Label><ImageUpload value={editProd.images?.[0] ?? ""} onChange={(url) => setEditProd({ ...editProd, images: url ? [url] : [] })} folder="atletica/products" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={editProd.price ?? 0} onChange={(e) => setEditProd({ ...editProd, price: +e.target.value })} /></div>
                <div><Label>Preço sócio (opcional)</Label><Input type="number" step="0.01" value={editProd.member_price ?? ""} onChange={(e) => setEditProd({ ...editProd, member_price: e.target.value ? +e.target.value : null })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Desconto (%)</Label><Input type="number" step="0.01" value={editProd.discount_pct ?? 0} onChange={(e) => setEditProd({ ...editProd, discount_pct: +e.target.value })} /></div>
                <div><Label>Desc. 2ª peça (%)</Label><Input type="number" step="0.01" value={editProd.second_item_discount_pct ?? 0} onChange={(e) => setEditProd({ ...editProd, second_item_discount_pct: +e.target.value })} /></div>
                <div><Label>Estoque</Label><Input type="number" value={editProd.stock ?? ""} onChange={(e) => setEditProd({ ...editProd, stock: e.target.value ? +e.target.value : null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Badge (texto)</Label><Input value={editProd.badge_text ?? ""} onChange={(e) => setEditProd({ ...editProd, badge_text: e.target.value })} /></div>
                <div className="flex gap-2 items-end">
                  <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!editProd.is_new} onChange={(e) => setEditProd({ ...editProd, is_new: e.target.checked })} /> Novo</label>
                  <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!editProd.is_highlight} onChange={(e) => setEditProd({ ...editProd, is_highlight: e.target.checked })} /> Destaque</label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProd(null)}>Cancelar</Button>
            <Button onClick={async () => { try { await up({ data: editProd as any }); toast.success("Salvo"); setEditProd(null); reload(); } catch (e: any) { toast.error(e?.message); } }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --- Eventos (Diretoria) --- */
function DirectorEvents({ athletic }: { athletic: Athletic }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [editEv, setEditEv] = useState<Partial<EventRow> | null>(null);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const ue = useServerFn(upsertEvent); const de = useServerFn(deleteEvent);
  async function reload() {
    const { data } = await supabase.from("athletic_events").select("*").eq("athletic_id", athletic.id).order("created_at", { ascending: false });
    setEvents((data as any) ?? []);
  }
  useEffect(() => { reload(); }, [athletic.id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-lg">Eventos ({events.length})</h3>
        <Button size="sm" onClick={() => setEditEv({ athletic_id: athletic.id, published: true, online_sales_open: false, price_member: 0, price_visitor: 0, total_tickets: 100 })}><Plus className="size-4" /> Novo evento</Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.map((e) => (
          <Card key={e.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
            <div className="aspect-video bg-black/40">
              {e.image_url ? <img src={e.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${e.theme_color ?? athletic.primary_color}, ${athletic.secondary_color})` }} />}
            </div>
            <CardContent className="p-3 space-y-2">
              <div className="font-bold">{e.title}</div>
              <div className="text-xs opacity-70">Vendidos: {e.tickets_sold}/{e.total_tickets}</div>
              <div className="flex gap-1">
                <Button size="sm" className="flex-1" onClick={() => setSelected(e)}>Gerenciar</Button>
                <Button size="sm" variant="outline" onClick={() => setEditEv(e)}>Editar</Button>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={async () => { if (!confirm2("Remover evento?")) return; await de({ data: { athletic_id: athletic.id, id: e.id } }); reload(); }}><Trash2 className="size-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editEv} onOpenChange={(o) => !o && setEditEv(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editEv?.id ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
          {editEv && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editEv.title ?? ""} onChange={(e) => setEditEv({ ...editEv, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editEv.description ?? ""} onChange={(e) => setEditEv({ ...editEv, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Local</Label><Input value={editEv.location ?? ""} onChange={(e) => setEditEv({ ...editEv, location: e.target.value })} /></div>
                <div><Label>Cor tema</Label><Input type="color" value={editEv.theme_color ?? athletic.primary_color} onChange={(e) => setEditEv({ ...editEv, theme_color: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="datetime-local" value={editEv.starts_at?.slice(0, 16) ?? ""} onChange={(e) => setEditEv({ ...editEv, starts_at: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={editEv.ends_at?.slice(0, 16) ?? ""} onChange={(e) => setEditEv({ ...editEv, ends_at: e.target.value })} /></div>
              </div>
              <div><Label>Imagem</Label><ImageUpload value={editEv.image_url ?? ""} onChange={(url) => setEditEv({ ...editEv, image_url: url })} folder="atletica/events" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Preço sócio (R$)</Label><Input type="number" step="0.01" value={editEv.price_member ?? 0} onChange={(e) => setEditEv({ ...editEv, price_member: +e.target.value })} /></div>
                <div><Label>Preço visitante (R$)</Label><Input type="number" step="0.01" value={editEv.price_visitor ?? 0} onChange={(e) => setEditEv({ ...editEv, price_visitor: +e.target.value })} /></div>
                <div><Label>Total de ingressos</Label><Input type="number" value={editEv.total_tickets ?? 0} onChange={(e) => setEditEv({ ...editEv, total_tickets: +e.target.value })} /></div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!editEv.published} onChange={(e) => setEditEv({ ...editEv, published: e.target.checked })} /> Publicado</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEv(null)}>Cancelar</Button>
            <Button onClick={async () => { try { await ue({ data: editEv as any }); toast.success("Salvo"); setEditEv(null); reload(); } catch (e: any) { toast.error(e?.message); } }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && <EventManagerDialog athletic={athletic} event={selected} onClose={() => { setSelected(null); reload(); }} />}
    </div>
  );
}

/* --- Gerenciador de evento (tickets + venda manual) --- */
function EventManagerDialog({ athletic, event, onClose }: { athletic: Athletic; event: EventRow; onClose: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [batchQty, setBatchQty] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState({
    buyer_name: "", buyer_email: "", buyer_phone: "", buyer_cpf: "",
    price_paid: 0, methods: { pix: 0, dinheiro: 0, cartao: 0 },
  });
  const gen = useServerFn(generateTicketBatch);
  const registerSale = useServerFn(registerManualTicketSale);

  async function reload() {
    const { data } = await supabase.from("athletic_event_tickets").select("*").eq("event_id", event.id).order("created_at", { ascending: false });
    setTickets((data as any) ?? []);
  }
  useEffect(() => { reload(); }, [event.id]);

  const available = tickets.filter((t) => t.status === "available");
  const sold = tickets.filter((t) => t.status === "sold");

  async function generatePdf(onlyBatchId?: string) {
    const target = onlyBatchId ? tickets.filter((t) => t.batch_id === onlyBatchId) : available;
    if (target.length === 0) return toast.error("Nenhum ingresso disponível para PDF");
    const blob = await generateTicketsPdf({
      eventTitle: event.title, athleticName: athletic.name, location: event.location,
      startsAt: event.starts_at, primaryColor: athletic.primary_color, logoUrl: athletic.logo_url,
      tickets: target.map((t) => ({ code: t.code })),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ingressos-${event.title.replace(/\s+/g, "-")}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleGenerate() {
    if (batchQty < 1) return;
    setGenerating(true);
    try {
      const res = await gen({ data: { athletic_id: athletic.id, event_id: event.id, quantity: batchQty } });
      toast.success(`${res.tickets.length} ingressos gerados`);
      await reload();
      // Após gerar, oferecer PDF do lote novo
      const blob = await generateTicketsPdf({
        eventTitle: event.title, athleticName: athletic.name, location: event.location,
        startsAt: event.starts_at, primaryColor: athletic.primary_color, logoUrl: athletic.logo_url,
        tickets: res.tickets.map((t: any) => ({ code: t.code })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `ingressos-lote-${res.batch_id.slice(0, 6)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e?.message); } finally { setGenerating(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>Vendidos: {event.tickets_sold} / {event.total_tickets} • Emitidos: {tickets.length} • Disponíveis físicos: {available.length}</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-3 items-end">
          <div><Label>Emitir ingressos físicos (PDF)</Label>
            <div className="flex gap-2">
              <Input type="number" min={1} value={batchQty} onChange={(e) => setBatchQty(+e.target.value)} />
              <Button disabled={generating} onClick={handleGenerate}><FileDown className="size-4" /> Gerar {batchQty}</Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => generatePdf()}><FileDown className="size-4" /> PDF de todos disponíveis</Button>
            <Button onClick={() => setScannerOpen(true)}><Camera className="size-4" /> Registrar venda manual</Button>
          </div>
        </div>

        {/* Scanner + form */}
        {scannerOpen && (
          <Card className="mt-4">
            <CardContent className="p-3 space-y-3">
              {!pendingScan ? (
                <>
                  <p className="text-sm">Aponte a câmera para o QR do ingresso físico.</p>
                  <QrScanner onScan={(code) => {
                    setPendingScan(code.toUpperCase());
                    const priceDefault = event.price_visitor;
                    setSaleForm({ buyer_name: "", buyer_email: "", buyer_phone: "", buyer_cpf: "", price_paid: priceDefault, methods: { pix: priceDefault, dinheiro: 0, cartao: 0 } });
                  }} />
                  <Button variant="ghost" onClick={() => setScannerOpen(false)}>Fechar câmera</Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><QrCode className="size-4" /><code className="bg-black text-white px-2 py-1 rounded font-mono">{pendingScan}</code></div>
                  <div><Label>Nome *</Label><Input value={saleForm.buyer_name} onChange={(e) => setSaleForm({ ...saleForm, buyer_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Gmail *</Label><Input value={saleForm.buyer_email} onChange={(e) => setSaleForm({ ...saleForm, buyer_email: e.target.value })} /></div>
                    <div><Label>Número</Label><Input value={saleForm.buyer_phone} onChange={(e) => setSaleForm({ ...saleForm, buyer_phone: e.target.value })} /></div>
                  </div>
                  <div><Label>CPF *</Label><Input value={saleForm.buyer_cpf} onChange={(e) => setSaleForm({ ...saleForm, buyer_cpf: e.target.value })} /></div>
                  <div><Label>Preço pago (R$)</Label><Input type="number" step="0.01" value={saleForm.price_paid} onChange={(e) => setSaleForm({ ...saleForm, price_paid: +e.target.value })} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Métodos (soma = preço)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Pix</Label><Input type="number" step="0.01" value={saleForm.methods.pix} onChange={(e) => setSaleForm({ ...saleForm, methods: { ...saleForm.methods, pix: +e.target.value } })} /></div>
                      <div><Label className="text-xs">Dinheiro</Label><Input type="number" step="0.01" value={saleForm.methods.dinheiro} onChange={(e) => setSaleForm({ ...saleForm, methods: { ...saleForm.methods, dinheiro: +e.target.value } })} /></div>
                      <div><Label className="text-xs">Cartão</Label><Input type="number" step="0.01" value={saleForm.methods.cartao} onChange={(e) => setSaleForm({ ...saleForm, methods: { ...saleForm.methods, cartao: +e.target.value } })} /></div>
                    </div>
                    <div className="text-xs opacity-70">Soma: R$ {(saleForm.methods.pix + saleForm.methods.dinheiro + saleForm.methods.cartao).toFixed(2)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setPendingScan(null); }}>Escanear outro</Button>
                    <Button className="flex-1" onClick={async () => {
                      try {
                        await registerSale({ data: {
                          athletic_id: athletic.id, event_id: event.id, code: pendingScan,
                          buyer_name: saleForm.buyer_name, buyer_email: saleForm.buyer_email,
                          buyer_phone: saleForm.buyer_phone || null, buyer_cpf: saleForm.buyer_cpf,
                          price_paid: saleForm.price_paid, payment_methods: saleForm.methods,
                        } });
                        toast.success("Venda registrada!"); setPendingScan(null); reload();
                      } catch (e: any) { toast.error(e?.message); }
                    }}><CheckCircle2 className="size-4" /> Confirmar venda</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Lista de ingressos */}
        <div className="mt-4">
          <h4 className="font-bold mb-2">Ingressos ({tickets.length})</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted"><tr>
                <th className="text-left p-2">Código</th><th className="text-left p-2">Status</th>
                <th className="text-left p-2">Comprador</th><th className="text-left p-2">Canal</th>
                <th className="text-left p-2">Valor</th>
              </tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2 font-mono">{t.code}</td>
                    <td className="p-2"><Badge variant={t.status === "sold" ? "default" : "secondary"}>{t.status}</Badge></td>
                    <td className="p-2">{t.buyer_name ?? "—"}</td>
                    <td className="p-2">{t.sold_channel ?? "—"}</td>
                    <td className="p-2">{t.price_paid ? `R$ ${Number(t.price_paid).toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --- Caixa --- */
function DirectorCash({ athletic }: { athletic: Athletic }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [manual, setManual] = useState({ description: "", gross_amount: 0, is_income: true, category: "manual" as const });
  const add = useServerFn(addAthleticCashEntry);
  async function reload() {
    const { data } = await supabase.from("athletic_cash_entries").select("*").eq("athletic_id", athletic.id).order("occurred_at", { ascending: false });
    setEntries((data as any) ?? []);
  }
  useEffect(() => { reload(); }, [athletic.id]);
  const total = useMemo(() => entries.reduce((s, e) => s + (e.is_income ? +e.net_amount : -+e.net_amount), 0), [entries]);
  const byCat = useMemo(() => entries.reduce((m: any, e) => { m[e.category] = (m[e.category] ?? 0) + (e.is_income ? +e.net_amount : -+e.net_amount); return m; }, {}), [entries]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatBox label="Saldo total" value={`R$ ${total.toFixed(2)}`} highlight />
        <StatBox label="Produtos" value={`R$ ${(byCat.product ?? 0).toFixed(2)}`} />
        <StatBox label="Eventos online" value={`R$ ${(byCat.event_online ?? 0).toFixed(2)}`} />
        <StatBox label="Eventos manual" value={`R$ ${(byCat.event_manual ?? 0).toFixed(2)}`} />
        <StatBox label="Associações" value={`R$ ${(byCat.membership ?? 0).toFixed(2)}`} />
      </div>

      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="p-4 space-y-3">
          <h4 className="font-bold">Lançamento manual</h4>
          <div className="grid md:grid-cols-4 gap-2">
            <Input placeholder="Descrição" value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} />
            <Input type="number" step="0.01" placeholder="Valor" value={manual.gross_amount} onChange={(e) => setManual({ ...manual, gross_amount: +e.target.value })} />
            <Select value={manual.is_income ? "in" : "out"} onValueChange={(v) => setManual({ ...manual, is_income: v === "in" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="in">Entrada</SelectItem><SelectItem value="out">Saída</SelectItem></SelectContent>
            </Select>
            <Button onClick={async () => {
              try {
                await add({ data: { athletic_id: athletic.id, category: manual.is_income ? "manual" : "withdraw", description: manual.description, gross_amount: manual.gross_amount, is_income: manual.is_income } });
                setManual({ description: "", gross_amount: 0, is_income: true, category: "manual" }); reload();
              } catch (e: any) { toast.error(e?.message); }
            }}>Lançar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 text-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5"><tr>
            <th className="text-left p-2">Data</th><th className="text-left p-2">Categoria</th>
            <th className="text-left p-2">Descrição</th><th className="text-right p-2">Bruto</th>
            <th className="text-right p-2">Taxas</th><th className="text-right p-2">Líquido</th>
          </tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={6} className="p-6 text-center opacity-60">Sem movimentações</td></tr>}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-white/10">
                <td className="p-2 opacity-80">{new Date(e.occurred_at).toLocaleString("pt-BR")}</td>
                <td className="p-2"><Badge variant="secondary">{e.category}</Badge></td>
                <td className="p-2">{e.description}</td>
                <td className="p-2 text-right">R$ {Number(e.gross_amount).toFixed(2)}</td>
                <td className="p-2 text-right opacity-70">R$ {(Number(e.mp_fee) + Number(e.platform_fee)).toFixed(2)}</td>
                <td className={`p-2 text-right font-bold ${e.is_income ? "text-emerald-300" : "text-red-300"}`}>{e.is_income ? "+" : "-"} R$ {Number(e.net_amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --- Config --- */
function DirectorConfig({ athletic }: { athletic: Athletic }) {
  const [s, setS] = useState({ ...athletic });
  const upd = useServerFn(updateAthletic);
  return (
    <div className="space-y-4">
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="p-6 space-y-4">
          <div><Label>Nome</Label><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={4} value={s.description ?? ""} onChange={(e) => setS({ ...s, description: e.target.value })} /></div>
          <div><Label>Logo (redonda)</Label><ImageUpload value={s.logo_url ?? ""} onChange={(url) => setS({ ...s, logo_url: url })} folder="atletica/brand" /></div>
          <div><Label>Capa (imagem de fundo)</Label><ImageUpload value={s.cover_url ?? ""} onChange={(url) => setS({ ...s, cover_url: url })} folder="atletica/brand" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cor primária</Label><Input type="color" value={s.primary_color} onChange={(e) => setS({ ...s, primary_color: e.target.value })} /></div>
            <div><Label>Cor secundária</Label><Input type="color" value={s.secondary_color} onChange={(e) => setS({ ...s, secondary_color: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor da associação (R$)</Label><Input type="number" step="0.01" value={s.membership_price} onChange={(e) => setS({ ...s, membership_price: +e.target.value })} /></div>
            <div><Label>Período (dias)</Label><Input type="number" value={s.membership_period_days} onChange={(e) => setS({ ...s, membership_period_days: +e.target.value })} /></div>
          </div>
          <Button onClick={async () => {
            try { await upd({ data: { ...s, id: athletic.id } as any }); toast.success("Salvo"); }
            catch (e: any) { toast.error(e?.message); }
          }}>Salvar</Button>
        </CardContent>
      </Card>

      <Card className="bg-emerald-500/5 border-emerald-500/30 text-white">
        <CardContent className="p-6">
          <h4 className="font-bold flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400" /> Vendas online via Pix (ativo)</h4>
          <p className="text-sm opacity-80 mt-2">Associações, ingressos e produtos aceitam Pix na conta da plataforma. Cada pagamento aprovado entra automaticamente no caixa da atlética. Taxas da plataforma configuráveis no painel admin.</p>
        </CardContent>

      </Card>
    </div>
  );
}

/* ============ helpers ============ */
function Chip({ children, active, onClick, color }: any) {
  return (
    <button onClick={onClick} className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition"
      style={active ? { background: color ?? "white", color: color ? "white" : "black" } : { background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}>
      {children}
    </button>
  );
}
function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`${highlight ? "bg-white text-black" : "bg-white/5 border-white/10 text-white"}`}>
      <CardContent className="p-3">
        <div className="text-xs opacity-70 uppercase">{label}</div>
        <div className="font-black text-xl">{value}</div>
      </CardContent>
    </Card>
  );
}
function EmptyDark({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 space-y-4 opacity-90">
      <div className="mx-auto text-white/60">{icon}</div>
      <div>
        <h3 className="font-black text-xl">{title}</h3>
        {desc && <p className="opacity-70 mt-1">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

/* ============ COLEÇÕES — MARQUEE (auto-scroll) ============ */
function CollectionsMarquee({ athletic }: { athletic: Athletic }) {
  const [cols, setCols] = useState<Collection[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("athletic_collections")
        .select("*").eq("athletic_id", athletic.id).eq("active", true).order("display_order");
      setCols((data as any) ?? []);
    })();
  }, [athletic.id]);
  if (cols.length === 0) return null;
  const loop = [...cols, ...cols];
  return (
    <section className="relative py-10 border-y border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest opacity-60 font-bold">Explore</div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Coleções</h2>
        </div>
        <div className="text-xs opacity-60">{cols.length} coleção{cols.length > 1 ? "es" : ""}</div>
      </div>
      <div className="marquee-mask">
        <div className="flex gap-5 w-max animate-marquee hover:[animation-play-state:paused]">
          {loop.map((c, i) => (
            <div key={`${c.id}-${i}`} className="w-72 shrink-0 group cursor-pointer">
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl group-hover:scale-[1.02] transition-transform">
                {c.cover_url ? (
                  <img src={c.cover_url} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${athletic.primary_color}, ${athletic.secondary_color})` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: athletic.primary_color }}>Coleção</div>
                  <div className="text-2xl font-black uppercase tracking-tight leading-tight">{c.name}</div>
                  {c.description && <div className="text-xs opacity-80 mt-1 line-clamp-2">{c.description}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ ESPORTES — Grid ============ */
type Sport = { id: string; athletic_id: string; name: string; description: string | null; image_url: string | null; coach: string | null; schedule: string | null; display_order: number; active: boolean };

function SportsShowcase({ athletic }: { athletic: Athletic }) {
  const [sports, setSports] = useState<Sport[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("athletic_sports" as any)
        .select("*").eq("athletic_id", athletic.id).eq("active", true).order("display_order"));
      setSports((data as any) ?? []);
    })();
  }, [athletic.id]);
  if (sports.length === 0) return null;
  return (
    <section className="relative py-14 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-60 font-bold">Modalidades</div>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Esportes</h2>
          </div>
          <div className="text-xs opacity-60">{sports.length} modalidade{sports.length > 1 ? "s" : ""}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sports.map((s) => (
            <div key={s.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black shadow-xl">
              {s.image_url ? (
                <img src={s.image_url} alt={s.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              ) : (
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${athletic.primary_color}, ${athletic.secondary_color})` }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="font-black text-lg uppercase leading-tight drop-shadow-lg">{s.name}</div>
                {s.coach && <div className="text-[11px] opacity-80 mt-0.5">Treinador: {s.coach}</div>}
                {s.schedule && <div className="text-[11px] opacity-70">{s.schedule}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ DIRETORIA — Esportes ============ */
function DirectorSports({ athletic }: { athletic: Athletic }) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [editing, setEditing] = useState<Partial<Sport> | null>(null);
  const upsert = useServerFn(upsertSport);
  const del = useServerFn(deleteSport);
  async function reload() {
    const { data } = await (supabase.from("athletic_sports" as any)
      .select("*").eq("athletic_id", athletic.id).order("display_order"));
    setSports((data as any) ?? []);
  }
  useEffect(() => { reload(); }, [athletic.id]);
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-lg">Esportes ({sports.length})</h3>
        <Button size="sm" onClick={() => setEditing({ athletic_id: athletic.id, active: true, display_order: sports.length })}>
          <Plus className="size-4" /> Novo esporte
        </Button>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sports.map((s) => (
          <Card key={s.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
            <div className="aspect-square bg-black/40">
              {s.image_url ? <img src={s.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center opacity-30"><Trophy className="size-12" /></div>}
            </div>
            <CardContent className="p-3">
              <div className="font-bold">{s.name}</div>
              {s.coach && <div className="text-xs opacity-70">Treinador: {s.coach}</div>}
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(s)}>Editar</Button>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={async () => { if (!confirm2("Remover?")) return; await del({ data: { athletic_id: athletic.id, id: s.id } }); reload(); }}><Trash2 className="size-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar esporte" : "Novo esporte"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>Imagem</Label><ImageUpload value={editing.image_url ?? ""} onChange={(url) => setEditing({ ...editing, image_url: url })} folder="atletica/sports" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Treinador</Label><Input value={editing.coach ?? ""} onChange={(e) => setEditing({ ...editing, coach: e.target.value })} /></div>
                <div><Label>Horário</Label><Input placeholder="Ex: Ter/Qui 20h" value={editing.schedule ?? ""} onChange={(e) => setEditing({ ...editing, schedule: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Ordem</Label><Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: +e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm pt-6"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Ativo</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={async () => {
              try { await upsert({ data: editing as any }); toast.success("Salvo"); setEditing(null); reload(); }
              catch (e: any) { toast.error(e?.message); }
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
