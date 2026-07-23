import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { QrScanner } from "@/components/qr-scanner";
import { ImageUpload } from "@/components/image-upload";
import { generateTicketsPdf } from "@/lib/athletic-tickets-pdf";
import {
  ArrowLeft,
  ShoppingBag,
  ShoppingCart,
  Ticket,
  Users,
  Shield,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  QrCode,
  FileDown,
  Wallet,
  Settings,
  Trophy,
  Store,
  PartyPopper,
  Loader2,
  Camera,
  Crown,
  CheckCircle2,
  X,
  CreditCard,
  MapPin,
  Calendar,
  Clock,
  Flame,
  Handshake,
  Tag,
  UserPlus,
  UserMinus,
  IdCard,
  LayoutDashboard,
  Info,
  Home,
  Link2,
  Power,
  BookOpen,
  Eye,
  Paperclip,
  Receipt,
  TrendingUp,
  Images,
  ArrowRight,
  Wrench,
  Download,
  Upload,
  ClockAlert,
} from "lucide-react";
import {
  upsertAthleticMember,
  deleteAthleticMember,
  requestSelfMembership,
  confirmMembershipPayment,
  upsertCollection,
  deleteCollection,
  upsertProduct,
  deleteProduct,
  upsertEvent,
  deleteEvent,
  generateTicketBatch,
  registerManualTicketSale,
  addAthleticCashEntry,
  deleteAthleticCashEntry,
  updateAthletic,
  upsertSport,
  deleteSport,
  upsertPartner,
  deletePartner,
  enrollInSport,
  unenrollFromSport,
  updateOrderItemDelivery,
  registerManualProductSale,
  retryProductOrderCheckout,
} from "@/lib/athletic.functions";

import {
  setAthleticMaintenance,
  deletePendingMembershipPayment,
  searchBuyerSuggestions,
  listPendingProductAndTicketPayments,
  resolveProductOrderPayment,
  resolveTicketPayment,
  bulkImportMembers,
} from "@/lib/athletic-extras.functions";

import {
  createMembershipPixPayment,
  createEventTicketPixPayment,
  createProductPixPayment,
  createMembershipCardPayment,
  createEventTicketCardPayment,
  createCartCheckout,
} from "@/lib/athletic-payments.functions";
import {
  setMembershipsOpen,
  upsertMembershipCycle,
  deleteMembershipCycle,
  getInfinitepayStatus,
  saveInfinitepayCredentials,
  disconnectInfinitepay,
  isInfinitepayEnabled,
} from "@/lib/athletic-config.functions";
import {
  createMembershipInfinitepayCheckout,
  createEventTicketInfinitepayCheckout,
  createCartInfinitepayCheckout,
  verifyInfinitepayCheckout,
} from "@/lib/infinitepay-payments.functions";
import { useQueryClient } from "@tanstack/react-query";

import { AtleticaCartProvider, useAtleticaCart, type CartItem } from "@/hooks/use-atletica-cart";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/atletica")({
  component: AtleticaPage,
  head: () => ({
    meta: [
      { title: "AAAMD Desbravadores — Atlética" },
      {
        name: "description",
        content: "Atlética Acadêmica de Medicina Desbravadores. Produtos, eventos e área do sócio.",
      },
      { property: "og:title", content: "AAAMD Desbravadores" },
      { property: "og:description", content: "Há 19 anos a maior do Oeste. Produtos, eventos e área do sócio." },
    ],
  }),
});

type Athletic = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  president_id: string | null;
  membership_price: number;
  membership_period_days: number;
  published: boolean;
};
type Membership = {
  id: string;
  athletic_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  matricula: string | null;
  semestre: string | null;
  role: "socio" | "diretor" | "presidente";
  member_until: string | null;
  active: boolean;
};
type Collection = {
  id: string;
  athletic_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  display_order: number;
  active: boolean;
};
type Product = {
  id: string;
  athletic_id: string;
  collection_id: string | null;
  title: string;
  description: string | null;
  images: string[];
  price: number;
  member_price: number | null;
  discount_pct: number;
  second_item_discount_pct: number;
  stock: number | null;
  is_highlight: boolean;
  is_new: boolean;
  badge_text: string | null;
  active: boolean;
  show_stock_warning?: boolean;
  stock_warning_threshold?: number | null;
  sales_deadline?: string | null;
};

type EventRow = {
  id: string;
  athletic_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  image_url: string | null;
  theme_color: string | null;
  price_member: number;
  price_visitor: number;
  total_tickets: number;
  tickets_sold: number;
  published: boolean;
  online_sales_open: boolean;
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
    if (!user || !ath) {
      setMyMembership(null);
      setIsDirector(false);
      return;
    }
    (async () => {
      const [{ data: mem }, { data: dRes }] = await Promise.all([
        supabase
          .from("athletic_memberships")
          .select("*")
          .eq("athletic_id", ath.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("is_athletic_director", { _user_id: user.id, _athletic_id: ath.id }),
      ]);
      setMyMembership((mem as any) ?? null);
      setIsDirector(Boolean(dRes));
    })();
  }, [user, ath]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin size-8" />
      </div>
    );
  }
  if (!ath) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p>Atlética não encontrada.</p>
        <Button asChild>
          <Link to="/">Voltar</Link>
        </Button>
      </div>
    );
  }

  const isActiveMember =
    !!myMembership &&
    myMembership.active &&
    (!myMembership.member_until || new Date(myMembership.member_until) >= new Date());

  const inMaintenance = !!(ath as any).maintenance_enabled;
  if (inMaintenance && !isDirector) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="size-16 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center mx-auto ring-1 ring-orange-500/30">
            <Wrench className="size-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Atlética em Manutenção</h1>
          <p className="text-sm text-neutral-400">A diretoria está atualizando esta área. Voltaremos em breve.</p>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }


  return (
    <AtleticaCartProvider>
      <PaidReturnToast />
      <div
        className="min-h-screen bg-neutral-950 text-white lg:pl-[240px]"
        style={{
          // @ts-expect-error
          "--ath-primary": ath.primary_color,
          "--ath-secondary": ath.secondary_color,
        }}
      >
        {/* HEADER */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-neutral-950/80 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <Link to="/">
                <ArrowLeft className="size-4" /> Voltar
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <CartButton
                athleticName={ath.short_name ?? ath.name}
                primaryColor={ath.primary_color}
                accentColor={ath.secondary_color}
              />
              <div className="flex items-center gap-2">
                {ath.logo_url && (
                  <img src={ath.logo_url} alt="" className="size-9 rounded-full object-cover border border-white/20" />
                )}
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] uppercase tracking-widest opacity-60">Atlética</div>
                  <div className="font-black text-sm leading-tight" style={{ color: ath.primary_color }}>
                    {ath.short_name ?? ath.name}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* SIDEBAR + CONTENT */}
        <main className="max-w-6xl mx-auto px-3 md:px-6 py-6">
          <AtleticaSectionLayout
            primaryColor={ath.primary_color}
            isMember={isActiveMember}
            isDirector={isDirector}
            hasUser={!!user}
            directorTabs={(myMembership as any)?.director_tabs ?? null}
            renderSection={(section) => {
              if (section === "inicio")
                return <InicioSection ath={ath} isActiveMember={isActiveMember} myMembership={myMembership} />;
              if (section === "produtos") return <PublicProducts athletic={ath} isMember={isActiveMember} />;
              if (section === "eventos") return <PublicEvents athletic={ath} isMember={isActiveMember} />;
              if (section === "esportes") return <SportsSection athletic={ath} user={user} isMember={isActiveMember} />;
              if (section === "compras" && user) return <PurchaseHistorySection athletic={ath} user={user} />;
              if (section === "socio" && isActiveMember)
                return <MemberDashboard athletic={ath} user={user} profile={profile} membership={myMembership} />;
              if (section === "diretoria" && isDirector)
                return (
                  <DirectorPanel
                    athletic={ath}
                    allowedTabs={(myMembership as any)?.director_tabs ?? null}
                    isPresident={myMembership?.role === "presidente"}
                  />
                );
              return null;
            }}
          />
        </main>

        <footer className="mt-16 border-t border-white/10 py-8 text-center text-xs opacity-60">
          <p>{ath.name} • ligasuno.com.br</p>
        </footer>
      </div>
    </AtleticaCartProvider>
  );
}

/* ============ Toast de retorno do checkout ============ */
function PaidReturnToast() {
  const queryClient = useQueryClient();
  const verifyFn = useServerFn(verifyInfinitepayCheckout);
  useEffect(() => {
    const url = new URL(window.location.href);
    const paid = url.searchParams.get("paid");
    const nsu = url.searchParams.get("nsu");
    if (paid === "1") toast.success("Pagamento aprovado! Confirmando…");
    else if (paid === "0") toast.error("Pagamento não concluído. Tente novamente.");
    else if (paid === "pending") toast.info("Pagamento pendente. Aguarde a confirmação.");
    if (paid) {
      url.searchParams.delete("paid");
      url.searchParams.delete("nsu");
      window.history.replaceState({}, "", url.toString());
    }
    if (paid === "1" && nsu) {
      let cancelled = false;
      const invalidate = () => {
        queryClient.invalidateQueries({
          predicate: (q: any) => {
            const k = q.queryKey?.[0];
            return (
              typeof k === "string" &&
              (k.includes("athletic") ||
                k.includes("purchase") ||
                k.includes("membership") ||
                k.includes("orders") ||
                k.includes("tickets"))
            );
          },
        });
      };
      const attempts = [0, 2000, 5000, 10000];
      attempts.forEach((delay) => {
        setTimeout(async () => {
          if (cancelled) return;
          try {
            const r = await verifyFn({ data: { nsu } });
            if ((r as any)?.paid) {
              toast.success("Pagamento confirmado!");
              invalidate();
              cancelled = true;
            }
          } catch {
            /* silencioso — webhook confirma depois */
          }
        }, delay);
      });
      return () => {
        cancelled = true;
      };
    }
  }, []);
  return null;
}

/* ============ CARRINHO — botão do header + drawer ============ */
function CartButton({
  athleticName,
  primaryColor,
  accentColor,
}: {
  athleticName: string;
  primaryColor: string;
  accentColor: string;
}) {
  const { count, items, subtotal, total, savings, updateQty, removeItem, clear } = useAtleticaCart();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={`Carrinho com ${count} itens`}
            className="relative inline-flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition text-white"
          >
            <ShoppingCart className="size-4" />
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                style={{ background: accentColor }}
              >
                {count}
              </span>
            )}
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-neutral-950 text-white border-l border-white/10 flex flex-col"
        >
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="size-4" /> Carrinho — {athleticName}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 space-y-3">
            {items.length === 0 && (
              <div className="text-center py-12 opacity-60">
                <ShoppingCart className="size-12 mx-auto mb-3 opacity-40" />
                <p className="font-bold">Seu carrinho está vazio</p>
                <p className="text-xs mt-1">Adicione produtos para continuar.</p>
              </div>
            )}
            {items.map((it) => (
              <div key={it.product_id} className="flex gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="size-16 rounded overflow-hidden bg-black/40 shrink-0">
                  {it.cover ? <img src={it.cover} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold line-clamp-2">{it.title}</div>
                  <div className="text-xs opacity-70 mt-0.5">R$ {it.unit_price.toFixed(2)} cada</div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => updateQty(it.product_id, it.quantity - 1)}
                      className="size-6 rounded border border-white/20 flex items-center justify-center hover:bg-white/10"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(it.product_id, it.quantity + 1)}
                      className="size-6 rounded border border-white/20 flex items-center justify-center hover:bg-white/10"
                    >
                      <Plus className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(it.product_id)}
                      className="ml-auto text-xs opacity-60 hover:text-red-400 hover:opacity-100"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between text-sm opacity-80">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-sm" style={{ color: accentColor }}>
                  <span>Descontos</span>
                  <span>- R$ {savings.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-black">
                <span>Total</span>
                <span style={{ color: primaryColor }}>R$ {total.toFixed(2)}</span>
              </div>
              {user ? (
                <Button
                  size="lg"
                  className="w-full font-black uppercase tracking-wider text-white border-0 hover:opacity-95"
                  style={{ background: primaryColor }}
                  onClick={() => {
                    setOpen(false);
                    setCheckoutOpen(true);
                  }}
                >
                  <CreditCard className="size-4" /> Finalizar compra
                </Button>
              ) : (
                <Button size="lg" asChild className="w-full" style={{ background: primaryColor }}>
                  <Link to="/auth">
                    <ShoppingCart className="size-4" /> Entrar para finalizar
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs opacity-60 hover:opacity-100 hover:bg-white/5"
                onClick={clear}
              >
                Esvaziar carrinho
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <CartCheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        primaryColor={primaryColor}
        accentColor={accentColor}
      />
    </>
  );
}

function CartCheckoutDialog({
  open,
  onClose,
  primaryColor,
  accentColor,
}: {
  open: boolean;
  onClose: () => void;
  primaryColor: string;
  accentColor: string;
}) {
  const { items, total, subtotal, savings, clear } = useAtleticaCart();
  const { profile } = useAuth();
  const [athLogo, setAthLogo] = useState<string | null>(null);
  const [athName, setAthName] = useState<string>("");
  const [form, setForm] = useState({
    buyer_name: profile?.full_name ?? "",
    buyer_email: profile?.email ?? "",
    buyer_phone: profile?.phone ?? "",
    buyer_cpf: "",
    notes: "",
  });
  const [saving, setSaving] = useState<null | "mp" | "ip">(null);
  const checkout = useServerFn(createCartCheckout);
  const checkoutIp = useServerFn(createCartInfinitepayCheckout);
  const checkIp = useServerFn(isInfinitepayEnabled);
  const [ipEnabled, setIpEnabled] = useState(false);
  const [athleticId, setAthleticId] = useState<string | null>(null);
  useEffect(() => {
    if (open && profile)
      setForm((f) => ({
        ...f,
        buyer_name: f.buyer_name || profile.full_name || "",
        buyer_email: f.buyer_email || profile.email || "",
        buyer_phone: f.buyer_phone || profile.phone || "",
        buyer_cpf: f.buyer_cpf || (profile.cpf ? formatCpfMask(profile.cpf) : ""),
      }));
  }, [open, profile]);
  useEffect(() => {
    if (!open || items.length === 0) return;
    (async () => {
      const { data: prod } = await supabase
        .from("athletic_products")
        .select("athletic_id")
        .eq("id", items[0].product_id)
        .maybeSingle();
      if (!prod) return;
      const aid = (prod as any).athletic_id as string;
      setAthleticId(aid);
      const { data: ath } = await supabase
        .from("athletics")
        .select("logo_url,name,short_name")
        .eq("id", aid)
        .maybeSingle();
      if (ath) {
        setAthLogo((ath as any).logo_url);
        setAthName((ath as any).short_name ?? (ath as any).name);
      }
      try {
        const r = await checkIp({ data: { athletic_id: aid } });
        setIpEnabled(!!(r as any)?.enabled);
      } catch {
        setIpEnabled(false);
      }
    })();
  }, [open, items]);
  if (items.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-neutral-950 text-white border-white/10 p-0 overflow-hidden">
        {/* Header temático da atlética */}
        <div
          className="relative px-6 py-5 border-b border-white/10"
          style={{ background: `linear-gradient(135deg, ${primaryColor}22, transparent 60%)` }}
        >
          <div className="flex items-center gap-3">
            {athLogo ? (
              <div className="size-12 rounded-full overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <img src={athLogo} alt={athName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="size-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: primaryColor }}
              >
                <Shield className="size-6 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Checkout {athName}</div>
              <DialogTitle className="text-white text-xl font-black leading-tight truncate">
                Finalizar pedido
              </DialogTitle>
            </div>
            <div className="ml-auto text-right shrink-0">
              <div className="text-[10px] uppercase opacity-70 font-bold tracking-widest">Total</div>
              <div className="text-2xl font-black" style={{ color: accentColor }}>
                R$ {total.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <DialogDescription className="text-neutral-300 text-sm">
            Você será redirecionado para o checkout da <strong className="text-white">InfinitePay</strong> para pagar
            com <strong className="text-white">Pix</strong>, <strong className="text-white">cartão de crédito</strong>{" "}
            ou <strong className="text-white">cartão de débito</strong>.
          </DialogDescription>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1 text-sm">
            <div className="flex justify-between opacity-80">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            {savings > 0 && (
              <div className="flex justify-between" style={{ color: accentColor }}>
                <span>Descontos</span>
                <span>- R$ {savings.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black pt-1 border-t border-white/10 mt-1">
              <span>Total</span>
              <span style={{ color: accentColor }}>R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input
                className="bg-white/5 border-white/15 rounded-lg"
                value={form.buyer_name}
                onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-mail *</Label>
                <Input
                  className="bg-white/5 border-white/15 rounded-lg"
                  value={form.buyer_email}
                  onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  className="bg-white/5 border-white/15 rounded-lg"
                  value={form.buyer_phone}
                  onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>CPF *</Label>
              <Input
                className="bg-white/5 border-white/15 rounded-lg"
                value={form.buyer_cpf}
                onChange={(e) => setForm({ ...form, buyer_cpf: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações (tamanho, cor…)</Label>
              <Textarea
                className="bg-white/5 border-white/15 rounded-lg"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-white/10 bg-black/40 gap-2 flex-col sm:flex-row">
          <Button variant="ghost" className="text-white hover:bg-white/10 rounded-lg" onClick={onClose}>
            Cancelar
          </Button>
          {ipEnabled ? (
            <Button
              disabled={!!saving}
              className="rounded-lg font-black uppercase tracking-wider text-white border-0 shadow-lg hover:opacity-95 transition"
              style={{ background: accentColor, boxShadow: `0 10px 30px -12px ${accentColor}` }}
              onClick={async () => {
                if (!athleticId) return;
                setSaving("ip");
                try {
                  const r = await checkoutIp({
                    data: {
                      athletic_id: athleticId,
                      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
                      ...form,
                    },
                  });
                  clear();
                  window.location.href = (r as any).checkout_url;
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro");
                  setSaving(null);
                }
              }}
            >
              <CreditCard className="size-4" /> {saving === "ip" ? "Redirecionando..." : "Pagar com InfinitePay"}
            </Button>
          ) : (
            <div className="text-xs text-white/60 italic">
              Pagamentos indisponíveis: a atlética ainda não conectou a InfinitePay.
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ ASSOCIAR-SE ============ */
/* ============ Modal Pix genérico ============ */
function PixDialog({
  open,
  onClose,
  data,
  title,
}: {
  open: boolean;
  onClose: () => void;
  data: { qr_code?: string; qr_code_base64?: string; ticket_url?: string; amount: number } | null;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pague com Pix escaneando o QR ou copiando o código. A confirmação é automática (leva alguns segundos após o
            pagamento).
          </DialogDescription>
        </DialogHeader>
        {data ? (
          <div className="space-y-3 text-center">
            {data.qr_code_base64 && (
              <img
                src={`data:image/png;base64,${data.qr_code_base64}`}
                alt="QR Pix"
                className="mx-auto w-64 h-64 rounded-lg border"
              />
            )}
            <div className="text-2xl font-black">R$ {data.amount.toFixed(2)}</div>
            {data.qr_code && (
              <div className="space-y-2">
                <Label className="text-xs">Pix Copia e Cola</Label>
                <Textarea
                  readOnly
                  value={data.qr_code}
                  className="text-xs font-mono h-20"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(data.qr_code!);
                    toast.success("Código copiado");
                  }}
                >
                  Copiar código
                </Button>
              </div>
            )}
            {data.ticket_url && (
              <a href={data.ticket_url} target="_blank" rel="noreferrer" className="text-sm underline opacity-80">
                Abrir no Mercado Pago
              </a>
            )}
          </div>
        ) : (
          <div className="py-8 text-center opacity-70">
            <Loader2 className="animate-spin mx-auto size-8" />
          </div>
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
  const [currentCycle, setCurrentCycle] = useState<{
    id: string;
    name: string;
    ends_at: string;
    price_new: number;
  } | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    matricula: "",
    semestre: "",
  });
  // Prefill do perfil (CPF, matrícula, turma/semestre)
  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      full_name: f.full_name || profile.full_name || "",
      email: f.email || profile.email || "",
      phone: f.phone || profile.phone || "",
      cpf: f.cpf || (profile.cpf ? formatCpfMask(profile.cpf) : ""),
      matricula: f.matricula || profile.matricula || "",
      semestre: f.semestre || (profile.current_semester != null ? String(profile.current_semester) : ""),
    }));
  }, [profile]);
  // Busca ciclo atual da atlética
  useEffect(() => {
    if (!open) return;
    supabase
      .from("athletic_membership_cycles")
      .select("id,name,ends_at,price_new,is_current,open")
      .eq("athletic_id", athletic.id)
      .eq("is_current", true)
      .maybeSingle()
      .then(({ data }) => setCurrentCycle(data ? (data as any) : null));
  }, [open, athletic.id]);
  const request = useServerFn(requestSelfMembership);
  const createIp = useServerFn(createMembershipInfinitepayCheckout);
  const [pixData, setPixData] = useState<any>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const { user } = useAuth();
  const displayPrice = currentCycle ? Number(currentCycle.price_new) : Number(athletic.membership_price);
  if (!user) {
    return (
      <Button
        asChild
        size="lg"
        className="text-lg px-8 py-6 h-auto font-black uppercase tracking-wider shadow-2xl text-white border-0 hover:opacity-95 transition"
        style={{ background: athletic.primary_color }}
      >
        <Link to="/auth">
          <Crown className="size-5" /> Associar-se • R$ {displayPrice.toFixed(2)}
        </Link>
      </Button>
    );
  }
  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="text-lg px-8 py-6 h-auto font-black uppercase tracking-wider shadow-2xl hover:opacity-95 transition text-white border-0"
        style={{ background: athletic.primary_color }}
      >
        <Crown className="size-5" /> Associar-se • R$ {displayPrice.toFixed(2)}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Associar-se à {athletic.name}</DialogTitle>
            <DialogDescription>
              {currentCycle ? (
                <>
                  Ciclo vigente <strong>{currentCycle.name}</strong>. Após confirmar o pagamento, você será sócio(a) até{" "}
                  <strong>{new Date(currentCycle.ends_at).toLocaleDateString("pt-BR")}</strong> (fim do ciclo atual).
                </>
              ) : (
                <>Preencha seus dados. A liberação ocorre assim que o pagamento for confirmado.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-mail *</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>CPF *</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Matrícula *</Label>
                <Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
              </div>
              <div>
                <Label>Semestre *</Label>
                <Input value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })} />
              </div>
            </div>
            <div className="pt-2 text-xs opacity-70">
              Pagamento via <strong>InfinitePay</strong> — Pix, cartão de crédito ou débito.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saving}
              style={{ background: athletic.primary_color, color: "white" }}
              className="border-0 hover:opacity-95"
              onClick={async () => {
                setSaving(true);
                try {
                  const r = await request({ data: { athletic_id: athletic.id, ...form } });
                  const c = await createIp({ data: { payment_id: r.payment_id } });
                  setOpen(false);
                  window.location.href = (c as any).checkout_url;
                  return;
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Processando..." : "Pagar com InfinitePay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixDialog open={pixOpen} onClose={() => setPixOpen(false)} data={pixData} title="Pix — Associação AAAMD" />
    </>
  );
}

function formatCpfMask(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/* ============ PÚBLICO: PRODUTOS ============ */
function PublicProducts({ athletic, isMember }: { athletic: Athletic; isMember: boolean }) {
  const [cols, setCols] = useState<Collection[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase
          .from("athletic_collections")
          .select("*")
          .eq("athletic_id", athletic.id)
          .eq("active", true)
          .order("display_order"),
        supabase
          .from("athletic_products")
          .select("*")
          .eq("athletic_id", athletic.id)
          .eq("active", true)
          .order("is_highlight", { ascending: false }),
      ]);
      setCols((c as any) ?? []);
      setProds((p as any) ?? []);
    })();
  }, [athletic.id]);

  useEffect(() => {
    const onFilter = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      if (id) setFilter(id);
    };
    window.addEventListener("aaamd:filter-collection", onFilter as EventListener);
    return () => window.removeEventListener("aaamd:filter-collection", onFilter as EventListener);
  }, []);

  const filtered = filter === "all" ? prods : prods.filter((p) => p.collection_id === filter);
  if (prods.length === 0) {
    return (
      <div id="produtos-section">
        <EmptyDark
          icon={<Store className="size-12" />}
          title="Nenhum produto disponível ainda"
          desc="A diretoria ainda não publicou produtos. Volte em breve!"
        />
      </div>
    );
  }
  return (
    <div id="produtos-section" className="space-y-6">
      {cols.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            Todos
          </Chip>
          {cols.map((c) => (
            <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} color={athletic.primary_color}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} athletic={athletic} isMember={isMember} />
        ))}
      </div>
    </div>
  );
}

function computeProductPricing(product: Product, isMember: boolean) {
  const listPrice = Number(product.price);
  const memberActive = isMember && product.member_price != null && Number(product.member_price) < listPrice;
  const basePrice = memberActive ? Number(product.member_price) : listPrice;
  const finalPrice = product.discount_pct > 0 ? basePrice * (1 - product.discount_pct / 100) : basePrice;
  const showListPrice = memberActive || product.discount_pct > 0;
  return { listPrice, basePrice, finalPrice, memberActive, showListPrice };
}

function useDeadlineCountdown(deadline?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return { expired: false, label: null as string | null, active: false };
  const end = new Date(deadline).getTime();
  const diff = end - now;
  if (diff <= 0) return { expired: true, label: "Vendas encerradas", active: true };
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const label =
    d > 0
      ? `Faltam ${d}d ${String(h).padStart(2, "0")}h`
      : h > 0
        ? `Faltam ${h}h ${String(m).padStart(2, "0")}m`
        : `Faltam ${m}min`;
  return { expired: false, label, active: true };
}

function ProductCard({ product, athletic, isMember }: { product: Product; athletic: Athletic; isMember: boolean }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { listPrice, finalPrice, memberActive, showListPrice } = computeProductPricing(product, isMember);
  const cover = product.images?.[0];
  const stockLow =
    product.show_stock_warning &&
    product.stock != null &&
    product.stock > 0 &&
    (product.stock_warning_threshold == null || product.stock <= product.stock_warning_threshold);
  const outOfStock = product.stock != null && product.stock <= 0;
  const dl = useDeadlineCountdown(product.sales_deadline ?? null);
  const { addItem } = useAtleticaCart();
  const disabled = outOfStock || dl.expired;
  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="group text-left w-full overflow-hidden rounded-xl bg-neutral-900 border border-white/10 text-white hover:border-orange-500/50 hover:-translate-y-0.5 hover:shadow-2xl transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/60"
      >
        <div className="aspect-square bg-black relative overflow-hidden">
          {cover ? (
            <img
              src={cover}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-30">
              <ShoppingBag className="size-16" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.is_new && <Badge className="bg-orange-500 text-white border-0">NOVO</Badge>}
            {product.discount_pct > 0 && (
              <Badge className="bg-orange-600 text-white border-0">-{Math.round(product.discount_pct)}%</Badge>
            )}
            {memberActive && (
              <Badge className="bg-amber-500 text-black border-0">
                <Crown className="size-3 mr-0.5" />
                SÓCIO
              </Badge>
            )}
            {product.badge_text && <Badge className="bg-emerald-700 text-white border-0">{product.badge_text}</Badge>}
          </div>
          {product.images && product.images.length > 1 && (
            <Badge className="absolute top-2 right-2 bg-black/70 border border-white/20 text-[10px]">
              +{product.images.length - 1}
            </Badge>
          )}
          {dl.active && !dl.expired && (
            <Badge className="absolute top-2 right-2 mt-6 bg-orange-500/95 text-white border-0 text-[10px] flex items-center gap-1 shadow-lg">
              <Clock className="size-3" /> {dl.label}
            </Badge>
          )}
          {dl.expired && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <span className="px-3 py-1.5 rounded-full bg-neutral-900 border border-orange-500/40 text-orange-400 text-xs font-black uppercase tracking-wider">
                Vendas Encerradas
              </span>
            </div>
          )}
          {stockLow && !dl.expired && (
            <Badge className="absolute bottom-10 right-2 bg-orange-500 text-white border-0 text-[10px] shadow-lg">
              Últimas {product.stock}!
            </Badge>
          )}
          {product.second_item_discount_pct > 0 && !dl.expired && (
            <div className="absolute bottom-0 inset-x-0 py-1.5 text-center text-[11px] font-black uppercase tracking-wider text-white bg-orange-600/95 border-t border-orange-400/60">
              -{Math.round(product.second_item_discount_pct)}% na 2ª peça
            </div>
          )}
        </div>
        <div className="p-3 space-y-2">
          <div className="font-bold text-sm leading-tight line-clamp-2 h-10">{product.title}</div>
          <div className="flex items-baseline gap-2">
            {showListPrice && <span className="text-xs line-through opacity-40">R$ {listPrice.toFixed(2)}</span>}
            <span className="font-black text-lg text-white">R$ {finalPrice.toFixed(2)}</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              addItem(
                {
                  product_id: product.id,
                  title: product.title,
                  cover: cover ?? null,
                  unit_price: Math.round(finalPrice * 100) / 100,
                  list_price: Math.round(listPrice * 100) / 100,
                  second_item_discount_pct: product.second_item_discount_pct ?? 0,
                  max_stock: product.stock ?? null,
                },
                1,
              );
              toast.success("Adicionado ao carrinho");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).click();
              }
            }}
            className={`w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
              disabled
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            <ShoppingCart className="size-3.5" />{" "}
            {dl.expired ? "Vendas Encerradas" : outOfStock ? "Esgotado" : "Adicionar ao Carrinho"}
          </div>
        </div>
      </button>

      <ProductDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        product={product}
        athletic={athletic}
        isMember={isMember}
      />
    </>
  );
}

/* ============ PÚBLICO: DETALHE DO PRODUTO ============ */
function ProductDetailDialog({
  open,
  onClose,
  product,
  athletic,
  isMember,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  athletic: Athletic;
  isMember: boolean;
}) {
  const { user } = useAuth();
  const images = product.images && product.images.length > 0 ? product.images : [];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (open) setIdx(0);
  }, [open, product.id]);
  const { addItem } = useAtleticaCart();

  const prev = () => setIdx((i) => (images.length ? (i - 1 + images.length) % images.length : 0));
  const next = () => setIdx((i) => (images.length ? (i + 1) % images.length : 0));

  const { listPrice, finalPrice, memberActive, showListPrice } = computeProductPricing(product, isMember);
  const secondDiscPct = product.second_item_discount_pct ?? 0;
  const secondPieceSavings = secondDiscPct > 0 ? (finalPrice * secondDiscPct) / 100 : 0;
  const totalForTwo = secondDiscPct > 0 ? finalPrice + finalPrice * (1 - secondDiscPct / 100) : 0;
  const stockLow =
    product.show_stock_warning &&
    product.stock != null &&
    product.stock > 0 &&
    (product.stock_warning_threshold == null || product.stock <= product.stock_warning_threshold);
  const outOfStock = product.stock != null && product.stock <= 0;
  const dl = useDeadlineCountdown(product.sales_deadline ?? null);
  const disabled = outOfStock || dl.expired;
  const cover = product.images?.[0];

  const addToCart = (qty = 1) => {
    if (disabled) return;
    addItem(
      {
        product_id: product.id,
        title: product.title,
        cover: cover ?? null,
        unit_price: Math.round(finalPrice * 100) / 100,
        list_price: Math.round(listPrice * 100) / 100,
        second_item_discount_pct: secondDiscPct,
        max_stock: product.stock ?? null,
      },
      qty,
    );
    toast.success(qty > 1 ? `${qty} unidades adicionadas ao carrinho` : "Adicionado ao carrinho");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[92vh] overflow-y-auto bg-neutral-900 text-white border-white/10">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Galeria */}
          <div className="relative aspect-square bg-black group">
            {images.length > 0 ? (
              <img src={images[idx]} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-30">
                <ShoppingBag className="size-24" />
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Imagem anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 flex items-center justify-center shadow-md"
                >
                  <ArrowLeft className="size-5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Próxima imagem"
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 flex items-center justify-center shadow-md"
                >
                  <ArrowLeft className="size-5 rotate-180 text-white" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIdx(i)}
                      aria-label={`Imagem ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-orange-400" : "w-1.5 bg-white/40"}`}
                    />
                  ))}
                </div>
                <div className="hidden md:flex absolute top-3 left-3 flex-col gap-2">
                  {images.slice(0, 4).map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      onClick={() => setIdx(i)}
                      className={`size-14 rounded-md overflow-hidden border-2 ${i === idx ? "border-orange-400" : "border-white/30"} shadow`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {dl.expired && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <span className="px-4 py-2 rounded-full bg-neutral-900 border border-orange-500/40 text-orange-400 text-sm font-black uppercase tracking-wider">
                  Vendas Encerradas
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-6 md:p-8 space-y-4 flex flex-col bg-neutral-900">
            <DialogHeader className="text-left">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {product.is_new && <Badge className="bg-orange-500 text-white border-0">NOVO</Badge>}
                {product.discount_pct > 0 && (
                  <Badge className="bg-orange-600 text-white border-0">-{Math.round(product.discount_pct)}% OFF</Badge>
                )}
                {memberActive && (
                  <Badge className="bg-amber-500 text-black border-0">
                    <Crown className="size-3 mr-0.5" />
                    Preço sócio
                  </Badge>
                )}
                {product.badge_text && (
                  <Badge className="bg-emerald-700 text-white border-0">{product.badge_text}</Badge>
                )}
                {dl.active && !dl.expired && (
                  <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    <Clock className="size-3 mr-1" />
                    {dl.label}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight text-white">
                {product.title}
              </DialogTitle>
              {product.description && (
                <DialogDescription className="text-neutral-300 whitespace-pre-line pt-1">
                  {product.description}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="rounded-xl border border-white/10 bg-neutral-950 p-4">
              <div className="flex items-baseline gap-3">
                {showListPrice && (
                  <span className="text-sm line-through text-neutral-500">R$ {listPrice.toFixed(2)}</span>
                )}
                <span className="font-black text-4xl text-white">R$ {finalPrice.toFixed(2)}</span>
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                ou até 3x sem juros no cartão • Pix com aprovação automática
              </div>
              {memberActive && (
                <div className="mt-2 text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Crown className="size-3.5" /> Você economizou R${" "}
                  {(listPrice - Number(product.member_price!)).toFixed(2)} como sócio
                </div>
              )}
            </div>

            {/* Promo 2ª peça — card sutil escuro com borda laranja */}
            {secondDiscPct > 0 && !dl.expired && (
              <div className="rounded-xl border border-orange-500/30 bg-neutral-800 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-400 mb-1">
                  <Flame className="size-3.5" /> Oferta combinada
                </div>
                <div className="text-sm font-bold text-white leading-tight">
                  Leve a 2ª peça com R$ {secondPieceSavings.toFixed(2)} de desconto
                </div>
                <div className="text-xs text-neutral-300 mt-1">
                  Duas unidades por <strong className="text-white">R$ {totalForTwo.toFixed(2)}</strong> — economia de{" "}
                  {Math.round(secondDiscPct)}% na segunda.
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => addToCart(2)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-300 hover:text-orange-200 disabled:opacity-50"
                >
                  Adicionar 2 ao carrinho →
                </button>
              </div>
            )}

            <div className="text-xs text-neutral-400 flex flex-wrap gap-x-3 gap-y-1">
              {outOfStock ? (
                <span className="text-orange-400 font-bold">Esgotado</span>
              ) : product.show_stock_warning && product.stock != null ? (
                <span className={stockLow ? "text-orange-400 font-bold" : ""}>
                  {stockLow ? `Apenas ${product.stock} em estoque!` : `${product.stock} em estoque`}
                </span>
              ) : (
                <span>✓ Disponível</span>
              )}
              {images.length > 0 && (
                <span>
                  • {images.length} foto{images.length > 1 ? "s" : ""}
                </span>
              )}
              <span>• Retirada com a diretoria</span>
            </div>

            <div className="mt-auto pt-4 space-y-2">
              {user ? (
                <>
                  <Button
                    size="lg"
                    className="w-full font-black uppercase tracking-wider text-white border-0 shadow-lg bg-emerald-600 hover:bg-emerald-500"
                    disabled={disabled}
                    onClick={() => addToCart(1)}
                  >
                    <ShoppingCart className="size-4" />{" "}
                    {dl.expired ? "Vendas Encerradas" : outOfStock ? "Esgotado" : "Adicionar ao Carrinho"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-neutral-300 hover:bg-white/5 hover:text-white"
                    onClick={onClose}
                  >
                    Continuar comprando
                  </Button>
                </>
              ) : (
                <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-500 border-0" asChild>
                  <Link to="/auth">
                    <ShoppingCart className="size-4" /> Entrar para comprar
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ PÚBLICO: EVENTOS ============ */
function PublicEvents({ athletic, isMember }: { athletic: Athletic; isMember: boolean }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    supabase
      .from("athletic_events")
      .select("*")
      .eq("athletic_id", athletic.id)
      .eq("published", true)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .then(({ data }) => setEvents((data as any) ?? []));
  }, [athletic.id]);
  if (events.length === 0) {
    return (
      <EmptyDark
        icon={<PartyPopper className="size-12" />}
        title="Nenhum evento no momento"
        desc="Fique de olho! Novidades em breve."
      />
    );
  }
  return (
    <div className="space-y-6">
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
    buyer_name: profile?.full_name ?? "",
    buyer_email: profile?.email ?? "",
    buyer_phone: profile?.phone ?? "",
    buyer_cpf: "",
  });
  const [saving, setSaving] = useState(false);
  const [pixData] = useState<any>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const createIp = useServerFn(createEventTicketInfinitepayCheckout);
  const canBuy = e.online_sales_open && remaining > 0 && price > 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl min-h-[420px] md:min-h-[380px]">
      {/* Background */}
      {e.image_url ? (
        <img src={e.image_url} alt={e.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${e.theme_color ?? athletic.primary_color}, ${athletic.secondary_color})`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />

      {/* Content grid */}
      <div className="relative grid md:grid-cols-[minmax(0,1fr)_360px] gap-6 p-6 md:p-8 min-h-[420px] md:min-h-[380px]">
        <div className="flex flex-col justify-end">
          {e.starts_at && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-200 text-xs font-bold mb-3 w-fit">
              <Calendar className="size-3.5" />{" "}
              {new Date(e.starts_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
          <h3 className="font-black text-3xl md:text-5xl uppercase tracking-tight text-white drop-shadow-2xl">
            {e.title}
          </h3>
          {e.location && (
            <p className="mt-2 text-sm text-white/80 flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {e.location}
            </p>
          )}
        </div>

        {/* Glass painel lateral */}
        <div className="self-end md:self-center rounded-2xl backdrop-blur-md bg-black/40 border border-white/15 p-5 space-y-3 shadow-2xl">
          {e.description && <p className="text-sm text-white/85 line-clamp-4">{e.description}</p>}
          <div className="flex justify-between items-baseline pt-3 border-t border-white/10">
            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-60">{isMember ? "Sócio" : "Visitante"}</div>
              <div className="font-black text-3xl text-white">{price === 0 ? "Grátis" : `R$ ${price.toFixed(2)}`}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest opacity-60">Ingressos</div>
              <div className="font-bold text-white">
                {remaining}
                <span className="opacity-60">/{e.total_tickets}</span>
              </div>
            </div>
          </div>
          {!user ? (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 border-0 text-white font-black uppercase tracking-wider"
              asChild
            >
              <Link to="/auth">
                <Ticket className="size-4" /> Entrar para comprar
              </Link>
            </Button>
          ) : !canBuy ? (
            <Button className="w-full bg-neutral-800 text-neutral-400 border-0" disabled>
              <Ticket className="size-4" /> {remaining <= 0 ? "Esgotado" : "Vendas fechadas"}
            </Button>
          ) : (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 border-0 text-white font-black uppercase tracking-wider shadow-lg"
              onClick={() => setOpen(true)}
            >
              <Ticket className="size-4" /> Garantir ingresso
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-neutral-900 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Ingresso — {e.title}</DialogTitle>
            <DialogDescription className="text-neutral-300">
              Valor {isMember ? "sócio" : "visitante"}: <strong className="text-white">R$ {price.toFixed(2)}</strong>.
              Pagamento via <strong>InfinitePay</strong> (Pix, crédito ou débito).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={form.buyer_name} onChange={(ev) => setForm({ ...form, buyer_name: ev.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-mail *</Label>
                <Input value={form.buyer_email} onChange={(ev) => setForm({ ...form, buyer_email: ev.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.buyer_phone ?? ""}
                  onChange={(ev) => setForm({ ...form, buyer_phone: ev.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>CPF *</Label>
              <Input value={form.buyer_cpf} onChange={(ev) => setForm({ ...form, buyer_cpf: ev.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="bg-transparent text-white border-white/20 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 border-0"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const c = await createIp({ data: { event_id: e.id, ...form } });
                  setOpen(false);
                  window.location.href = (c as any).checkout_url;
                  return;
                } catch (err: any) {
                  toast.error(err?.message ?? "Erro");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Processando..." : "Pagar com InfinitePay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixDialog open={pixOpen} onClose={() => setPixOpen(false)} data={pixData} title={`Pix — ${e.title}`} />
    </div>
  );
}

/* ============ SIDEBAR LAYOUT ============ */
type SectionKey = "inicio" | "produtos" | "eventos" | "esportes" | "compras" | "socio" | "diretoria";

function AtleticaSectionLayout({
  primaryColor,
  isMember,
  isDirector,
  hasUser,
  directorTabs,
  renderSection,
}: {
  primaryColor: string;
  isMember: boolean;
  isDirector: boolean;
  hasUser: boolean;
  directorTabs: string[] | null;
  renderSection: (s: SectionKey) => React.ReactNode;
}) {
  const [active, setActive] = useState<SectionKey>("inicio");
  const items: Array<{ key: SectionKey; label: string; icon: React.ReactNode; show: boolean }> = [
    { key: "inicio", label: "Página Inicial", icon: <Home className="size-4" />, show: true },
    { key: "produtos", label: "Produtos", icon: <Store className="size-4" />, show: true },
    { key: "eventos", label: "Eventos", icon: <PartyPopper className="size-4" />, show: true },
    { key: "esportes", label: "Esportes", icon: <Trophy className="size-4" />, show: true },
    { key: "compras", label: "Histórico de Compras", icon: <Receipt className="size-4" />, show: hasUser },
    { key: "socio", label: "Painel do Sócio", icon: <IdCard className="size-4" />, show: isMember },
    { key: "diretoria", label: "Diretoria", icon: <Shield className="size-4" />, show: isDirector },
  ];
  const visible = items.filter((i) => i.show);
  const go = (k: SectionKey) => {
    setActive(k);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  void directorTabs;

  return (
    <>
      {/* Fixed side rail (desktop) — full height, follows scroll, outside page container */}
      <aside className="hidden lg:flex fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-[240px] flex-col border-r border-white/10 bg-neutral-950/85 backdrop-blur-xl">
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Atlética</div>
          <div className="mt-1 text-sm font-black text-white/90">Navegação</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visible.map((i) => {
            const on = active === i.key;
            return (
              <button
                key={i.key}
                onClick={() => go(i.key)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${on ? "text-white shadow-lg" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                style={on ? { background: primaryColor } : undefined}
              >
                <span className="shrink-0">{i.icon}</span>
                <span className="truncate">{i.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-3 border-t border-white/10 text-[10px] opacity-50 font-mono">MEDUNO • AAAMD</div>
      </aside>

      {/* Horizontal chips (mobile) */}
      <div className="lg:hidden -mx-3 px-3 mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          {visible.map((i) => {
            const on = active === i.key;
            return (
              <button
                key={i.key}
                onClick={() => go(i.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${on ? "text-white shadow-lg" : "text-white/80 bg-white/5 border border-white/10"}`}
                style={on ? { background: primaryColor } : undefined}
              >
                {i.icon}
                {i.label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="min-w-0">{renderSection(active)}</section>
    </>
  );
}

/* ============ ESPORTES (aberto a todos) ============ */
function SportsSection({ athletic }: { athletic: Athletic; user: any; isMember: boolean }) {
  return <SportsList athletic={athletic} />;
}

/* ============ PAINEL DO SÓCIO (Carteirinha + Benefícios + Parceiros) ============ */
function MemberDashboard({
  athletic,
  user,
  profile,
  membership,
}: {
  athletic: Athletic;
  user: any;
  profile: any;
  membership: Membership | null;
}) {
  return (
    <div className="space-y-6">
      <MemberIdCard athletic={athletic} profile={profile} membership={membership} email={user?.email} />
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="p-5 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest opacity-60 font-black">Modalidades</div>
            <div className="mt-1 opacity-90">
              Inscreva-se na aba <b>Esportes</b>.
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest opacity-60 font-black">Eventos</div>
            <div className="mt-1 opacity-90">
              Ingressos com preço de sócio na aba <b>Eventos</b>.
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest opacity-60 font-black">Loja</div>
            <div className="mt-1 opacity-90">Preço reduzido nos produtos com desconto de sócio.</div>
          </div>
        </CardContent>
      </Card>
      <div>
        <h3 className="text-xs uppercase tracking-widest font-black opacity-70 mb-3 flex items-center gap-2">
          <Handshake className="size-3.5" /> Parceiros com desconto
        </h3>
        <MemberPartners athletic={athletic} />
      </div>
    </div>
  );
}

function MemberIdCard({
  athletic,
  profile,
  membership,
  email,
}: {
  athletic: Athletic;
  profile: any;
  membership: Membership | null;
  email?: string;
}) {
  const name = profile?.full_name || membership?.full_name || "Sócio(a) AAAMD";
  const until = membership?.member_until ? new Date(membership.member_until) : null;
  const validUntil = until ? until.toLocaleDateString("pt-BR") : "—";
  const daysLeft = until ? Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86400000)) : null;
  const cpf = membership?.cpf || "—";
  const mat = profile?.matricula || membership?.matricula || "—";
  const cls = profile?.class_code || "—";
  const memId = membership?.id ? membership.id.slice(0, 8).toUpperCase() : "—";

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${athletic.primary_color} 0%, #0a0a0a 55%, ${athletic.secondary_color} 130%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(255,255,255,.15), transparent 40%), radial-gradient(circle at 90% 90%, rgba(255,255,255,.1), transparent 40%)",
        }}
      />
      <div className="relative p-6 md:p-7 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {athletic.logo_url ? (
              <img
                src={athletic.logo_url}
                className="size-12 rounded-full border-2 border-white/40 object-cover shrink-0"
                alt=""
              />
            ) : (
              <div className="size-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Shield className="size-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-black opacity-80">Carteirinha de Sócio</div>
              <div className="font-black text-lg leading-tight truncate">{athletic.short_name ?? athletic.name}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-300/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle2 className="size-3" /> Ativa
            </div>
            {daysLeft !== null && (
              <div className="mt-1 text-[10px] opacity-80">
                {daysLeft} dia{daysLeft === 1 ? "" : "s"} restante{daysLeft === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-1">
          <div className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Nome</div>
          <div className="font-black text-2xl md:text-3xl leading-tight tracking-tight uppercase break-words">
            {name}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur px-3 py-2">
            <div className="text-[9px] uppercase tracking-widest opacity-70 font-black">Turma</div>
            <div className="font-black text-sm mt-0.5">{cls}</div>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur px-3 py-2">
            <div className="text-[9px] uppercase tracking-widest opacity-70 font-black">Matrícula</div>
            <div className="font-black text-sm mt-0.5">{mat}</div>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur px-3 py-2">
            <div className="text-[9px] uppercase tracking-widest opacity-70 font-black">CPF</div>
            <div className="font-black text-sm mt-0.5">{cpf}</div>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/15 backdrop-blur px-3 py-2">
            <div className="text-[9px] uppercase tracking-widest opacity-70 font-black">Válida até</div>
            <div className="font-black text-sm mt-0.5">{validUntil}</div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest opacity-70 font-black">E-mail</div>
            <div className="text-xs opacity-90 truncate">{email ?? membership?.email ?? "—"}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-widest opacity-70 font-black">Nº</div>
            <div className="font-mono font-black text-sm tracking-widest">{memId}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ SÓCIOS (legado - mantido para compat) ============ */

function SociosArea({ athletic, isMember, user }: { athletic: Athletic; isMember: boolean; user: any }) {
  if (!user) {
    return (
      <EmptyDark
        icon={<Users className="size-12" />}
        title="Faça login para acessar a área do sócio"
        action={
          <Button asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
        }
      />
    );
  }
  if (!isMember) {
    return (
      <EmptyDark
        icon={<Crown className="size-12" />}
        title="Área exclusiva para sócios"
        desc={`Associe-se por R$ ${Number(athletic.membership_price).toFixed(2)} para ter acesso.`}
        action={<AssociarButton athletic={athletic} onDone={() => window.location.reload()} />}
      />
    );
  }
  return (
    <div className="space-y-4">
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="p-6">
          <h3 className="font-black text-2xl uppercase mb-1" style={{ color: athletic.primary_color }}>
            Bem-vindo, sócio!
          </h3>
          <p className="opacity-80 text-sm">Área exclusiva com benefícios da {athletic.name}.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="beneficios">
        <TabsList className="w-full grid grid-cols-3 h-auto bg-white/5 border border-white/10">
          <TabsTrigger value="beneficios" className="py-2 data-[state=active]:bg-white data-[state=active]:text-black">
            <Sparkles className="size-4 mr-1.5" />
            Benefícios
          </TabsTrigger>
          <TabsTrigger value="parceiros" className="py-2 data-[state=active]:bg-white data-[state=active]:text-black">
            <Handshake className="size-4 mr-1.5" />
            Parceiros
          </TabsTrigger>
          <TabsTrigger value="esportes" className="py-2 data-[state=active]:bg-white data-[state=active]:text-black">
            <Trophy className="size-4 mr-1.5" />
            Esportes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="beneficios" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="p-6">
                <h4 className="font-black text-lg mb-2">🏆 Grupo de Esportes</h4>
                <p className="text-sm opacity-70">
                  Acesse a aba <b>Esportes</b> para se inscrever nas modalidades.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="p-6">
                <h4 className="font-black text-lg mb-2">🤝 Descontos com parceiros</h4>
                <p className="text-sm opacity-70">
                  Veja a aba <b>Parceiros</b> para conferir todos os descontos exclusivos.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="parceiros" className="mt-4">
          <MemberPartners athletic={athletic} />
        </TabsContent>
        <TabsContent value="esportes" className="mt-4">
          <SportsList athletic={athletic} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --- Sócios: Parceiros (visualização) --- */
type Partner = {
  id: string;
  athletic_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  discount_text: string | null;
  link_url: string | null;
  display_order: number;
  active: boolean;
};

function MemberPartners({ athletic }: { athletic: Athletic }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("athletic_partners" as any)
        .select("*")
        .eq("athletic_id", athletic.id)
        .eq("active", true)
        .order("display_order");
      setPartners((data as any) ?? []);
    })();
  }, [athletic.id]);
  if (partners.length === 0) {
    return (
      <EmptyDark
        icon={<Handshake className="size-12" />}
        title="Nenhum parceiro cadastrado"
        desc="A diretoria ainda não adicionou parcerias."
      />
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {partners.map((p) => (
        <Card key={p.id} className="bg-white/5 border-white/10 text-white overflow-hidden flex flex-col">
          {p.image_url && (
            <div className="aspect-video bg-black/40">
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
            </div>
          )}
          <CardContent className="p-4 flex-1 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-black text-lg leading-tight">{p.name}</h4>
              {p.discount_text && (
                <span
                  className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ background: athletic.secondary_color, color: "#000" }}
                >
                  <Tag className="size-3 inline -mt-0.5 mr-1" />
                  {p.discount_text}
                </span>
              )}
            </div>
            {p.description && <p className="text-sm opacity-80 whitespace-pre-line flex-1">{p.description}</p>}
            {p.link_url && (
              <a
                href={p.link_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline opacity-80 hover:opacity-100 mt-1"
              >
                Saiba mais →
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============ ESPORTES (Público) ============ */
function SportsList({ athletic }: { athletic: Athletic }) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  async function reload() {
    setLoading(true);
    const { data: s } = await supabase
      .from("athletic_sports" as any)
      .select("*")
      .eq("athletic_id", athletic.id)
      .eq("active", true)
      .order("display_order");
    setSports((s as any) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);
  if (loading)
    return (
      <div className="flex justify-center py-8 opacity-60">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  if (sports.length === 0) return <EmptyDark icon={<Trophy className="size-12" />} title="Nenhum esporte disponível" />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sports.map((s) => (
        <Card key={s.id} className="bg-white/5 border-white/10 text-white overflow-hidden flex flex-col">
          <div className="aspect-video bg-black/40 relative">
            {s.image_url ? (
              <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg, ${athletic.primary_color}, ${athletic.secondary_color})`,
                }}
              />
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-black/70 border border-white/20">
                {s.gender === "masculino" ? "♂ Masc." : s.gender === "feminino" ? "♀ Fem." : "⚧ Misto"}
              </span>
            </div>
          </div>
          <CardContent className="p-4 flex-1 flex flex-col gap-2">
            <div className="font-black text-lg">{s.name}</div>
            {s.coach && <div className="text-xs opacity-70">Diretor(a): {s.coach}</div>}
            {s.schedule && <div className="text-xs opacity-70">🕒 {s.schedule}</div>}
            {s.description && <p className="text-sm opacity-80 line-clamp-3">{s.description}</p>}
            <div className="mt-auto pt-2">
              {s.whatsapp_url ? (
                <a
                  href={s.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 h-10 px-3 rounded-md text-sm font-bold bg-[#25D366] hover:bg-[#1eb958] text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.02 0C5.39 0 .04 5.35.04 11.98c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.94 11.94 0 0 0 5.82 1.49h.01c6.63 0 11.98-5.35 11.98-11.98 0-3.2-1.25-6.21-3.49-8.41Z" />
                  </svg>
                  Entrar no grupo do WhatsApp
                </a>
              ) : (
                <div className="text-xs opacity-50 text-center py-2">Grupo indisponível</div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============ SOBRE ============ */
/* ============ PÁGINA INICIAL (hero + coleções + sobre) ============ */
function InicioSection({
  ath,
  isActiveMember,
  myMembership,
}: {
  ath: Athletic;
  isActiveMember: boolean;
  myMembership: Membership | null;
}) {
  return (
    <div className="space-y-8 -mx-3 md:-mx-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-none md:rounded-3xl min-h-[420px] flex items-center">
        {ath.cover_url ? (
          <>
            <img src={ath.cover_url} className="absolute inset-0 w-full h-full object-cover" alt={ath.name} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at top left, ${ath.primary_color}55, transparent 55%), radial-gradient(ellipse at bottom right, ${ath.secondary_color}55, transparent 55%)`,
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top left, ${ath.primary_color}44, transparent 60%), radial-gradient(ellipse at bottom right, ${ath.secondary_color}44, transparent 60%), #000`,
            }}
          />
        )}
        <div className="relative max-w-4xl mx-auto px-6 py-16 md:py-20 text-center w-full">
          {ath.logo_url && (
            <img
              src={ath.logo_url}
              alt={ath.name}
              className="mx-auto size-28 md:size-36 rounded-full border-4 shadow-2xl object-cover mb-6"
              style={{ borderColor: ath.primary_color }}
            />
          )}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-xs uppercase tracking-widest font-bold backdrop-blur"
            style={{ background: `${ath.primary_color}33`, color: "#fff", border: `1px solid ${ath.primary_color}88` }}
          >
            <Trophy className="size-3.5" /> Campeã Geral Série B Intermed 2026
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 uppercase drop-shadow-2xl">
            {ath.name}
          </h1>
          {ath.description && (
            <p className="max-w-2xl mx-auto text-base md:text-lg opacity-95 drop-shadow-lg whitespace-pre-line">
              {ath.description}
            </p>
          )}
          {!isActiveMember && (
            <div className="mt-8">
              <AssociarButton athletic={ath} onDone={() => window.location.reload()} />
            </div>
          )}
          {isActiveMember && myMembership?.member_until && (
            <Badge className="mt-8 text-sm px-4 py-1.5" style={{ background: ath.secondary_color, color: "white" }}>
              <Crown className="size-3.5 mr-1.5" /> Sócio ativo até{" "}
              {new Date(myMembership.member_until).toLocaleDateString("pt-BR")}
            </Badge>
          )}
        </div>
      </section>

      {/* COLEÇÕES */}
      <div className="px-3 md:px-0">
        <CollectionsMarquee
          athletic={ath}
          onOpenCollection={() => {
            window.dispatchEvent(new CustomEvent("aaamd:goto-section", { detail: "produtos" }));
          }}
        />
      </div>

      {/* HISTÓRIA */}
      <div className="px-3 md:px-0">
        <HistoryShowcase ath={ath} />
      </div>
    </div>
  );
}

/* ============ DIRETORIA ============ */
function DirectorPanel({
  athletic,
  allowedTabs,
  isPresident,
}: {
  athletic: Athletic;
  allowedTabs: string[] | null;
  isPresident: boolean;
}) {
  const ALL = ["socios", "produtos", "eventos", "esportes", "parceiros", "caixa", "config"] as const;
  const canSee = (t: string) => isPresident || !allowedTabs || allowedTabs.length === 0 || allowedTabs.includes(t);
  const tabs = ALL.filter(canSee);
  const initial = tabs[0] ?? "socios";
  const icons: Record<string, React.ReactNode> = {
    socios: <Users className="size-4 mr-1.5" />,
    produtos: <ShoppingBag className="size-4 mr-1.5" />,
    eventos: <PartyPopper className="size-4 mr-1.5" />,
    esportes: <Trophy className="size-4 mr-1.5" />,
    parceiros: <Handshake className="size-4 mr-1.5" />,
    caixa: <Wallet className="size-4 mr-1.5" />,
    config: <Settings className="size-4 mr-1.5" />,
  };
  const labels: Record<string, string> = {
    socios: "Sócios",
    produtos: "Produtos",
    eventos: "Eventos",
    esportes: "Esportes",
    parceiros: "Parceiros",
    caixa: "Caixa",
    config: "Config",
  };
  if (tabs.length === 0) {
    return (
      <EmptyDark
        icon={<Shield className="size-10" />}
        title="Sem permissões"
        desc="O presidente ainda não liberou abas para você."
      />
    );
  }
  return (
    <Tabs defaultValue={initial}>
      <TabsList
        className="w-full grid h-auto bg-white/5 border border-white/10"
        style={{ gridTemplateColumns: `repeat(${Math.min(tabs.length, 7)}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <TabsTrigger key={t} value={t} className="data-[state=active]:bg-white data-[state=active]:text-black">
            {icons[t]}
            {labels[t]}
          </TabsTrigger>
        ))}
      </TabsList>
      {canSee("socios") && (
        <TabsContent value="socios" className="mt-4">
          <DirectorMembers athletic={athletic} />
        </TabsContent>
      )}
      {canSee("produtos") && (
        <TabsContent value="produtos" className="mt-4">
          <DirectorProducts athletic={athletic} />
        </TabsContent>
      )}
      {canSee("eventos") && (
        <TabsContent value="eventos" className="mt-4">
          <DirectorEvents athletic={athletic} />
        </TabsContent>
      )}
      {canSee("esportes") && (
        <TabsContent value="esportes" className="mt-4">
          <DirectorSports athletic={athletic} />
        </TabsContent>
      )}
      {canSee("parceiros") && (
        <TabsContent value="parceiros" className="mt-4">
          <DirectorPartners athletic={athletic} />
        </TabsContent>
      )}
      {canSee("caixa") && (
        <TabsContent value="caixa" className="mt-4">
          <DirectorCash athletic={athletic} />
        </TabsContent>
      )}
      {canSee("config") && (
        <TabsContent value="config" className="mt-4">
          <DirectorConfig athletic={athletic} />
        </TabsContent>
      )}
    </Tabs>
  );
}

/* --- Sócios (Diretoria) --- */
function DirectorMembers({ athletic }: { athletic: Athletic }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [editing, setEditing] = useState<Partial<Membership> | null>(null);
  const upsert = useServerFn(upsertAthleticMember);
  const del = useServerFn(deleteAthleticMember);
  const confirm = useServerFn(confirmMembershipPayment);
  const delPending = useServerFn(deletePendingMembershipPayment);
  const [showAllPending, setShowAllPending] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  async function reload() {
    const [{ data }, { data: p }, { data: cy }] = await Promise.all([
      supabase
        .from("athletic_memberships")
        .select("*")
        .eq("athletic_id", athletic.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("athletic_membership_payments")
        .select("*")
        .eq("athletic_id", athletic.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("athletic_membership_cycles")
        .select("id, name, ends_at, open")
        .eq("athletic_id", athletic.id)
        .order("starts_at", { ascending: false }),
    ]);
    setMembers((data as any) ?? []);
    setPending((p as any) ?? []);
    setCycles((cy as any) ?? []);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/40 text-white">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black flex items-center gap-2">
                <Sparkles className="size-4" /> Pagamentos pendentes ({pending.length})
              </h4>
              {pending.length > 3 && (
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setShowAllPending((v) => !v)}>
                  {showAllPending ? "Recolher" : "Ver todos"}
                </Button>
              )}
            </div>
            {(showAllPending ? pending : pending.slice(0, 3)).map((p) => (
              <div
                key={p.id}
                className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-black/30 rounded border border-white/10"
              >
                <div className="flex-1 text-sm">
                  <div className="font-bold">
                    {p.buyer_name} — R$ {Number(p.amount).toFixed(2)}
                  </div>
                  <div className="opacity-70 text-xs">
                    {p.buyer_email} • Matr {p.matricula} • {p.semestre}º sem • CPF {p.buyer_cpf}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {["pix", "dinheiro", "cartao"].map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant="outline"
                      className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white capitalize"
                      onClick={async () => {
                        try {
                          await confirm({ data: { athletic_id: athletic.id, payment_id: p.id, method: m as any } });
                          toast.success("Confirmado");
                          reload();
                        } catch (e: any) {
                          toast.error(e?.message);
                        }
                      }}
                    >
                      {m}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    onClick={async () => {
                      if (!window.confirm("Excluir esta pendência? Essa ação não pode ser desfeita.")) return;
                      try {
                        await delPending({ data: { athletic_id: athletic.id, payment_id: p.id } });
                        toast.success("Pendência removida");
                        reload();
                      } catch (e: any) {
                        toast.error(e?.message);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h3 className="font-black text-lg">Sócios ({members.length})</h3>
        <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white"
          onClick={() => setBulkOpen(true)}
        >
          <Upload className="size-4 mr-1" /> Importar Excel
        </Button>
        <Button
          size="sm"
          onClick={() =>

            setEditing({ athletic_id: athletic.id, role: "socio", active: true, member_until: null } as any)
          }
        >
          <Plus className="size-4" /> Adicionar manualmente
        </Button>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10 text-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">E-mail</th>
              <th className="text-left p-2">Matr.</th>
              <th className="text-left p-2">Sem</th>
              <th className="text-left p-2">CPF</th>
              <th className="text-left p-2">Cargo</th>
              <th className="text-left p-2">Até</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center opacity-60">
                  Ninguém ainda
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-t border-white/10">
                <td className="p-2 font-medium">
                  {m.full_name}{" "}
                  {!m.active && (
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      inativo
                    </Badge>
                  )}
                </td>
                <td className="p-2 opacity-80">{m.email}</td>
                <td className="p-2 opacity-80">{m.matricula ?? "—"}</td>
                <td className="p-2 opacity-80">{m.semestre ?? "—"}</td>
                <td className="p-2 opacity-80">{m.cpf ?? "—"}</td>
                <td className="p-2">
                  <Badge style={m.role !== "socio" ? { background: athletic.primary_color } : {}}>{m.role}</Badge>
                </td>
                <td className="p-2 opacity-80">
                  {m.member_until ? new Date(m.member_until).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400"
                    onClick={async () => {
                      if (!confirm2(`Remover ${m.full_name}?`)) return;
                      try {
                        await del({ data: { athletic_id: athletic.id, member_id: m.id } });
                        toast.success("Removido");
                        reload();
                      } catch (e: any) {
                        toast.error(e?.message);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar sócio" : "Adicionar sócio"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome completo *</Label>
                <Input
                  value={editing.full_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail *</Label>
                  <Input
                    value={editing.email ?? ""}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={editing.phone ?? ""}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>CPF</Label>
                  <Input value={editing.cpf ?? ""} onChange={(e) => setEditing({ ...editing, cpf: e.target.value })} />
                </div>
                <div>
                  <Label>Matrícula</Label>
                  <Input
                    value={editing.matricula ?? ""}
                    onChange={(e) => setEditing({ ...editing, matricula: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Semestre</Label>
                  <Input
                    value={editing.semestre ?? ""}
                    onChange={(e) => setEditing({ ...editing, semestre: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Cargo</Label>
                <Select
                  value={editing.role ?? "socio"}
                  onValueChange={(v) => setEditing({ ...editing, role: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socio">Sócio</SelectItem>
                    <SelectItem value="diretor">Diretor</SelectItem>
                    <SelectItem value="presidente">Presidente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <Label className="text-xs uppercase tracking-widest opacity-70">Ciclo de associação</Label>
                <Select
                  value={(editing as any).cycle_id ?? "__none"}
                  onValueChange={(v) => setEditing({ ...editing, cycle_id: v === "__none" ? null : v } as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar ciclo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem ciclo</SelectItem>
                    {cycles.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} (válido até {new Date(c.ends_at).toLocaleDateString("pt-BR")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] opacity-60">
                  Ao selecionar um ciclo, a data limite de sócio é preenchida automaticamente com o fim do ciclo.
                </p>
              </div>

              {!editing.id && (
                <label className="flex items-start gap-2 text-sm rounded-lg border p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={(editing as any).send_invite ?? true}
                    onChange={(e) => setEditing({ ...editing, send_invite: e.target.checked } as any)}
                  />
                  <span>
                    <strong>Enviar convite por e-mail</strong>
                    <span className="block text-[11px] opacity-70">
                      Se este e-mail ainda não tem conta, enviamos um convite. Assim que a pessoa criar a conta com o
                      mesmo e-mail, ela é vinculada automaticamente como sócia.
                    </span>
                  </span>
                </label>
              )}

              {(editing.role === "diretor" || editing.role === "presidente") && (
                <div className="rounded-lg border p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-widest opacity-70">Abas da Diretoria liberadas</Label>
                  <p className="text-[11px] opacity-60">
                    Presidente sempre tem acesso a todas. Para diretores, marque abaixo. Sem seleção = todas liberadas.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["socios", "Sócios"],
                      ["produtos", "Produtos"],
                      ["eventos", "Eventos"],
                      ["esportes", "Esportes"],
                      ["parceiros", "Parceiros"],
                      ["caixa", "Caixa"],
                      ["config", "Config"],
                    ].map(([k, lbl]) => {
                      const current: string[] = ((editing as any).director_tabs as string[] | null) ?? [];
                      const checked = current.includes(k);
                      return (
                        <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked ? [...current, k] : current.filter((x) => x !== k);
                              setEditing({ ...editing, director_tabs: next } as any);
                            }}
                          />
                          <span>{lbl}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await upsert({
                    data: {
                      ...(editing as any),
                      added_manually: !editing?.id,
                      send_invite: !editing?.id && ((editing as any).send_invite ?? true),
                    },
                  });

                  toast.success("Salvo");
                  setEditing(null);
                  reload();
                } catch (e: any) {
                  toast.error(e?.message);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function confirm2(msg: string): boolean {
  return typeof window !== "undefined" && window.confirm(msg);
}

/* --- Produtos (Diretoria) --- */
function DirectorProducts({ athletic }: { athletic: Athletic }) {
  const [cols, setCols] = useState<Collection[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [filterCol, setFilterCol] = useState<string>("__all");
  const [editCol, setEditCol] = useState<Partial<Collection> | null>(null);
  const [editProd, setEditProd] = useState<Partial<Product> | null>(null);
  const [manualFor, setManualFor] = useState<Product | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);
  const uc = useServerFn(upsertCollection);
  const dc = useServerFn(deleteCollection);
  const up = useServerFn(upsertProduct);
  const dp = useServerFn(deleteProduct);
  async function reload() {
    const [{ data: c }, { data: p }, { data: o }] = await Promise.all([
      supabase.from("athletic_collections").select("*").eq("athletic_id", athletic.id).order("display_order"),
      supabase
        .from("athletic_products")
        .select("*")
        .eq("athletic_id", athletic.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("athletic_product_orders")
        .select("id,total,status,source,created_at")
        .eq("athletic_id", athletic.id)
        .eq("status", "paid"),
    ]);
    setCols((c as any) ?? []);
    setProds((p as any) ?? []);
    setOrders((o as any) ?? []);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);

  const visibleProds = useMemo(
    () => (filterCol === "__all" ? prods : prods.filter((p: any) => p.collection_id === filterCol)),
    [prods, filterCol],
  );
  const siteRevenue = useMemo(
    () => orders.filter((o: any) => o.source !== "manual").reduce((s, o) => s + Number(o.total || 0), 0),
    [orders],
  );
  const manualRevenue = useMemo(
    () => orders.filter((o: any) => o.source === "manual").reduce((s, o) => s + Number(o.total || 0), 0),
    [orders],
  );
  const siteCount = orders.filter((o: any) => o.source !== "manual").length;
  const manualCount = orders.filter((o: any) => o.source === "manual").length;

  return (
    <div className="space-y-6">
      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Vendas pelo site</div>
          <div className="text-2xl font-black mt-1 text-emerald-200">R$ {siteRevenue.toFixed(2)}</div>
          <div className="text-[11px] opacity-60 mt-0.5">{siteCount} pedido(s)</div>
        </div>
        <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Vendas manuais</div>
          <div className="text-2xl font-black mt-1 text-orange-200">R$ {manualRevenue.toFixed(2)}</div>
          <div className="text-[11px] opacity-60 mt-0.5">{manualCount} venda(s)</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Produtos cadastrados</div>
          <div className="text-2xl font-black mt-1">{prods.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Filtro por coleção</div>
          <Select value={filterCol} onValueChange={setFilterCol}>
            <SelectTrigger className="mt-1 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {cols.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Coleções */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-black text-lg">Coleções ({cols.length})</h3>
          <Button size="sm" onClick={() => setEditCol({ athletic_id: athletic.id, active: true, display_order: 0 })}>
            <Plus className="size-4" /> Nova coleção
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {cols.map((c) => (
            <Card key={c.id} className="bg-white/5 border-white/10 text-white">
              <CardContent className="p-3 flex justify-between items-center">
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs opacity-60">{c.slug}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditCol(c)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400"
                    onClick={async () => {
                      if (!confirm2("Remover?")) return;
                      await dc({ data: { athletic_id: athletic.id, id: c.id } });
                      reload();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Produtos */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-black text-lg">Produtos ({visibleProds.length})</h3>
          <Button
            size="sm"
            onClick={() =>
              setEditProd({
                athletic_id: athletic.id,
                active: true,
                price: 0,
                discount_pct: 0,
                second_item_discount_pct: 0,
                images: [],
              })
            }
          >
            <Plus className="size-4" /> Novo produto
          </Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleProds.map((p) => (
            <Card key={p.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
              <div className="aspect-square bg-black/40">
                {p.images?.[0] ? (
                  <img src={p.images[0]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-30">
                    <ShoppingBag className="size-12" />
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <div className="font-bold text-sm line-clamp-2 h-10">{p.title}</div>
                <div className="text-xs opacity-70">
                  R$ {Number(p.price).toFixed(2)} • Est: {p.stock ?? "∞"}
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-white text-black hover:bg-neutral-100 hover:text-black border-white"
                    onClick={() => setEditProd(p)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400"
                    onClick={async () => {
                      if (!confirm2("Remover?")) return;
                      await dp({ data: { athletic_id: athletic.id, id: p.id } });
                      reload();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1 mt-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-orange-400/50 text-orange-200 hover:bg-orange-500/20"
                    onClick={() => setManualFor(p)}
                  >
                    <Plus className="size-3.5 mr-1" /> Venda manual
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white"
                    onClick={() => setDeliveriesFor(deliveriesFor === p.id ? null : p.id)}
                  >
                    <Paperclip className="size-3.5 mr-1" /> Entregas
                  </Button>
                </div>
                {deliveriesFor === p.id && (
                  <div className="mt-3">
                    <DeliveriesList athletic={athletic} productId={p.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog coleção */}
      <Dialog open={!!editCol} onOpenChange={(o) => !o && setEditCol(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCol?.id ? "Editar coleção" : "Nova coleção"}</DialogTitle>
          </DialogHeader>
          {editCol && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editCol.name ?? ""} onChange={(e) => setEditCol({ ...editCol, name: e.target.value })} />
              </div>
              <div>
                <Label>Slug (identificador)</Label>
                <Input
                  value={editCol.slug ?? ""}
                  onChange={(e) =>
                    setEditCol({ ...editCol, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                  }
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editCol.description ?? ""}
                  onChange={(e) => setEditCol({ ...editCol, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Capa</Label>
                <ImageUpload
                  value={editCol.cover_url ?? ""}
                  onChange={(url) => setEditCol({ ...editCol, cover_url: url })}
                  folder="atletica/collections"
                />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={editCol.display_order ?? 0}
                  onChange={(e) => setEditCol({ ...editCol, display_order: +e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCol(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await uc({ data: editCol as any });
                  toast.success("Salvo");
                  setEditCol(null);
                  reload();
                } catch (e: any) {
                  toast.error(e?.message);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog produto */}
      <Dialog open={!!editProd} onOpenChange={(o) => !o && setEditProd(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProd?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {editProd && (
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input
                  value={editProd.title ?? ""}
                  onChange={(e) => setEditProd({ ...editProd, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editProd.description ?? ""}
                  onChange={(e) => setEditProd({ ...editProd, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Coleção</Label>
                <Select
                  value={editProd.collection_id ?? "__none"}
                  onValueChange={(v) => setEditProd({ ...editProd, collection_id: v === "__none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem coleção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem coleção</SelectItem>
                    {cols.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ProductImagesEditor
                images={editProd.images ?? []}
                onChange={(imgs) => setEditProd({ ...editProd, images: imgs })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editProd.price ?? 0}
                    onChange={(e) => setEditProd({ ...editProd, price: +e.target.value })}
                  />
                </div>
                <div>
                  <Label>Preço sócio (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editProd.member_price ?? ""}
                    onChange={(e) =>
                      setEditProd({ ...editProd, member_price: e.target.value ? +e.target.value : null })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editProd.discount_pct ?? 0}
                    onChange={(e) => setEditProd({ ...editProd, discount_pct: +e.target.value })}
                  />
                </div>
                <div>
                  <Label>Desc. 2ª peça (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editProd.second_item_discount_pct ?? 0}
                    onChange={(e) => setEditProd({ ...editProd, second_item_discount_pct: +e.target.value })}
                  />
                </div>
                <div>
                  <Label>Estoque</Label>
                  <Input
                    type="number"
                    value={editProd.stock ?? ""}
                    onChange={(e) => setEditProd({ ...editProd, stock: e.target.value ? +e.target.value : null })}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-white/10 p-3 space-y-2 bg-white/[0.03]">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!editProd.show_stock_warning}
                    onChange={(e) => setEditProd({ ...editProd, show_stock_warning: e.target.checked })}
                  />
                  Mostrar aviso de estoque para o comprador
                </label>
                {editProd.show_stock_warning && (
                  <div>
                    <Label className="text-xs opacity-80">
                      Avisar abaixo de quantas unidades? (deixe vazio para sempre mostrar)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex.: 10"
                      value={editProd.stock_warning_threshold ?? ""}
                      onChange={(e) =>
                        setEditProd({ ...editProd, stock_warning_threshold: e.target.value ? +e.target.value : null })
                      }
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Badge (texto)</Label>
                  <Input
                    value={editProd.badge_text ?? ""}
                    onChange={(e) => setEditProd({ ...editProd, badge_text: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={!!editProd.is_new}
                      onChange={(e) => setEditProd({ ...editProd, is_new: e.target.checked })}
                    />{" "}
                    Novo
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={!!editProd.is_highlight}
                      onChange={(e) => setEditProd({ ...editProd, is_highlight: e.target.checked })}
                    />{" "}
                    Destaque
                  </label>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 p-3 bg-white/[0.03]">
                <Label className="text-sm font-medium">Data limite de venda (opcional)</Label>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={editProd.sales_deadline ? String(editProd.sales_deadline).slice(0, 16) : ""}
                  onChange={(e) => setEditProd({ ...editProd, sales_deadline: e.target.value || null })}
                />
                <div className="text-[11px] opacity-60 mt-1">
                  Após esta data as vendas ficam bloqueadas e um contador regressivo aparece no card.
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProd(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await up({ data: editProd as any });
                  toast.success("Salvo");
                  setEditProd(null);
                  reload();
                } catch (e: any) {
                  toast.error(e?.message);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog venda manual */}
      <ManualSaleDialog
        product={manualFor}
        athletic={athletic}
        onClose={(refresh) => {
          setManualFor(null);
          if (refresh) reload();
        }}
      />
    </div>
  );
}

function DeliveriesList({ athletic, productId }: { athletic: Athletic; productId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const updDelivery = useServerFn(updateOrderItemDelivery);

  async function reload() {
    setLoading(true);
    const { data } = await supabase
      .from("athletic_product_order_items")
      .select(
        "id,quantity,line_total,delivery_status,delivered_at,order_id,athletic_product_orders!inner(id,buyer_name,buyer_email,buyer_cpf,buyer_registration,buyer_semester,source,status,created_at,athletic_id)",
      )
      .eq("product_id", productId)
      .order("id", { ascending: false });
    const filtered = ((data as any[]) ?? []).filter(
      (it) => it.athletic_product_orders?.athletic_id === athletic.id && it.athletic_product_orders?.status === "paid",
    );
    setItems(filtered);
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, [productId]);

  async function toggle(itemId: string, delivered: boolean) {
    try {
      await updDelivery({ data: { athletic_id: athletic.id, item_id: itemId, delivered } });
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, delivery_status: delivered ? "delivered" : "pending" } : it)),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
    }
  }

  if (loading)
    return (
      <div className="text-center py-4 opacity-60">
        <Loader2 className="size-4 animate-spin mx-auto" />
      </div>
    );
  if (items.length === 0)
    return (
      <div className="text-center text-xs opacity-60 py-3 rounded-lg bg-black/30 border border-white/10">
        Nenhum comprador ainda.
      </div>
    );

  const pending = items.filter((i) => i.delivery_status !== "delivered").length;

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 divide-y divide-white/10">
      <div className="p-2 flex items-center justify-between text-[11px] uppercase tracking-widest font-bold opacity-70">
        <span>{items.length} comprador(es)</span>
        <span>{pending} aguardando</span>
      </div>
      {items.map((it) => {
        const o = it.athletic_product_orders;
        const delivered = it.delivery_status === "delivered";
        return (
          <div key={it.id} className="p-2 flex items-center gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">
                {o?.buyer_name}
                {o?.source === "manual" && (
                  <span className="ml-1 text-[9px] uppercase tracking-widest text-orange-300">manual</span>
                )}
              </div>
              <div className="opacity-60 truncate">
                {o?.buyer_email} · Qtd {it.quantity} · R$ {Number(it.line_total).toFixed(2)}
                {o?.buyer_registration ? ` · Mat ${o.buyer_registration}` : ""}
                {o?.buyer_semester ? ` · ${o.buyer_semester}º sem` : ""}
              </div>
            </div>
            <Button
              size="sm"
              variant={delivered ? "default" : "outline"}
              onClick={() => toggle(it.id, !delivered)}
              className={delivered ? "bg-emerald-600 hover:bg-emerald-500" : "border-yellow-400/40 text-yellow-200"}
            >
              {delivered ? (
                <>
                  <CheckCircle2 className="size-3 mr-1" /> Entregue
                </>
              ) : (
                "Marcar entregue"
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ManualSaleDialog({
  product,
  athletic,
  onClose,
}: {
  product: Product | null;
  athletic: Athletic;
  onClose: (refresh?: boolean) => void;
}) {
  const [form, setForm] = useState({
    quantity: 1,
    buyer_name: "",
    buyer_email: "",
    buyer_cpf: "",
    buyer_registration: "",
    buyer_semester: "",
    method: "dinheiro" as "pix" | "dinheiro" | "cartao",
    apply_member_price: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const register = useServerFn(registerManualProductSale);

  useEffect(() => {
    if (product)
      setForm({
        quantity: 1,
        buyer_name: "",
        buyer_email: "",
        buyer_cpf: "",
        buyer_registration: "",
        buyer_semester: "",
        method: "dinheiro",
        apply_member_price: false,
        notes: "",
      });
  }, [product?.id]);

  if (!product) return null;

  async function submit() {
    if (!product) return;
    if (!form.buyer_name.trim() || !form.buyer_email.trim() || !form.buyer_cpf.trim()) {
      toast.error("Nome, e-mail e CPF são obrigatórios");
      return;
    }
    try {
      setSaving(true);
      await register({
        data: {
          athletic_id: athletic.id,
          product_id: product.id,
          quantity: Number(form.quantity),
          buyer_name: form.buyer_name.trim(),
          buyer_email: form.buyer_email.trim(),
          buyer_cpf: form.buyer_cpf.trim(),
          buyer_registration: form.buyer_registration.trim() || null,
          buyer_semester: form.buyer_semester ? Number(form.buyer_semester) : null,
          method: form.method,
          apply_member_price: form.apply_member_price,
          notes: form.notes.trim() || null,
        },
      });
      toast.success("Venda registrada — recibo enviado por e-mail");
      onClose(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar venda manual</DialogTitle>
          <DialogDescription className="text-xs">{product.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div>
              <Label>Forma de pagamento *</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Nome do comprador *</Label>
            <Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={form.buyer_email}
                onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
              />
            </div>
            <div>
              <Label>CPF *</Label>
              <Input value={form.buyer_cpf} onChange={(e) => setForm({ ...form, buyer_cpf: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Matrícula</Label>
              <Input
                value={form.buyer_registration}
                onChange={(e) => setForm({ ...form, buyer_registration: e.target.value })}
              />
            </div>
            <div>
              <Label>Semestre</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={form.buyer_semester}
                onChange={(e) => setForm({ ...form, buyer_semester: e.target.value })}
              />
            </div>
          </div>
          {product.member_price && (
            <label className="flex items-center gap-2 text-sm rounded-lg border border-white/10 p-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.apply_member_price}
                onChange={(e) => setForm({ ...form, apply_member_price: e.target.checked })}
              />
              Aplicar preço de sócio (R$ {Number(product.member_price).toFixed(2)})
            </label>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-3.5 animate-spin mr-1" />} Registrar venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --- Eventos (Diretoria) --- */
function DirectorEvents({ athletic }: { athletic: Athletic }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [filterEv, setFilterEv] = useState<string>("__all");
  const [editEv, setEditEv] = useState<Partial<EventRow> | null>(null);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const ue = useServerFn(upsertEvent);
  const de = useServerFn(deleteEvent);
  async function reload() {
    const { data } = await supabase
      .from("athletic_events")
      .select("*")
      .eq("athletic_id", athletic.id)
      .order("created_at", { ascending: false });
    setEvents((data as any) ?? []);
    const ids = ((data as any) ?? []).map((e: any) => e.id);
    if (ids.length) {
      const { data: t } = await supabase
        .from("athletic_event_tickets")
        .select("event_id,price_paid,sold_channel,status")
        .in("event_id", ids)
        .eq("status", "sold");
      setTickets((t as any) ?? []);
    } else setTickets([]);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);

  const scoped = useMemo(
    () => (filterEv === "__all" ? tickets : tickets.filter((t) => t.event_id === filterEv)),
    [tickets, filterEv],
  );
  const siteRevenue = useMemo(
    () => scoped.filter((t) => t.sold_channel !== "manual").reduce((s, t) => s + Number(t.price_paid || 0), 0),
    [scoped],
  );
  const manualRevenue = useMemo(
    () => scoped.filter((t) => t.sold_channel === "manual").reduce((s, t) => s + Number(t.price_paid || 0), 0),
    [scoped],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Vendas pelo site</div>
          <div className="text-2xl font-black mt-1 text-emerald-200">R$ {siteRevenue.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Vendas manuais</div>
          <div className="text-2xl font-black mt-1 text-orange-200">R$ {manualRevenue.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Filtro por evento</div>
          <Select value={filterEv} onValueChange={setFilterEv}>
            <SelectTrigger className="mt-1 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <h3 className="font-black text-lg">Eventos ({events.length})</h3>
        <Button
          size="sm"
          onClick={() =>
            setEditEv({
              athletic_id: athletic.id,
              published: true,
              online_sales_open: false,
              price_member: 0,
              price_visitor: 0,
              total_tickets: 100,
            })
          }
        >
          <Plus className="size-4" /> Novo evento
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.map((e) => (
          <Card key={e.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
            <div className="aspect-video bg-black/40">
              {e.image_url ? (
                <img src={e.image_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(135deg, ${e.theme_color ?? athletic.primary_color}, ${athletic.secondary_color})`,
                  }}
                />
              )}
            </div>
            <CardContent className="p-3 space-y-2">
              <div className="font-bold">{e.title}</div>
              <div className="text-xs opacity-70">
                Vendidos: {e.tickets_sold}/{e.total_tickets}
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="flex-1" onClick={() => setSelected(e)}>
                  Gerenciar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white text-black hover:bg-neutral-100 hover:text-black border-white"
                  onClick={() => setEditEv(e)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={async () => {
                    if (!confirm2("Remover evento?")) return;
                    await de({ data: { athletic_id: athletic.id, id: e.id } });
                    reload();
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editEv} onOpenChange={(o) => !o && setEditEv(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEv?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          {editEv && (
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={editEv.title ?? ""} onChange={(e) => setEditEv({ ...editEv, title: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editEv.description ?? ""}
                  onChange={(e) => setEditEv({ ...editEv, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Local</Label>
                  <Input
                    value={editEv.location ?? ""}
                    onChange={(e) => setEditEv({ ...editEv, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor tema</Label>
                  <Input
                    type="color"
                    value={editEv.theme_color ?? athletic.primary_color}
                    onChange={(e) => setEditEv({ ...editEv, theme_color: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início</Label>
                  <Input
                    type="datetime-local"
                    value={editEv.starts_at?.slice(0, 16) ?? ""}
                    onChange={(e) => setEditEv({ ...editEv, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input
                    type="datetime-local"
                    value={editEv.ends_at?.slice(0, 16) ?? ""}
                    onChange={(e) => setEditEv({ ...editEv, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Imagem</Label>
                <ImageUpload
                  value={editEv.image_url ?? ""}
                  onChange={(url) => setEditEv({ ...editEv, image_url: url })}
                  folder="atletica/events"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Preço sócio (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editEv.price_member ?? 0}
                    onChange={(e) => setEditEv({ ...editEv, price_member: +e.target.value })}
                  />
                </div>
                <div>
                  <Label>Preço visitante (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editEv.price_visitor ?? 0}
                    onChange={(e) => setEditEv({ ...editEv, price_visitor: +e.target.value })}
                  />
                </div>
                <div>
                  <Label>Total de ingressos</Label>
                  <Input
                    type="number"
                    value={editEv.total_tickets ?? 0}
                    onChange={(e) => setEditEv({ ...editEv, total_tickets: +e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={!!editEv.published}
                    onChange={(e) => setEditEv({ ...editEv, published: e.target.checked })}
                  />{" "}
                  Publicado
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEv(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await ue({ data: editEv as any });
                  toast.success("Salvo");
                  setEditEv(null);
                  reload();
                } catch (e: any) {
                  toast.error(e?.message);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <EventManagerDialog
          athletic={athletic}
          event={selected}
          onClose={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* --- Gerenciador de evento (tickets + venda manual) --- */
function EventManagerDialog({
  athletic,
  event,
  onClose,
}: {
  athletic: Athletic;
  event: EventRow;
  onClose: () => void;
}) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [batchQty, setBatchQty] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState({
    buyer_name: "",
    buyer_email: "",
    buyer_phone: "",
    buyer_cpf: "",
    price_paid: 0,
    methods: { pix: 0, dinheiro: 0, cartao: 0 },
  });
  const gen = useServerFn(generateTicketBatch);
  const registerSale = useServerFn(registerManualTicketSale);

  async function reload() {
    const { data } = await supabase
      .from("athletic_event_tickets")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });
    setTickets((data as any) ?? []);
  }
  useEffect(() => {
    reload();
  }, [event.id]);

  const available = tickets.filter((t) => t.status === "available");
  const sold = tickets.filter((t) => t.status === "sold");

  async function generatePdf(onlyBatchId?: string) {
    const target = onlyBatchId ? tickets.filter((t) => t.batch_id === onlyBatchId) : available;
    if (target.length === 0) return toast.error("Nenhum ingresso disponível para PDF");
    const blob = await generateTicketsPdf({
      eventTitle: event.title,
      athleticName: athletic.name,
      location: event.location,
      startsAt: event.starts_at,
      primaryColor: athletic.primary_color,
      logoUrl: athletic.logo_url,
      tickets: target.map((t) => ({ code: t.code })),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ingressos-${event.title.replace(/\s+/g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
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
        eventTitle: event.title,
        athleticName: athletic.name,
        location: event.location,
        startsAt: event.starts_at,
        primaryColor: athletic.primary_color,
        logoUrl: athletic.logo_url,
        tickets: res.tickets.map((t: any) => ({ code: t.code })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ingressos-lote-${res.batch_id.slice(0, 6)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            Vendidos: {event.tickets_sold} / {event.total_tickets} • Emitidos: {tickets.length} • Disponíveis físicos:{" "}
            {available.length}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-3 items-end">
          <div>
            <Label>Emitir ingressos físicos (PDF)</Label>
            <div className="flex gap-2">
              <Input type="number" min={1} value={batchQty} onChange={(e) => setBatchQty(+e.target.value)} />
              <Button disabled={generating} onClick={handleGenerate}>
                <FileDown className="size-4" /> Gerar {batchQty}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => generatePdf()}>
              <FileDown className="size-4" /> PDF de todos disponíveis
            </Button>
            <Button onClick={() => setScannerOpen(true)}>
              <Camera className="size-4" /> Registrar venda manual
            </Button>
          </div>
        </div>

        {/* Scanner + form */}
        {scannerOpen && (
          <Card className="mt-4">
            <CardContent className="p-3 space-y-3">
              {!pendingScan ? (
                <>
                  <p className="text-sm">Aponte a câmera para o QR do ingresso físico.</p>
                  <QrScanner
                    onScan={(code) => {
                      setPendingScan(code.toUpperCase());
                      const priceDefault = event.price_visitor;
                      setSaleForm({
                        buyer_name: "",
                        buyer_email: "",
                        buyer_phone: "",
                        buyer_cpf: "",
                        price_paid: priceDefault,
                        methods: { pix: priceDefault, dinheiro: 0, cartao: 0 },
                      });
                    }}
                  />
                  <Button variant="ghost" onClick={() => setScannerOpen(false)}>
                    Fechar câmera
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="size-4" />
                    <code className="bg-black text-white px-2 py-1 rounded font-mono">{pendingScan}</code>
                  </div>
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={saleForm.buyer_name}
                      onChange={(e) => setSaleForm({ ...saleForm, buyer_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Gmail *</Label>
                      <Input
                        value={saleForm.buyer_email}
                        onChange={(e) => setSaleForm({ ...saleForm, buyer_email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={saleForm.buyer_phone}
                        onChange={(e) => setSaleForm({ ...saleForm, buyer_phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>CPF *</Label>
                    <Input
                      value={saleForm.buyer_cpf}
                      onChange={(e) => setSaleForm({ ...saleForm, buyer_cpf: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Preço pago (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={saleForm.price_paid}
                      onChange={(e) => setSaleForm({ ...saleForm, price_paid: +e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Métodos (soma = preço)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Pix</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={saleForm.methods.pix}
                          onChange={(e) =>
                            setSaleForm({ ...saleForm, methods: { ...saleForm.methods, pix: +e.target.value } })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Dinheiro</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={saleForm.methods.dinheiro}
                          onChange={(e) =>
                            setSaleForm({ ...saleForm, methods: { ...saleForm.methods, dinheiro: +e.target.value } })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cartão</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={saleForm.methods.cartao}
                          onChange={(e) =>
                            setSaleForm({ ...saleForm, methods: { ...saleForm.methods, cartao: +e.target.value } })
                          }
                        />
                      </div>
                    </div>
                    <div className="text-xs opacity-70">
                      Soma: R$ {(saleForm.methods.pix + saleForm.methods.dinheiro + saleForm.methods.cartao).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPendingScan(null);
                      }}
                    >
                      Escanear outro
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        try {
                          await registerSale({
                            data: {
                              athletic_id: athletic.id,
                              event_id: event.id,
                              code: pendingScan,
                              buyer_name: saleForm.buyer_name,
                              buyer_email: saleForm.buyer_email,
                              buyer_phone: saleForm.buyer_phone || null,
                              buyer_cpf: saleForm.buyer_cpf,
                              price_paid: saleForm.price_paid,
                              payment_methods: saleForm.methods,
                            },
                          });
                          toast.success("Venda registrada!");
                          setPendingScan(null);
                          reload();
                        } catch (e: any) {
                          toast.error(e?.message);
                        }
                      }}
                    >
                      <CheckCircle2 className="size-4" /> Confirmar venda
                    </Button>
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
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Código</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Comprador</th>
                  <th className="text-left p-2">Canal</th>
                  <th className="text-left p-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2 font-mono">{t.code}</td>
                    <td className="p-2">
                      <Badge variant={t.status === "sold" ? "default" : "secondary"}>{t.status}</Badge>
                    </td>
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
  const [manual, setManual] = useState({ description: "", gross_amount: 0, is_income: true, receipt_url: "" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const add = useServerFn(addAthleticCashEntry);
  const del = useServerFn(deleteAthleticCashEntry);
  async function reload() {
    const { data } = await supabase
      .from("athletic_cash_entries")
      .select("*")
      .eq("athletic_id", athletic.id)
      .order("occurred_at", { ascending: false });
    setEntries((data as any) ?? []);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);
  const total = useMemo(
    () => entries.reduce((s, e) => s + (e.is_income ? +e.net_amount : -+e.net_amount), 0),
    [entries],
  );
  const byCat = useMemo(
    () =>
      entries.reduce((m: any, e) => {
        m[e.category] = (m[e.category] ?? 0) + (e.is_income ? +e.net_amount : -+e.net_amount);
        return m;
      }, {}),
    [entries],
  );
  const siteTotal = useMemo(
    () =>
      entries
        .filter((e) => e.is_income && ["product", "event_online", "membership"].includes(e.category))
        .reduce((s, e) => s + +e.net_amount, 0),
    [entries],
  );
  const manualTotal = useMemo(
    () =>
      entries
        .filter((e) => e.is_income && ["event_manual", "manual"].includes(e.category))
        .reduce((s, e) => s + +e.net_amount, 0),
    [entries],
  );
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70 flex items-center gap-1.5">
            <TrendingUp className="size-3.5" /> Vendas Totais no Site
          </div>
          <div className="text-2xl font-black mt-1 text-emerald-200">R$ {siteTotal.toFixed(2)}</div>
          <div className="text-[11px] opacity-60 mt-0.5">Produtos + eventos online + associações</div>
        </div>
        <div className="rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/15 to-orange-500/5 p-4">
          <div className="text-[10px] uppercase tracking-widest font-black opacity-70 flex items-center gap-1.5">
            <Wallet className="size-3.5" /> Vendas Totais Manuais
          </div>
          <div className="text-2xl font-black mt-1 text-orange-200">R$ {manualTotal.toFixed(2)}</div>
          <div className="text-[11px] opacity-60 mt-0.5">Ingressos manuais + lançamentos manuais</div>
        </div>
      </div>
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
            <Input
              placeholder="Descrição"
              value={manual.description}
              onChange={(e) => setManual({ ...manual, description: e.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Valor"
              value={manual.gross_amount}
              onChange={(e) => setManual({ ...manual, gross_amount: +e.target.value })}
            />
            <Select
              value={manual.is_income ? "in" : "out"}
              onValueChange={(v) => setManual({ ...manual, is_income: v === "in" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Entrada</SelectItem>
                <SelectItem value="out">Saída</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={async () => {
                try {
                  if (!manual.description.trim()) return toast.error("Descrição obrigatória");
                  await add({
                    data: {
                      athletic_id: athletic.id,
                      category: manual.is_income ? "manual" : "withdraw",
                      description: manual.description,
                      gross_amount: manual.gross_amount,
                      is_income: manual.is_income,
                      receipt_url: manual.receipt_url || null,
                    },
                  });
                  setManual({ description: "", gross_amount: 0, is_income: true, receipt_url: "" });
                  toast.success("Lançamento registrado");
                  reload();
                } catch (e: any) {
                  toast.error(e?.message);
                }
              }}
            >
              Lançar
            </Button>
          </div>
          <div>
            <Label className="text-xs opacity-70 flex items-center gap-1.5">
              <Paperclip className="size-3.5" /> Comprovante (opcional, imagem até 5 MB)
            </Label>
            <ImageUpload
              label=""
              folder={`atletica/${athletic.id}/receipts`}
              value={manual.receipt_url}
              onChange={(url) => setManual({ ...manual, receipt_url: url })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 text-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Categoria</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-right p-2">Bruto</th>
              <th className="text-right p-2">Líquido</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center opacity-60">
                  Sem movimentações
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const isOpen = expanded.has(e.id);
              return (
                <>
                  <tr key={e.id} className="border-t border-white/10">
                    <td className="p-2 opacity-80">{new Date(e.occurred_at).toLocaleString("pt-BR")}</td>
                    <td className="p-2">
                      <Badge variant="secondary">{e.category}</Badge>
                    </td>
                    <td className="p-2">
                      <span>{e.description}</span>
                      {e.receipt_url && <Paperclip className="size-3 inline ml-1 opacity-60" />}
                    </td>
                    <td className="p-2 text-right">R$ {Number(e.gross_amount).toFixed(2)}</td>
                    <td className={`p-2 text-right font-bold ${e.is_income ? "text-emerald-300" : "text-red-300"}`}>
                      {e.is_income ? "+" : "-"} R$ {Number(e.net_amount).toFixed(2)}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {e.receipt_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => toggleExpand(e.id)}
                          aria-label="Ver comprovante"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-400"
                        onClick={async () => {
                          if (!confirm2("Excluir este lançamento?")) return;
                          try {
                            await del({ data: { athletic_id: athletic.id, id: e.id } });
                            toast.success("Removido");
                            reload();
                          } catch (err: any) {
                            toast.error(err?.message);
                          }
                        }}
                        aria-label="Excluir"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                  {isOpen && e.receipt_url && (
                    <tr className="border-t border-white/5 bg-black/30">
                      <td colSpan={6} className="p-3">
                        <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                          <img
                            src={e.receipt_url}
                            alt="Comprovante"
                            className="max-h-80 rounded-lg border border-white/10"
                          />
                        </a>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </Card>

      <InfinitepayCard athletic={athletic} />
    </div>
  );
}

/* --- Config --- */
function DirectorConfig({ athletic }: { athletic: Athletic }) {
  const [s, setS] = useState({ ...athletic });
  const [maint, setMaint] = useState<boolean>(!!(athletic as any).maintenance_enabled);
  const upd = useServerFn(updateAthletic);
  const toggleMaint = useServerFn(setAthleticMaintenance);
  return (
    <div className="space-y-4">
      <Card className={maint ? "border-orange-400/50 bg-orange-500/10 text-white" : "bg-white/5 border-white/10 text-white"}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`size-10 rounded-xl flex items-center justify-center ${maint ? "bg-orange-500/25 text-orange-300" : "bg-white/10"}`}>
            <Wrench className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-black text-sm">Modo manutenção da atlética</div>
            <div className="text-xs opacity-70">
              {maint
                ? "A aba AAAMD está bloqueada — só diretores e presidentes acessam."
                : "A página da atlética está aberta ao público."}
            </div>
          </div>
          <Button
            size="sm"
            variant={maint ? "destructive" : "default"}
            onClick={async () => {
              try {
                const next = !maint;
                await toggleMaint({ data: { athletic_id: athletic.id, enabled: next } });
                setMaint(next);
                toast.success(next ? "Atlética em manutenção" : "Atlética reaberta");
              } catch (e: any) { toast.error(e?.message); }
            }}
          >
            {maint ? "Desativar manutenção" : "Ativar manutenção"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              rows={4}
              value={s.description ?? ""}
              onChange={(e) => setS({ ...s, description: e.target.value })}
            />
          </div>
          <div>
            <Label>Logo (redonda)</Label>
            <ImageUpload
              value={s.logo_url ?? ""}
              onChange={(url) => setS({ ...s, logo_url: url })}
              folder="atletica/brand"
            />
          </div>
          <div>
            <Label>Capa (imagem de fundo)</Label>
            <ImageUpload
              value={s.cover_url ?? ""}
              onChange={(url) => setS({ ...s, cover_url: url })}
              folder="atletica/brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cor primária</Label>
              <Input
                type="color"
                value={s.primary_color}
                onChange={(e) => setS({ ...s, primary_color: e.target.value })}
              />
            </div>
            <div>
              <Label>Cor secundária</Label>
              <Input
                type="color"
                value={s.secondary_color}
                onChange={(e) => setS({ ...s, secondary_color: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor da associação (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={s.membership_price}
                onChange={(e) => setS({ ...s, membership_price: +e.target.value })}
              />
            </div>
            <div>
              <Label>Período (dias)</Label>
              <Input
                type="number"
                value={s.membership_period_days}
                onChange={(e) => setS({ ...s, membership_period_days: +e.target.value })}
              />
            </div>
          </div>
          <Button
            onClick={async () => {
              try {
                await upd({ data: { ...s, id: athletic.id } as any });
                toast.success("Salvo");
              } catch (e: any) {
                toast.error(e?.message);
              }
            }}
          >
            Salvar
          </Button>
        </CardContent>
      </Card>

      <MembershipCyclesCard athletic={athletic} />

      <HistoryImagesCard athletic={athletic} />
    </div>
  );
}

/* --- Ciclos de associação --- */
function MembershipCyclesCard({ athletic }: { athletic: Athletic }) {
  const [open, setOpen] = useState<boolean>(Boolean((athletic as any).memberships_open));
  const [cycles, setCycles] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const setOpenFn = useServerFn(setMembershipsOpen);
  const upsertFn = useServerFn(upsertMembershipCycle);
  const delFn = useServerFn(deleteMembershipCycle);
  async function reload() {
    const { data } = await supabase
      .from("athletic_membership_cycles")
      .select("*")
      .eq("athletic_id", athletic.id)
      .order("starts_at", { ascending: false });
    setCycles((data as any) ?? []);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);
  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-black">Ciclos de associação</h4>
            <p className="text-xs opacity-70">
              Enquanto houver um ciclo ativo, quem se associar recebe automaticamente o status de sócio até a data final
              do ciclo, com preços separados para novos e renovações.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm shrink-0">
            <input
              type="checkbox"
              checked={open}
              onChange={async (e) => {
                const v = e.target.checked;
                setOpen(v);
                try {
                  await setOpenFn({ data: { athletic_id: athletic.id, open: v } });
                  toast.success(v ? "Associações abertas" : "Associações fechadas");
                } catch (err: any) {
                  toast.error(err?.message);
                  setOpen(!v);
                }
              }}
            />
            Aberto para novas associações
          </label>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                athletic_id: athletic.id,
                name: "",
                starts_at: "",
                ends_at: "",
                price_new: athletic.membership_price ?? 0,
                price_renewal: athletic.membership_price ?? 0,
                open: true,
                is_current: false,
              })
            }
          >
            <Plus className="size-4" /> Novo ciclo
          </Button>
        </div>

        <div className="space-y-2">
          {cycles.length === 0 && <div className="text-sm opacity-60">Nenhum ciclo cadastrado.</div>}
          {cycles.map((c) => (
            <div
              key={c.id}
              className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-lg bg-black/30 border border-white/10"
            >
              <div className="flex-1">
                <div className="font-bold flex items-center gap-2">
                  {c.name}
                  {c.is_current && (
                    <Badge className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px]">
                      Ciclo atual
                    </Badge>
                  )}
                </div>
                <div className="text-xs opacity-70">
                  {new Date(c.starts_at).toLocaleDateString("pt-BR")} →{" "}
                  {new Date(c.ends_at).toLocaleDateString("pt-BR")}
                  {" · "}Novo R$ {Number(c.price_new).toFixed(2)} · Renovação R$ {Number(c.price_renewal).toFixed(2)}
                  {c.open ? " · Aberto" : " · Fechado"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white text-black hover:bg-neutral-100 hover:text-black border-white"
                  onClick={() => setEditing(c)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={async () => {
                    if (!confirm2("Remover ciclo?")) return;
                    try {
                      await delFn({ data: { athletic_id: athletic.id, id: c.id } });
                      toast.success("Removido");
                      reload();
                    } catch (err: any) {
                      toast.error(err?.message);
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar ciclo" : "Novo ciclo"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <Label>Nome (ex.: 2026/1)</Label>
                  <Input
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input
                      type="date"
                      value={(editing.starts_at ?? "").slice(0, 10)}
                      onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input
                      type="date"
                      value={(editing.ends_at ?? "").slice(0, 10)}
                      onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Preço novo sócio (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.price_new ?? 0}
                      onChange={(e) => setEditing({ ...editing, price_new: +e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Preço renovação (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.price_renewal ?? 0}
                      onChange={(e) => setEditing({ ...editing, price_renewal: +e.target.value })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.open ?? true}
                    onChange={(e) => setEditing({ ...editing, open: e.target.checked })}
                  />
                  Ciclo aberto (aceita associações)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!editing.is_current}
                    onChange={(e) => setEditing({ ...editing, is_current: e.target.checked })}
                  />
                  Definir como <strong>ciclo atual</strong> (novas associações usam este ciclo e a validade termina no
                  fim dele)
                </label>
                <p className="text-[11px] opacity-60">
                  Só pode haver um ciclo marcado como atual por atlética. Marcar este desmarca os demais.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await upsertFn({
                      data: {
                        id: editing.id,
                        athletic_id: athletic.id,
                        name: editing.name,
                        starts_at: editing.starts_at,
                        ends_at: editing.ends_at,
                        price_new: Number(editing.price_new) || 0,
                        price_renewal: Number(editing.price_renewal) || 0,
                        open: !!editing.open,
                        is_current: !!editing.is_current,
                      },
                    });
                    toast.success("Salvo");
                    setEditing(null);
                    reload();
                  } catch (err: any) {
                    toast.error(err?.message);
                  }
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* --- InfinitePay integration card --- */
function InfinitepayCard({ athletic }: { athletic: Athletic }) {
  const [form, setForm] = useState({ handle: "", webhook_secret: "" });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; handle: string | null } | null>(null);
  const save = useServerFn(saveInfinitepayCredentials);
  const disconnect = useServerFn(disconnectInfinitepay);
  const getStatus = useServerFn(getInfinitepayStatus);

  const reload = async () => {
    try {
      const s = await getStatus({ data: { athletic_id: athletic.id } });
      setStatus(s as any);
    } catch {
      /* sem permissão */
    }
  };
  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, [athletic.id]);

  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardHeader>
        <CardTitle className="text-white text-lg">InfinitePay da atlética</CardTitle>
        <CardDescription className="text-white/60">
          Conecte seu link de Checkout Integrado para receber Pix, débito e crédito direto na conta bancária da
          atlética.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.connected ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              Conectada como <strong>@{status.handle}</strong>.
            </div>
            <Button
              variant="outline"
              className="bg-transparent text-white border-white/20 hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Desconectar InfinitePay desta atlética?")) return;
                setBusy(true);
                try {
                  await disconnect({ data: { athletic_id: athletic.id } });
                  toast.success("Desconectada");
                  await reload();
                } catch (e: any) {
                  toast.error(e?.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Handle InfinitePay (InfiniteTag, sem @)</Label>
              <Input
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value.replace(/^@/, "") })}
                placeholder="aaamd-desbravadores"
              />
              <p className="text-[11px] opacity-60 mt-1">
                Este é o identificador que aparece no seu link. Ex.: em{" "}
                <code>checkout.infinitepay.io/aaamd-desbravadores</code>, o handle é{" "}
                <strong>aaamd-desbravadores</strong>.
              </p>
            </div>
            <div>
              <Label>Webhook Secret (opcional)</Label>
              <Input
                type="password"
                value={form.webhook_secret}
                onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                placeholder="deixe em branco se não configurou"
              />
              <p className="text-[11px] opacity-60 mt-1">
                Se você configurou uma chave secreta no painel da InfinitePay para assinar webhooks, cole aqui para
                validarmos as notificações.
              </p>
            </div>
            <Button
              disabled={busy || !form.handle}
              onClick={async () => {
                setBusy(true);
                try {
                  await save({
                    data: {
                      athletic_id: athletic.id,
                      handle: form.handle,
                      api_key: null,
                      webhook_secret: form.webhook_secret || null,
                    },
                  });
                  toast.success("InfinitePay conectada");
                  setForm({ handle: "", webhook_secret: "" });
                  await reload();
                } catch (e: any) {
                  toast.error(e?.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Conectar InfinitePay
            </Button>
            <p className="text-[11px] opacity-60">
              URL de webhook para configurar no painel InfinitePay: <br />
              <code className="break-all">https://ligasuno.com.br/api/public/payments/infinitepay-webhook</code>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ helpers ============ */
function Chip({ children, active, onClick, color }: any) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition"
      style={
        active
          ? { background: color ?? "white", color: color ? "white" : "black" }
          : { background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }
      }
    >
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
function EmptyDark({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
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

/* ============ COLEÇÕES — RESPONSIVO (1 = full, 2 = split, 3+ = carrossel) ============ */
function CollectionsMarquee({
  athletic,
  onOpenCollection,
}: {
  athletic: Athletic;
  onOpenCollection?: (colId: string) => void;
}) {
  const [cols, setCols] = useState<Collection[]>([]);
  const [prodsByCol, setProdsByCol] = useState<Record<string, { id: string; image: string | null; title: string }[]>>(
    {},
  );
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("athletic_collections")
        .select("*")
        .eq("athletic_id", athletic.id)
        .eq("active", true)
        .order("display_order");
      const list = (data as any as Collection[]) ?? [];
      setCols(list);
      if (list.length > 0) {
        const ids = list.map((c) => c.id);
        const { data: prods } = await supabase
          .from("athletic_products")
          .select("id,title,images,collection_id,active")
          .eq("athletic_id", athletic.id)
          .eq("active", true)
          .in("collection_id", ids);
        const map: Record<string, { id: string; image: string | null; title: string }[]> = {};
        (prods ?? []).forEach((p: any) => {
          const arr = map[p.collection_id] ?? (map[p.collection_id] = []);
          arr.push({ id: p.id, title: p.title, image: (p.images?.[0] as string) ?? null });
        });
        setProdsByCol(map);
      }
    })();
  }, [athletic.id]);
  if (cols.length === 0) return null;

  const layout: "single" | "split" | "carousel" =
    cols.length === 1 ? "single" : cols.length === 2 ? "split" : "carousel";

  const ProductStrip = ({ items }: { items: { id: string; image: string | null; title: string }[] }) => {
    if (!items || items.length === 0) return null;
    const loop = items.length >= 4 ? [...items, ...items] : items;
    return (
      <div className="relative overflow-hidden marquee-mask border-t border-white/10 bg-black/40">
        <div
          className={`flex gap-2 py-2 px-2 ${items.length >= 4 ? "w-max animate-marquee-slow hover:[animation-play-state:paused]" : "flex-wrap justify-center"}`}
        >
          {loop.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className="size-14 shrink-0 rounded-md overflow-hidden bg-white/5 border border-white/10"
            >
              {p.image ? (
                <img src={p.image} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CardBlock = (c: Collection, opts: { size: "sm" | "md" | "lg"; keySuffix?: string | number }) => {
    const ratio = opts.size === "lg" ? "aspect-[21/9]" : opts.size === "md" ? "aspect-[4/5]" : "aspect-[4/5]";
    const width = opts.size === "lg" ? "w-full" : opts.size === "md" ? "w-full" : "w-72 shrink-0";
    const titleSize =
      opts.size === "lg" ? "text-4xl md:text-5xl" : opts.size === "md" ? "text-2xl md:text-3xl" : "text-2xl";
    const items = prodsByCol[c.id] ?? [];
    return (
      <div
        key={`${c.id}-${opts.keySuffix ?? "x"}`}
        className={`${width} group cursor-pointer`}
        onClick={() => onOpenCollection?.(c.id)}
      >
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl group-hover:scale-[1.01] transition-transform">
          <div className={`relative ${ratio}`}>
            {c.cover_url ? (
              <img
                src={c.cover_url}
                alt={c.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg, ${athletic.primary_color}, ${athletic.secondary_color})`,
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div
                className="text-[10px] uppercase tracking-widest font-bold mb-1"
                style={{ color: athletic.secondary_color }}
              >
                Coleção
              </div>
              <div className={`${titleSize} font-black uppercase tracking-tight leading-tight`}>{c.name}</div>
              {c.description && (
                <div className="text-xs md:text-sm opacity-80 mt-1 line-clamp-2 max-w-xl">{c.description}</div>
              )}
              {items.length > 0 && (
                <div className="mt-3 text-[11px] uppercase tracking-widest font-bold opacity-80">
                  {items.length} peça{items.length > 1 ? "s" : ""} • toque para ver
                </div>
              )}
            </div>
          </div>
          <ProductStrip items={items} />
        </div>
      </div>
    );
  };

  return (
    <section className="relative py-10 border-y border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest opacity-60 font-bold">Explore</div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Coleções</h2>
        </div>
        <div className="text-xs opacity-60">
          {cols.length} coleção{cols.length > 1 ? "es" : ""}
        </div>
      </div>
      {layout === "single" && <div className="max-w-7xl mx-auto px-4">{CardBlock(cols[0], { size: "lg" })}</div>}
      {layout === "split" && (
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          {cols.map((c) => CardBlock(c, { size: "md" }))}
        </div>
      )}
      {layout === "carousel" && (
        <div className="marquee-mask">
          <div className="flex gap-5 w-max animate-marquee hover:[animation-play-state:paused] px-4">
            {[...cols, ...cols].map((c, i) => CardBlock(c, { size: "sm", keySuffix: i }))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ============ ESPORTES — Grid ============ */
type Sport = {
  id: string;
  athletic_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  coach: string | null;
  schedule: string | null;
  display_order: number;
  active: boolean;
  gender: "masculino" | "feminino" | "misto";
  max_capacity: number | null;
  enrollment_open: boolean;
  whatsapp_url: string | null;
};

/* ============ HISTÓRIA (Página Inicial) ============ */
function HistoryShowcase({ ath }: { ath: Athletic }) {
  const images: string[] = ((ath as any).history_images as string[] | null) ?? [];
  const title: string = (ath as any).history_title || "Conheça a Nossa História";
  const description: string | null = (ath as any).history_description ?? null;

  if (images.length === 0 && !description) return null;

  // duplicamos as imagens para efeito de marquee infinito
  const track = images.length > 0 ? [...images, ...images] : [];

  return (
    <section className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-white/5 to-black/40">
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold mb-4"
          style={{ background: `${ath.primary_color}22`, color: "#fff", border: `1px solid ${ath.primary_color}66` }}
        >
          <BookOpen className="size-3.5" /> Nossa história
        </div>
        <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-4">{title}</h2>
        {description && (
          <p className="text-sm md:text-base text-white/80 whitespace-pre-line leading-relaxed">{description}</p>
        )}
        {images.length > 0 && (
          <div className="mt-5">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
            >
              <Link to="/atletica-galeria">
                <Images className="size-4 mr-1.5" /> Expandir galeria completa <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </div>
      {images.length > 0 && (
        <div className="relative overflow-hidden pb-8">
          <div
            className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, rgba(10,10,10,0.9), transparent)" }}
          />
          <div
            className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to left, rgba(10,10,10,0.9), transparent)" }}
          />
          <div
            className="flex gap-4 w-max"
            style={{
              animation: `aaamd-history-marquee ${Math.max(20, images.length * 6)}s linear infinite`,
            }}
          >
            {track.map((src, i) => (
              <div
                key={i}
                className="relative shrink-0 w-72 md:w-96 aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-black shadow-xl"
              >
                <img src={src} alt="História" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <style>{`@keyframes aaamd-history-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        </div>
      )}
    </section>
  );
}

/* ============ Config → Imagens da história ============ */
function HistoryImagesCard({ athletic }: { athletic: Athletic }) {
  const [title, setTitle] = useState<string>((athletic as any).history_title ?? "Conheça a Nossa História");
  const [description, setDescription] = useState<string>((athletic as any).history_description ?? "");
  const [images, setImages] = useState<string[]>((((athletic as any).history_images as string[] | null) ?? []).slice());
  const upd = useServerFn(updateAthletic);
  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardContent className="p-6 space-y-4">
        <div>
          <h4 className="font-black">Nossa história (página inicial)</h4>
          <p className="text-xs opacity-70">
            Adicione um título, descrição e fotos para a seção "Conheça a Nossa História" na aba Página Inicial. As
            imagens passam automaticamente.
          </p>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Conte um pouco sobre a trajetória da atlética..."
          />
        </div>
        <div className="space-y-2">
          <Label>Imagens</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((url, i) => (
              <div
                key={i}
                className="relative group rounded-lg overflow-hidden border border-white/10 bg-black/40 aspect-square"
              >
                <img src={url} alt={`História ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, j) => j !== i))}
                  className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remover imagem"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const arr = images.slice();
                      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                      setImages(arr);
                    }}
                    className="size-6 rounded-full bg-black/70 text-white text-xs disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={i === images.length - 1}
                    onClick={() => {
                      const arr = images.slice();
                      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                      setImages(arr);
                    }}
                    className="size-6 rounded-full bg-black/70 text-white text-xs disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
            <div className="aspect-square rounded-lg border border-dashed border-white/20 bg-black/20 p-2 flex items-center justify-center">
              <ImageUpload
                value=""
                onChange={(url) => {
                  if (url) setImages([...images, url]);
                }}
                folder="atletica/history"
              />
            </div>
          </div>
        </div>
        <Button
          onClick={async () => {
            try {
              await upd({
                data: {
                  id: athletic.id,
                  history_title: title,
                  history_description: description || null,
                  history_images: images,
                } as any,
              });
              toast.success("História salva — recarregando…");
              setTimeout(() => window.location.reload(), 600);
            } catch (e: any) {
              toast.error(e?.message ?? "Falha ao salvar");
            }
          }}
        >
          Salvar história
        </Button>
      </CardContent>
    </Card>
  );
}

function SportsShowcase({ athletic }: { athletic: Athletic }) {
  const [sports, setSports] = useState<Sport[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("athletic_sports" as any)
        .select("*")
        .eq("athletic_id", athletic.id)
        .eq("active", true)
        .order("display_order");
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
          <div className="text-xs opacity-60">
            {sports.length} modalidade{sports.length > 1 ? "s" : ""}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sports.map((s) => (
            <div
              key={s.id}
              className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black shadow-xl"
            >
              {s.image_url ? (
                <img
                  src={s.image_url}
                  alt={s.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${athletic.primary_color}, ${athletic.secondary_color})`,
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="font-black text-lg uppercase leading-tight drop-shadow-lg">{s.name}</div>
                {s.coach && <div className="text-[11px] opacity-80 mt-0.5">Diretor(a): {s.coach}</div>}
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
    const { data } = await supabase
      .from("athletic_sports" as any)
      .select("*")
      .eq("athletic_id", athletic.id)
      .order("display_order");
    setSports((data as any) ?? []);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-lg">Esportes ({sports.length})</h3>
        <Button
          size="sm"
          onClick={() => setEditing({ athletic_id: athletic.id, active: true, display_order: sports.length })}
        >
          <Plus className="size-4" /> Novo esporte
        </Button>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sports.map((s) => (
          <Card key={s.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
            <div className="aspect-square bg-black/40">
              {s.image_url ? (
                <img src={s.image_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-30">
                  <Trophy className="size-12" />
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <div className="font-bold">{s.name}</div>
              {s.coach && <div className="text-xs opacity-70">Diretor(a): {s.coach}</div>}
              <div className="flex gap-1 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 bg-white text-black hover:bg-neutral-100 hover:text-black border-white"
                  onClick={() => setEditing(s)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={async () => {
                    if (!confirm2("Remover?")) return;
                    await del({ data: { athletic_id: athletic.id, id: s.id } });
                    reload();
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar esporte" : "Novo esporte"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Imagem</Label>
                <ImageUpload
                  value={editing.image_url ?? ""}
                  onChange={(url) => setEditing({ ...editing, image_url: url })}
                  folder="atletica/sports"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Diretor(a)</Label>
                  <Input
                    value={editing.coach ?? ""}
                    onChange={(e) => setEditing({ ...editing, coach: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input
                    placeholder="Ex: Ter/Qui 20h"
                    value={editing.schedule ?? ""}
                    onChange={(e) => setEditing({ ...editing, schedule: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gênero</Label>
                  <Select
                    value={editing.gender ?? "misto"}
                    onValueChange={(v) => setEditing({ ...editing, gender: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="misto">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Limite de vagas (opcional)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Sem limite"
                    value={editing.max_capacity ?? ""}
                    onChange={(e) => setEditing({ ...editing, max_capacity: e.target.value ? +e.target.value : null })}
                  />
                </div>
              </div>
              <div>
                <Label>Link do grupo no WhatsApp (opcional)</Label>
                <Input
                  placeholder="https://chat.whatsapp.com/..."
                  value={editing.whatsapp_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, whatsapp_url: e.target.value })}
                />
                <p className="text-xs opacity-60 mt-1">O botão aparece para atletas já inscritos.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={editing.display_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, display_order: +e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm pt-6">
                  <input
                    type="checkbox"
                    checked={editing.active ?? true}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />{" "}
                  Ativo
                </label>
                <label className="flex items-center gap-2 text-sm pt-6">
                  <input
                    type="checkbox"
                    checked={editing.enrollment_open ?? true}
                    onChange={(e) => setEditing({ ...editing, enrollment_open: e.target.checked })}
                  />{" "}
                  Inscrições abertas
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await upsert({ data: editing as any });
                  toast.success("Salvo");
                  setEditing(null);
                  reload();
                } catch (e: any) {
                  toast.error(e?.message);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ DIRETORIA — Parceiros ============ */
function DirectorPartners({ athletic }: { athletic: Athletic }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [editing, setEditing] = useState<Partial<Partner> | null>(null);
  const upsert = useServerFn(upsertPartner);
  const del = useServerFn(deletePartner);
  async function reload() {
    const { data } = await supabase
      .from("athletic_partners" as any)
      .select("*")
      .eq("athletic_id", athletic.id)
      .order("display_order");
    setPartners((data as any) ?? []);
  }
  useEffect(() => {
    reload();
  }, [athletic.id]);
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-lg">Parceiros ({partners.length})</h3>
        <Button
          size="sm"
          onClick={() => setEditing({ athletic_id: athletic.id, active: true, display_order: partners.length })}
        >
          <Plus className="size-4" /> Novo parceiro
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {partners.map((p) => (
          <Card key={p.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
            {p.image_url && (
              <div className="aspect-video bg-black/40">
                <img src={p.image_url} className="w-full h-full object-cover" alt="" />
              </div>
            )}
            <CardContent className="p-3">
              <div className="font-bold">{p.name}</div>
              {p.discount_text && <div className="text-xs opacity-70 mt-0.5">🎟 {p.discount_text}</div>}
              {p.description && <div className="text-xs opacity-60 mt-1 line-clamp-2">{p.description}</div>}
              <div className="flex gap-1 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 bg-white text-black hover:bg-neutral-100 hover:text-black border-white"
                  onClick={() => setEditing(p)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={async () => {
                    if (!confirm2("Remover?")) return;
                    await del({ data: { athletic_id: athletic.id, id: p.id } });
                    reload();
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome do parceiro</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição (explique o desconto e como usar)</Label>
                <Textarea
                  rows={4}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Imagem/Logo</Label>
                <ImageUpload
                  value={editing.image_url ?? ""}
                  onChange={(url) => setEditing({ ...editing, image_url: url })}
                  folder="atletica/partners"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Selo de desconto (ex: "10% OFF")</Label>
                  <Input
                    value={editing.discount_text ?? ""}
                    onChange={(e) => setEditing({ ...editing, discount_text: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Link (opcional)</Label>
                  <Input
                    placeholder="https://..."
                    value={editing.link_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={editing.display_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, display_order: +e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm pt-6">
                  <input
                    type="checkbox"
                    checked={editing.active ?? true}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />{" "}
                  Ativo
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await upsert({ data: editing as any });
                  toast.success("Salvo");
                  setEditing(null);
                  reload();
                } catch (e: any) {
                  toast.error(e?.message);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ EDITOR DE IMAGENS DO PRODUTO (múltiplas, com capa) ============ */
function ProductImagesEditor({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const [staging, setStaging] = useState("");
  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  }
  return (
    <div className="space-y-2">
      <Label>Imagens do produto ({images.length}) — a 1ª é a capa</Label>
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((url, i) => (
            <div
              key={url + i}
              className={`relative aspect-square rounded-lg overflow-hidden border ${i === 0 ? "border-primary ring-2 ring-primary/40" : "border-white/10"}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <div className="absolute top-1 left-1 text-[10px] font-black uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  Capa
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-gradient-to-t from-black/80 to-transparent">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="text-white/90 disabled:opacity-30 text-xs px-1"
                  aria-label="Mover para trás"
                >
                  ◀
                </button>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => move(i, 0)}
                    className="text-white/90 text-[10px] uppercase font-bold px-1"
                    title="Definir como capa"
                  >
                    Capa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === images.length - 1}
                  className="text-white/90 disabled:opacity-30 text-xs px-1"
                  aria-label="Mover para frente"
                >
                  ▶
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 size-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"
                aria-label="Remover imagem"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-dashed border-white/20 p-3">
        <div className="text-xs opacity-70 mb-2">Adicionar imagem</div>
        <ImageUpload
          value={staging}
          onChange={(url) => {
            if (url) {
              onChange([...images, url]);
              setStaging("");
            } else setStaging("");
          }}
          folder="atletica/products"
        />
      </div>
    </div>
  );
}

/* ============ HISTÓRICO DE COMPRAS DO USUÁRIO ============ */
function PurchaseHistorySection({ athletic, user }: { athletic: Athletic; user: any }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const retry = useServerFn(retryProductOrderCheckout);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ordersRes, ticketsRes, membershipsRes] = await Promise.all([
        supabase
          .from("athletic_product_orders")
          .select(
            "id,total,subtotal,status,created_at,buyer_name,athletic_product_order_items(id,title,quantity,line_total,delivery_status,product_id,athletic_products(images))",
          )
          .eq("athletic_id", athletic.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("athletic_event_tickets")
          .select("id,code,price_paid,status,sold_at,event_id,athletic_events(title,starts_at,image_url)")
          .eq("buyer_user_id", user.id)
          .order("sold_at", { ascending: false }),
        supabase
          .from("athletic_membership_payments")
          .select("id,amount,status,created_at,method")
          .eq("athletic_id", athletic.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setOrders((ordersRes.data as any) ?? []);
      setTickets((ticketsRes.data as any) ?? []);
      setMemberships((membershipsRes.data as any) ?? []);
      setLoading(false);
    })();
  }, [athletic.id, user.id]);

  const totalSpent = useMemo(() => {
    const o = orders.filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.total || 0), 0);
    const t = tickets.filter((x) => x.status === "sold").reduce((s, x) => s + Number(x.price_paid || 0), 0);
    const m = memberships
      .filter((x) => x.status === "paid" || x.status === "approved")
      .reduce((s, x) => s + Number(x.amount || 0), 0);
    return o + t + m;
  }, [orders, tickets, memberships]);

  async function finalize(orderId: string) {
    try {
      setRetrying(orderId);
      const res: any = await retry({ data: { order_id: orderId } });
      if (res?.checkout_url) window.location.href = res.checkout_url;
      else if (res?.init_point) window.location.href = res.init_point;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar checkout");
      setRetrying(null);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 opacity-60">
        <Loader2 className="size-8 animate-spin mx-auto" />
      </div>
    );
  }

  const empty = orders.length === 0 && tickets.length === 0 && memberships.length === 0;

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-5">
        <div className="text-[10px] uppercase tracking-widest font-black opacity-70">Total investido na atlética</div>
        <div className="text-3xl font-black mt-1">R$ {totalSpent.toFixed(2)}</div>
        <div className="text-xs opacity-60 mt-1">Somando produtos, ingressos e associações pagas</div>
      </div>

      {empty && (
        <div className="text-center py-16 opacity-60">
          <Receipt className="size-12 mx-auto opacity-40 mb-3" />
          <p className="font-bold">Você ainda não fez compras aqui.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div>
          <h3 className="font-black text-lg mb-3 flex items-center gap-2">
            <ShoppingBag className="size-4" /> Produtos ({orders.length})
          </h3>
          <div className="space-y-3">
            {orders.map((o) => {
              const items: any[] = o.athletic_product_order_items ?? [];
              const firstImage = items.find((i) => i?.athletic_products?.images?.[0])?.athletic_products?.images?.[0];
              const isPending = o.status === "pending";
              return (
                <Card key={o.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="size-16 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
                        {firstImage ? (
                          <img src={firstImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="size-6 opacity-40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">Pedido #{o.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-xs opacity-60">{new Date(o.created_at).toLocaleString("pt-BR")}</div>
                        <div className="text-[11px] opacity-80 mt-1 line-clamp-2">
                          {items.map((it) => `${it.title} × ${it.quantity}`).join(" · ") || "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black">R$ {Number(o.total).toFixed(2)}</div>
                        <Badge variant={o.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                          {o.status}
                        </Badge>
                      </div>
                    </div>
                    {items.length > 0 && o.status === "paid" && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {items.map((it) => (
                          <span
                            key={it.id}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${it.delivery_status === "delivered" ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-yellow-400/40 bg-yellow-500/10 text-yellow-200"}`}
                          >
                            {it.title} — {it.delivery_status === "delivered" ? "entregue" : "aguardando entrega"}
                          </span>
                        ))}
                      </div>
                    )}
                    {isPending && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => finalize(o.id)}
                          disabled={retrying === o.id}
                          style={{ background: athletic.primary_color }}
                        >
                          {retrying === o.id ? (
                            <Loader2 className="size-3.5 animate-spin mr-1" />
                          ) : (
                            <CreditCard className="size-3.5 mr-1" />
                          )}
                          Finalizar compra
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tickets.length > 0 && (
        <div>
          <h3 className="font-black text-lg mb-3 flex items-center gap-2">
            <Ticket className="size-4" /> Ingressos ({tickets.length})
          </h3>
          <div className="space-y-2">
            {tickets.map((t) => (
              <Card key={t.id} className="bg-white/5 border-white/10 text-white">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="size-14 rounded-lg bg-black/40 overflow-hidden shrink-0">
                    {t.athletic_events?.image_url ? (
                      <img src={t.athletic_events.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Ticket className="size-5 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{t.athletic_events?.title ?? "Evento"}</div>
                    <div className="text-xs opacity-60">
                      Código {t.code} • {t.sold_at ? new Date(t.sold_at).toLocaleDateString("pt-BR") : "—"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black">R$ {Number(t.price_paid || 0).toFixed(2)}</div>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {memberships.length > 0 && (
        <div>
          <h3 className="font-black text-lg mb-3 flex items-center gap-2">
            <IdCard className="size-4" /> Associações ({memberships.length})
          </h3>
          <div className="space-y-2">
            {memberships.map((m) => (
              <Card key={m.id} className="bg-white/5 border-white/10 text-white">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm">Associação • {m.method ?? "—"}</div>
                    <div className="text-xs opacity-60">{new Date(m.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black">R$ {Number(m.amount).toFixed(2)}</div>
                    <Badge
                      variant={m.status === "paid" || m.status === "approved" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {m.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
