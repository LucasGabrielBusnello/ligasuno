
-- Extend subjects with new curriculum fields
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS class_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subdivisions text[] NOT NULL DEFAULT ARRAY['A']::text[],
  ADD COLUMN IF NOT EXISTS professor text,
  ADD COLUMN IF NOT EXISTS professor_contact text,
  ADD COLUMN IF NOT EXISTS workload_hours integer;

ALTER TABLE public.subjects ALTER COLUMN semester DROP NOT NULL;

-- Allow coordination staff / admin master to manage subjects
DROP POLICY IF EXISTS "subjects_coord_manage" ON public.subjects;
CREATE POLICY "subjects_coord_manage" ON public.subjects
  FOR ALL TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.coordination_staff cs
               JOIN public.profiles p ON lower(p.email) = lower(cs.email)
               WHERE p.id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.coordination_staff cs
               JOIN public.profiles p ON lower(p.email) = lower(cs.email)
               WHERE p.id = auth.uid())
  );

-- Academic terms
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_terms TO authenticated;
GRANT ALL ON public.academic_terms TO service_role;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academic_terms_read" ON public.academic_terms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "academic_terms_coord_manage" ON public.academic_terms
  FOR ALL TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.coordination_staff cs
               JOIN public.profiles p ON lower(p.email) = lower(cs.email)
               WHERE p.id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.coordination_staff cs
               JOIN public.profiles p ON lower(p.email) = lower(cs.email)
               WHERE p.id = auth.uid())
  );

CREATE TRIGGER update_academic_terms_updated_at
  BEFORE UPDATE ON public.academic_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one is_current
CREATE UNIQUE INDEX IF NOT EXISTS academic_terms_only_one_current
  ON public.academic_terms ((is_current)) WHERE is_current = true;

-- Personal schedule items
CREATE TABLE IF NOT EXISTS public.personal_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  date date NOT NULL,
  start_time time,
  end_time time,
  color text NOT NULL DEFAULT '#22c55e',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_schedule_items TO authenticated;
GRANT ALL ON public.personal_schedule_items TO service_role;
ALTER TABLE public.personal_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_items_own" ON public.personal_schedule_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS personal_items_user_date_idx
  ON public.personal_schedule_items (user_id, date);

CREATE TRIGGER update_personal_items_updated_at
  BEFORE UPDATE ON public.personal_schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
