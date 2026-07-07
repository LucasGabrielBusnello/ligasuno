ALTER TABLE public.athletic_products
  ADD COLUMN IF NOT EXISTS sales_deadline timestamptz;