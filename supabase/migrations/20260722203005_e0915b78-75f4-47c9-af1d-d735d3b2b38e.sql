ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'home';
CREATE INDEX IF NOT EXISTS ads_placement_idx ON public.ads(placement);