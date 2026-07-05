
-- 1) Grant anon/authenticated on camed public-read tables
GRANT SELECT ON public.camed_info TO anon, authenticated;
GRANT SELECT ON public.camed_members TO anon, authenticated;
GRANT SELECT ON public.camed_news TO anon, authenticated;

-- 2) Product stock warning opt-in fields
ALTER TABLE public.athletic_products
  ADD COLUMN IF NOT EXISTS show_stock_warning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_warning_threshold integer;
