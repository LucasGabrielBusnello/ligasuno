
-- ============ ATLÉTICA (AAAMD Desbravadores) ============

-- Enum de cargos na atlética
DO $$ BEGIN
  CREATE TYPE public.athletic_role AS ENUM ('socio','diretor','presidente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.athletic_ticket_status AS ENUM ('available','sold','used','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.athletic_order_status AS ENUM ('pending','paid','cancelled','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.athletic_cash_category AS ENUM ('product','event_online','event_manual','membership','manual','withdraw');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Atlética (singleton por enquanto, mas com slug para expansão futura)
CREATE TABLE public.athletics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#F97316',
  secondary_color TEXT NOT NULL DEFAULT '#16A34A',
  president_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  membership_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  membership_period_days INT NOT NULL DEFAULT 180,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.athletics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletics TO authenticated;
GRANT ALL ON public.athletics TO service_role;
ALTER TABLE public.athletics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletics_public_read" ON public.athletics FOR SELECT USING (published = true);
CREATE POLICY "athletics_admin_master" ON public.athletics FOR ALL
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE POLICY "athletics_president_update" ON public.athletics FOR UPDATE
  USING (president_id = auth.uid()) WITH CHECK (president_id = auth.uid());

-- 2) Sócios / Diretoria
CREATE TABLE public.athletic_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  matricula TEXT,
  semestre TEXT,
  role public.athletic_role NOT NULL DEFAULT 'socio',
  member_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  added_manually BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athletic_id, email)
);
CREATE INDEX ON public.athletic_memberships (athletic_id, user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_memberships TO authenticated;
GRANT ALL ON public.athletic_memberships TO service_role;
ALTER TABLE public.athletic_memberships ENABLE ROW LEVEL SECURITY;

-- Helper: é diretor/presidente da atlética?
CREATE OR REPLACE FUNCTION public.is_athletic_director(_user_id UUID, _athletic_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_master(_user_id)
    OR EXISTS (SELECT 1 FROM public.athletics WHERE id = _athletic_id AND president_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.athletic_memberships
      WHERE athletic_id = _athletic_id AND user_id = _user_id
        AND role IN ('diretor','presidente') AND active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_athletic_member(_user_id UUID, _athletic_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.athletic_memberships
    WHERE athletic_id = _athletic_id AND user_id = _user_id AND active = true
      AND (member_until IS NULL OR member_until >= CURRENT_DATE)
  );
$$;

CREATE POLICY "athletic_memberships_self_read" ON public.athletic_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.is_athletic_director(auth.uid(), athletic_id));
CREATE POLICY "athletic_memberships_director_write" ON public.athletic_memberships FOR ALL
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

-- 3) Coleções + produtos
CREATE TABLE public.athletic_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athletic_id, slug)
);
GRANT SELECT ON public.athletic_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_collections TO authenticated;
GRANT ALL ON public.athletic_collections TO service_role;
ALTER TABLE public.athletic_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_collections_public_read" ON public.athletic_collections FOR SELECT USING (active = true);
CREATE POLICY "athletic_collections_director_write" ON public.athletic_collections FOR ALL
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TABLE public.athletic_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.athletic_collections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  member_price NUMERIC(10,2),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  second_item_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  stock INT,
  is_highlight BOOLEAN NOT NULL DEFAULT false,
  is_new BOOLEAN NOT NULL DEFAULT false,
  badge_text TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.athletic_products (athletic_id, collection_id);
GRANT SELECT ON public.athletic_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_products TO authenticated;
GRANT ALL ON public.athletic_products TO service_role;
ALTER TABLE public.athletic_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_products_public_read" ON public.athletic_products FOR SELECT USING (active = true);
CREATE POLICY "athletic_products_director_write" ON public.athletic_products FOR ALL
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

-- 4) Pedidos de produtos online
CREATE TABLE public.athletic_product_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_cpf TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  discount_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status public.athletic_order_status NOT NULL DEFAULT 'pending',
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.athletic_product_orders (athletic_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_product_orders TO authenticated;
GRANT ALL ON public.athletic_product_orders TO service_role;
ALTER TABLE public.athletic_product_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_orders_own_read" ON public.athletic_product_orders FOR SELECT
  USING (user_id = auth.uid() OR public.is_athletic_director(auth.uid(), athletic_id));
CREATE POLICY "athletic_orders_insert_self" ON public.athletic_product_orders FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_athletic_director(auth.uid(), athletic_id));
CREATE POLICY "athletic_orders_director_update" ON public.athletic_product_orders FOR UPDATE
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TABLE public.athletic_product_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.athletic_product_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.athletic_products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  variant JSONB,
  line_total NUMERIC(10,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_product_order_items TO authenticated;
GRANT ALL ON public.athletic_product_order_items TO service_role;
ALTER TABLE public.athletic_product_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_order_items_read" ON public.athletic_product_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.athletic_product_orders o
    WHERE o.id = order_id
      AND (o.user_id = auth.uid() OR public.is_athletic_director(auth.uid(), o.athletic_id))
  ));
CREATE POLICY "athletic_order_items_write" ON public.athletic_product_order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.athletic_product_orders o
    WHERE o.id = order_id AND public.is_athletic_director(auth.uid(), o.athletic_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.athletic_product_orders o
    WHERE o.id = order_id AND public.is_athletic_director(auth.uid(), o.athletic_id)
  ));

-- 5) Eventos + ingressos físicos
CREATE TABLE public.athletic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  image_url TEXT,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  theme_color TEXT,
  price_member NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_visitor NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_tickets INT NOT NULL DEFAULT 0,
  tickets_sold INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  online_sales_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.athletic_events (athletic_id, starts_at);
GRANT SELECT ON public.athletic_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_events TO authenticated;
GRANT ALL ON public.athletic_events TO service_role;
ALTER TABLE public.athletic_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_events_public_read" ON public.athletic_events FOR SELECT USING (published = true);
CREATE POLICY "athletic_events_director_write" ON public.athletic_events FOR ALL
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TABLE public.athletic_event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.athletic_events(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  batch_id UUID,
  status public.athletic_ticket_status NOT NULL DEFAULT 'available',
  sold_channel TEXT,
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  buyer_cpf TEXT,
  price_paid NUMERIC(10,2),
  payment_methods JSONB,
  mp_payment_id TEXT,
  sold_at TIMESTAMPTZ,
  sold_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.athletic_event_tickets (event_id, status);
GRANT SELECT ON public.athletic_event_tickets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_event_tickets TO authenticated;
GRANT ALL ON public.athletic_event_tickets TO service_role;
ALTER TABLE public.athletic_event_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_tickets_own_read" ON public.athletic_event_tickets FOR SELECT
  USING (
    buyer_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.athletic_events e WHERE e.id = event_id
               AND public.is_athletic_director(auth.uid(), e.athletic_id))
  );
CREATE POLICY "athletic_tickets_director_write" ON public.athletic_event_tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.athletic_events e WHERE e.id = event_id
                 AND public.is_athletic_director(auth.uid(), e.athletic_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.athletic_events e WHERE e.id = event_id
                      AND public.is_athletic_director(auth.uid(), e.athletic_id)));

-- 6) Pagamentos de associação
CREATE TABLE public.athletic_membership_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.athletic_memberships(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  status public.athletic_order_status NOT NULL DEFAULT 'pending',
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  period_days INT NOT NULL DEFAULT 180,
  member_until DATE,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_cpf TEXT,
  matricula TEXT,
  semestre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_membership_payments TO authenticated;
GRANT ALL ON public.athletic_membership_payments TO service_role;
ALTER TABLE public.athletic_membership_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_memb_pay_self" ON public.athletic_membership_payments FOR SELECT
  USING (user_id = auth.uid() OR public.is_athletic_director(auth.uid(), athletic_id));
CREATE POLICY "athletic_memb_pay_insert" ON public.athletic_membership_payments FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_athletic_director(auth.uid(), athletic_id));
CREATE POLICY "athletic_memb_pay_update_director" ON public.athletic_membership_payments FOR UPDATE
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

-- 7) Caixa da atlética
CREATE TABLE public.athletic_cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  category public.athletic_cash_category NOT NULL,
  description TEXT NOT NULL,
  gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  mp_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_income BOOLEAN NOT NULL DEFAULT true,
  related_order_id UUID,
  related_ticket_id UUID,
  related_membership_payment_id UUID,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.athletic_cash_entries (athletic_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_cash_entries TO authenticated;
GRANT ALL ON public.athletic_cash_entries TO service_role;
ALTER TABLE public.athletic_cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_cash_director" ON public.athletic_cash_entries FOR ALL
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

-- 8) Conta Mercado Pago da atlética (mesma estrutura de league_mp_accounts)
CREATE TABLE public.athletic_mp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id UUID NOT NULL UNIQUE REFERENCES public.athletics(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  public_key TEXT,
  user_id TEXT,
  live_mode BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_mp_accounts TO authenticated;
GRANT ALL ON public.athletic_mp_accounts TO service_role;
ALTER TABLE public.athletic_mp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athletic_mp_director" ON public.athletic_mp_accounts FOR ALL
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

-- 9) Taxas da plataforma para atlética em app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS fee_atletica_event_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_atletica_event_fixed NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_atletica_product_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_atletica_product_fixed NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_atletica_membership_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_atletica_membership_fixed NUMERIC(10,2) DEFAULT 0;

-- 10) Triggers de updated_at
CREATE TRIGGER trg_athletics_updated BEFORE UPDATE ON public.athletics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_memberships_updated BEFORE UPDATE ON public.athletic_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_collections_updated BEFORE UPDATE ON public.athletic_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_products_updated BEFORE UPDATE ON public.athletic_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_orders_updated BEFORE UPDATE ON public.athletic_product_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_events_updated BEFORE UPDATE ON public.athletic_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_tickets_updated BEFORE UPDATE ON public.athletic_event_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_memb_pay_updated BEFORE UPDATE ON public.athletic_membership_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_cash_updated BEFORE UPDATE ON public.athletic_cash_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_athletic_mp_updated BEFORE UPDATE ON public.athletic_mp_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11) Seed inicial da AAAMD Desbravadores
INSERT INTO public.athletics (slug, name, short_name, description, primary_color, secondary_color, membership_price, membership_period_days)
VALUES (
  'aaamd-desbravadores',
  'AAAMD Desbravadores',
  'AAAMD',
  'Atlética Acadêmica de Medicina Desbravadores — Há 19 anos a maior do Oeste. Campeã Geral da Série B Intermed 2026.',
  '#F97316',
  '#16A34A',
  100.00,
  180
) ON CONFLICT (slug) DO NOTHING;
