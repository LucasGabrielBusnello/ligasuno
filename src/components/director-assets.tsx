import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import {
  Plus,
  Search,
  Package,
  Trash2,
  HandCoins,
  Undo2,
  Calendar as CalendarIcon,
  Hash,
} from "lucide-react";

type Asset = {
  id: string;
  athletic_id: string;
  name: string;
  description: string | null;
  code: string;
  category: string | null;
  acquisition_date: string | null;
  quantity: number;
  available_quantity: number;
};

type Loan = {
  id: string;
  asset_id: string;
  borrower_name: string;
  borrower_email: string | null;
  borrower_phone: string | null;
  return_date: string | null;
  returned_at: string | null;
  created_at: string;
};

function randomCode() {
  return "P-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function DirectorAssets({ athleticId }: { athleticId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editing, setEditing] = useState<Partial<Asset> | null>(null);
  const [loanFor, setLoanFor] = useState<Asset | null>(null);
  const [viewLoansFor, setViewLoansFor] = useState<Asset | null>(null);

  async function reload() {
    const [{ data: a }, { data: l }] = await Promise.all([
      (supabase as any)
        .from("athletic_assets")
        .select("*")
        .eq("athletic_id", athleticId)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("athletic_asset_loans")
        .select("*")
        .is("returned_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setAssets((a ?? []) as Asset[]);
    setLoans((l ?? []) as Loan[]);
  }

  useEffect(() => {
    reload();
  }, [athleticId]);

  const filtered = useMemo(() => {
  const categories = useMemo(
    () =>
      Array.from(new Set(assets.map((a) => (a.category ?? "").trim()).filter(Boolean))).sort(),
    [assets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (categoryFilter && (a.category ?? "") !== categoryFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [assets, query, categoryFilter]);

  const openLoansByAsset = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of loans) m.set(l.asset_id, (m.get(l.asset_id) ?? 0) + 1);
    return m;
  }, [loans]);

  async function saveAsset() {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (!name) return toast.error("Nome é obrigatório");
    const code = (editing.code ?? "").trim() || randomCode();
    const qty = Math.max(1, Number(editing.quantity ?? 1));
    const payload: any = {
      athletic_id: athleticId,
      name,
      description: editing.description ?? null,
      code,
      acquisition_date: editing.acquisition_date || null,
      quantity: qty,
    };
    if (!editing.id) payload.available_quantity = qty;
    try {
      if (editing.id) {
        const { error } = await (supabase as any)
          .from("athletic_assets")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("athletic_assets").insert(payload);
        if (error) throw error;
      }
      toast.success("Patrimônio salvo");
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  async function deleteAsset(a: Asset) {
    if (!confirm(`Excluir "${a.name}"?`)) return;
    const { error } = await (supabase as any).from("athletic_assets").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    reload();
  }

  async function createLoan(form: {
    borrower_name: string;
    borrower_email?: string;
    borrower_phone?: string;
    return_date?: string;
  }) {
    if (!loanFor) return;
    if (loanFor.available_quantity <= 0) return toast.error("Sem unidades disponíveis");
    const { error: e1 } = await (supabase as any).from("athletic_asset_loans").insert({
      asset_id: loanFor.id,
      borrower_name: form.borrower_name.trim(),
      borrower_email: form.borrower_email?.trim() || null,
      borrower_phone: form.borrower_phone?.trim() || null,
      return_date: form.return_date || null,
    });
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await (supabase as any)
      .from("athletic_assets")
      .update({ available_quantity: loanFor.available_quantity - 1 })
      .eq("id", loanFor.id);
    if (e2) return toast.error(e2.message);
    toast.success("Empréstimo registrado");
    setLoanFor(null);
    reload();
  }

  async function returnLoan(loan: Loan, asset: Asset) {
    const { error: e1 } = await (supabase as any)
      .from("athletic_asset_loans")
      .update({ returned_at: new Date().toISOString() })
      .eq("id", loan.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await (supabase as any)
      .from("athletic_assets")
      .update({ available_quantity: Math.min(asset.quantity, asset.available_quantity + 1) })
      .eq("id", asset.id);
    if (e2) return toast.error(e2.message);
    toast.success("Devolução registrada");
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div className="flex flex-1 gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
            <Input
              placeholder="Pesquisar por nome ou código"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c} className="text-black">
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() =>
            setEditing({ name: "", description: "", code: "", quantity: 1, acquisition_date: "" })
          }
          className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
        >
          <Plus className="size-4 mr-1.5" /> Novo patrimônio
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          <Package className="size-10 mx-auto mb-3 opacity-70" />
          Nenhum patrimônio {query ? "encontrado" : "cadastrado"}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const rented = a.available_quantity < a.quantity;
            const outOfStock = a.available_quantity === 0;
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 flex flex-col gap-3 transition-colors ${
                  outOfStock
                    ? "border-amber-500/40 bg-amber-500/10"
                    : rented
                      ? "border-orange-500/40 bg-orange-500/10"
                      : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-white text-lg leading-tight truncate">
                      {a.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/60 mt-1">
                      <Hash className="size-3" /> {a.code}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${
                      outOfStock
                        ? "text-amber-300 border-amber-400/40 bg-amber-500/10"
                        : rented
                          ? "text-orange-300 border-orange-400/40 bg-orange-500/10"
                          : "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
                    }`}
                  >
                    {outOfStock ? "Todos locados" : rented ? "Parcialmente locado" : "Disponível"}
                  </span>
                </div>
                {a.description && (
                  <p className="text-sm text-white/70 line-clamp-3">{a.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-white/70">
                  <span>
                    <b className="text-white">{a.available_quantity}</b> / {a.quantity} disponíveis
                  </span>
                  {a.acquisition_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="size-3" />
                      {new Date(a.acquisition_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {openLoansByAsset.get(a.id) ? (
                    <button
                      type="button"
                      className="underline text-orange-300 hover:text-orange-200"
                      onClick={() => setViewLoansFor(a)}
                    >
                      {openLoansByAsset.get(a.id)} empréstimo(s) em aberto
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-2 pt-1 mt-auto">
                  <Button
                    size="sm"
                    disabled={outOfStock}
                    onClick={() => setLoanFor(a)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white flex-1"
                  >
                    <HandCoins className="size-4 mr-1" /> Emprestar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => setEditing(a)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                    onClick={() => deleteAsset(a)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar patrimônio" : "Novo patrimônio"}</DialogTitle>
            <DialogDescription className="text-white/60">
              Registre itens do inventário da atlética.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de aquisição</Label>
                  <Input
                    type="date"
                    value={editing.acquisition_date ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, acquisition_date: e.target.value })
                    }
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label>Código {editing.id ? "" : "(opcional)"}</Label>
                  <Input
                    placeholder="Gerado automaticamente"
                    value={editing.code ?? ""}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  list="asset-categories"
                  placeholder="Selecione ou digite para criar nova"
                  value={editing.category ?? ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
                <datalist id="asset-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={editing.quantity ?? 1}
                  onChange={(e) =>
                    setEditing({ ...editing, quantity: Number(e.target.value) || 1 })
                  }
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={saveAsset}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan dialog */}
      <LoanDialog
        asset={loanFor}
        onClose={() => setLoanFor(null)}
        onSubmit={(v) => { void createLoan(v); }}
      />


      {/* Open loans dialog */}
      <Dialog open={!!viewLoansFor} onOpenChange={(o) => !o && setViewLoansFor(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Empréstimos em aberto</DialogTitle>
            <DialogDescription className="text-white/60">{viewLoansFor?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {loans
              .filter((l) => l.asset_id === viewLoansFor?.id)
              .map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-3 bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{l.borrower_name}</div>
                    <div className="text-xs text-white/60 truncate">
                      {l.borrower_phone ?? l.borrower_email ?? "—"}
                    </div>
                    {l.return_date && (
                      <div className="text-xs text-white/60 mt-0.5">
                        Devolução prevista:{" "}
                        {new Date(l.return_date).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => viewLoansFor && returnLoan(l, viewLoansFor)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Undo2 className="size-4 mr-1" /> Devolver
                  </Button>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoanDialog({
  asset,
  onClose,
  onSubmit,
}: {
  asset: Asset | null;
  onClose: () => void;
  onSubmit: (v: {
    borrower_name: string;
    borrower_email?: string;
    borrower_phone?: string;
    return_date?: string;
  }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (asset) {
      setName("");
      setEmail("");
      setPhone("");
      setDate("");
    }
  }, [asset]);

  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Emprestar patrimônio</DialogTitle>
          <DialogDescription className="text-white/60">{asset?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do responsável *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail (opcional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label>Telefone (opcional)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
          <div>
            <Label>Data de devolução (opcional)</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => {
              if (!name.trim()) return toast.error("Nome é obrigatório");
              onSubmit({
                borrower_name: name,
                borrower_email: email,
                borrower_phone: phone,
                return_date: date,
              });
            }}
          >
            Confirmar empréstimo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
