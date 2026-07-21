-- Cash entry receipts + site visit tracking

ALTER TABLE public.athletic_cash_entries
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

CREATE TABLE IF NOT EXISTS public.site_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.site_visits TO anon, authenticated;
GRANT ALL ON public.site_visits TO service_role;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone inserts site visits" ON public.site_visits;
CREATE POLICY "anyone inserts site visits" ON public.site_visits
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin master reads visits" ON public.site_visits;
CREATE POLICY "admin master reads visits" ON public.site_visits
  FOR SELECT TO authenticated USING (public.is_admin_master(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON public.site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_visitor ON public.site_visits (visitor_id, created_at DESC);
