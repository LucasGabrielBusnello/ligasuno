
-- 1. term dates
ALTER TABLE public.academic_terms
  ADD COLUMN IF NOT EXISTS term_start_date date,
  ADD COLUMN IF NOT EXISTS term_end_date date;

-- 2. subdivisions per class
CREATE TABLE IF NOT EXISTS public.class_subdivisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code text NOT NULL,
  letter text NOT NULL,
  morning_start time,
  morning_end time,
  afternoon_start time,
  afternoon_end time,
  night_start time,
  night_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_code, letter)
);

GRANT SELECT ON public.class_subdivisions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.class_subdivisions TO authenticated;
GRANT ALL ON public.class_subdivisions TO service_role;

ALTER TABLE public.class_subdivisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_subdivisions read all"
  ON public.class_subdivisions FOR SELECT
  USING (true);

CREATE POLICY "class_subdivisions coord write"
  ON public.class_subdivisions FOR ALL
  TO authenticated
  USING (public.is_coordination(auth.uid()))
  WITH CHECK (public.is_coordination(auth.uid()));

CREATE TRIGGER trg_class_subdivisions_updated
  BEFORE UPDATE ON public.class_subdivisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed subdivision A for the 6 ATM classes
INSERT INTO public.class_subdivisions (class_code, letter)
SELECT c, 'A' FROM (VALUES ('ATM26'),('ATM27'),('ATM28'),('ATM29'),('ATM30'),('ATM31')) AS t(c)
ON CONFLICT DO NOTHING;

-- 3. allow subdivision '*' as "all" marker (schedule_entries.subdivision already text, no constraint change needed)
COMMENT ON COLUMN public.schedule_entries.subdivision IS 'A/B/C... ou * para todas as turmas';
