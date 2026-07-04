
-- 1) Grants para visitantes anônimos verem conteúdo público
GRANT SELECT ON public.athletics TO anon;
GRANT SELECT ON public.athletic_collections TO anon;
GRANT SELECT ON public.athletic_products TO anon;
GRANT SELECT ON public.athletic_events TO anon;

-- 2) Tabela de esportes
CREATE TABLE public.athletic_sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id uuid NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  coach text,
  schedule text,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.athletic_sports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_sports TO authenticated;
GRANT ALL ON public.athletic_sports TO service_role;

ALTER TABLE public.athletic_sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY athletic_sports_public_read ON public.athletic_sports
  FOR SELECT USING (active = true);

CREATE POLICY athletic_sports_director_write ON public.athletic_sports
  FOR ALL USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TRIGGER trg_athletic_sports_updated
  BEFORE UPDATE ON public.athletic_sports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
