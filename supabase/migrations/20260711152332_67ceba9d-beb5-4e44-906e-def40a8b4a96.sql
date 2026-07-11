
-- 1) Add gender/capacity/enrollment fields to athletic_sports
ALTER TABLE public.athletic_sports
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'misto' CHECK (gender IN ('masculino','feminino','misto')),
  ADD COLUMN IF NOT EXISTS max_capacity integer,
  ADD COLUMN IF NOT EXISTS enrollment_open boolean NOT NULL DEFAULT true;

-- 2) Enrollments
CREATE TABLE IF NOT EXISTS public.athletic_sport_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL REFERENCES public.athletic_sports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sport_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.athletic_sport_enrollments TO authenticated;
GRANT ALL ON public.athletic_sport_enrollments TO service_role;

ALTER TABLE public.athletic_sport_enrollments ENABLE ROW LEVEL SECURITY;

-- Members of the athletic can see enrollments for its sports; directors see all
CREATE POLICY "view_enrollments_member_or_director" ON public.athletic_sport_enrollments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.athletic_sports s
      WHERE s.id = athletic_sport_enrollments.sport_id
        AND (
          public.is_athletic_member(auth.uid(), s.athletic_id)
          OR public.is_athletic_director(auth.uid(), s.athletic_id)
        )
    )
  );

-- Active members can enroll themselves
CREATE POLICY "enroll_self_if_member" ON public.athletic_sport_enrollments
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.athletic_sports s
      WHERE s.id = sport_id
        AND s.active = true
        AND s.enrollment_open = true
        AND public.is_athletic_member(auth.uid(), s.athletic_id)
    )
  );

-- User can leave their own enrollment; directors can remove anyone
CREATE POLICY "unenroll_self_or_director" ON public.athletic_sport_enrollments
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.athletic_sports s
      WHERE s.id = athletic_sport_enrollments.sport_id
        AND public.is_athletic_director(auth.uid(), s.athletic_id)
    )
  );

-- 3) Partners
CREATE TABLE IF NOT EXISTS public.athletic_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id uuid NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  discount_text text,
  link_url text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.athletic_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_partners TO authenticated;
GRANT ALL ON public.athletic_partners TO service_role;

ALTER TABLE public.athletic_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_public_read_active" ON public.athletic_partners
  FOR SELECT USING (active = true);

CREATE POLICY "partners_director_manage" ON public.athletic_partners
  FOR ALL TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TRIGGER trg_athletic_partners_updated
  BEFORE UPDATE ON public.athletic_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
