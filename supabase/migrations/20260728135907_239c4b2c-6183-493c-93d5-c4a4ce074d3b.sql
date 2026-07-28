ALTER TABLE public.athletic_assets ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.athletics ADD COLUMN IF NOT EXISTS band_image_url text;
ALTER TABLE public.athletics ADD COLUMN IF NOT EXISTS band_whatsapp_url text;
ALTER TABLE public.athletics ADD COLUMN IF NOT EXISTS band_description text;

CREATE TABLE IF NOT EXISTS public.athletic_social_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id uuid NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  whatsapp_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.athletic_social_actions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_social_actions TO authenticated;
GRANT ALL ON public.athletic_social_actions TO service_role;
ALTER TABLE public.athletic_social_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social actions public read" ON public.athletic_social_actions FOR SELECT USING (true);
CREATE POLICY "social actions director manage" ON public.athletic_social_actions FOR ALL TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TABLE IF NOT EXISTS public.athletic_band_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id uuid NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.athletic_band_instruments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_band_instruments TO authenticated;
GRANT ALL ON public.athletic_band_instruments TO service_role;
ALTER TABLE public.athletic_band_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "band instruments public read" ON public.athletic_band_instruments FOR SELECT USING (true);
CREATE POLICY "band instruments director manage" ON public.athletic_band_instruments FOR ALL TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TRIGGER trg_social_actions_updated_at BEFORE UPDATE ON public.athletic_social_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_band_instruments_updated_at BEFORE UPDATE ON public.athletic_band_instruments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();