-- Delivery status per order item
DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM ('pending','delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.athletic_product_order_items
  ADD COLUMN IF NOT EXISTS delivery_status public.delivery_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid;

CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.athletic_product_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.athletic_product_order_items(order_id);

-- Order source (site vs manual)
DO $$ BEGIN
  CREATE TYPE public.order_source AS ENUM ('site','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.athletic_product_orders
  ADD COLUMN IF NOT EXISTS source public.order_source NOT NULL DEFAULT 'site',
  ADD COLUMN IF NOT EXISTS buyer_registration text,
  ADD COLUMN IF NOT EXISTS buyer_semester int;

CREATE INDEX IF NOT EXISTS idx_orders_athletic_source ON public.athletic_product_orders(athletic_id, source);