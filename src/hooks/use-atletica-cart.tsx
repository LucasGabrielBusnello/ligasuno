import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  product_id: string;
  title: string;
  cover?: string | null;
  unit_price: number;      // preço unitário já com preço-sócio/desconto geral
  list_price: number;      // preço "de" (para riscar)
  second_item_discount_pct?: number;
  quantity: number;
  max_stock?: number | null;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  total: number;
  savings: number;
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  updateQty: (product_id: string, qty: number) => void;
  removeItem: (product_id: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "aaamd-cart-v1";

export function AtleticaCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items, ready]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.product_id === item.product_id);
      if (idx >= 0) {
        const copy = [...prev];
        const cur = copy[idx];
        const max = cur.max_stock ?? 20;
        copy[idx] = { ...cur, quantity: Math.min(max, cur.quantity + qty) };
        return copy;
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);
  const updateQty = useCallback((product_id: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((p) => (p.product_id === product_id ? { ...p, quantity: Math.max(0, Math.min(p.max_stock ?? 20, qty)) } : p))
        .filter((p) => p.quantity > 0),
    );
  }, []);
  const removeItem = useCallback((product_id: string) => {
    setItems((prev) => prev.filter((p) => p.product_id !== product_id));
  }, []);
  const clear = useCallback(() => setItems([]), []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let total = 0;
    let listTotal = 0;
    for (const it of items) {
      listTotal += it.list_price * it.quantity;
      const rawLine = it.unit_price * it.quantity;
      subtotal += rawLine;
      let lineTotal = rawLine;
      if (it.quantity >= 2 && (it.second_item_discount_pct ?? 0) > 0) {
        const extras = it.quantity - 1;
        lineTotal -= it.unit_price * extras * ((it.second_item_discount_pct ?? 0) / 100);
      }
      total += lineTotal;
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      savings: Math.round((listTotal - total) * 100) / 100,
    };
  }, [items]);

  const count = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <Ctx.Provider value={{ items, count, ...totals, addItem, updateQty, removeItem, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAtleticaCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAtleticaCart must be used inside <AtleticaCartProvider>");
  return ctx;
}
