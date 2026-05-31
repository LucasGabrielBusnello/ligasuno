
-- ============ EVENTS / MINICOURSES — vagas ============
ALTER TABLE public.league_events ADD COLUMN IF NOT EXISTS max_seats integer;

-- ============ SELECTION PROCESS (prova) ============
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS selection_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selection_deadline date,
  ADD COLUMN IF NOT EXISTS selection_exam_date date,
  ADD COLUMN IF NOT EXISTS selection_exam_time time,
  ADD COLUMN IF NOT EXISTS selection_exam_description text,
  ADD COLUMN IF NOT EXISTS selection_total_seats integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.league_selection_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  semester integer NOT NULL CHECK (semester IN (1,3,5,7,9,11)),
  seats integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, semester)
);
GRANT SELECT ON public.league_selection_quotas TO anon, authenticated;
GRANT ALL ON public.league_selection_quotas TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.league_selection_quotas TO authenticated;
ALTER TABLE public.league_selection_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotas_select" ON public.league_selection_quotas FOR SELECT USING (true);
CREATE POLICY "quotas_manage" ON public.league_selection_quotas FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid()))
  WITH CHECK (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.league_selection_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  cpf text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  semester integer NOT NULL CHECK (semester IN (1,3,5,7,9,11)),
  paid_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  grade numeric,
  delivery_position integer,
  present boolean NOT NULL DEFAULT false,
  ranked_position integer,
  ranked_via text,
  ranked_semester integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS lsr_unique_position ON public.league_selection_registrations(league_id, delivery_position) WHERE delivery_position IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.league_selection_registrations TO authenticated;
GRANT ALL ON public.league_selection_registrations TO service_role;
ALTER TABLE public.league_selection_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsr_insert_own" ON public.league_selection_registrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lsr_select" ON public.league_selection_registrations FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR is_admin_master(auth.uid())
  OR EXISTS(SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
);
CREATE POLICY "lsr_update" ON public.league_selection_registrations FOR UPDATE TO authenticated USING (
  user_id = auth.uid() OR is_admin_master(auth.uid())
  OR EXISTS(SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.league_selection_ranking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.league_selection_ranking_history TO authenticated;
GRANT ALL ON public.league_selection_ranking_history TO service_role;
ALTER TABLE public.league_selection_ranking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsrh_manage" ON public.league_selection_ranking_history FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid()))
  WITH CHECK (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid()));

-- ============ CAMED PRESIDENTS + SETTINGS ============
CREATE TABLE IF NOT EXISTS public.camed_presidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.camed_presidents TO anon, authenticated;
GRANT ALL ON public.camed_presidents TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.camed_presidents TO authenticated;
ALTER TABLE public.camed_presidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select" ON public.camed_presidents FOR SELECT USING (true);
CREATE POLICY "cp_admin" ON public.camed_presidents FOR ALL TO authenticated
  USING (is_admin_master(auth.uid())) WITH CHECK (is_admin_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_camed_president(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.camed_presidents cp
    JOIN public.profiles p ON lower(p.email) = lower(cp.email)
    WHERE p.id = _user_id
  )
$$;

CREATE TABLE IF NOT EXISTS public.camed_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  league_registration_fee numeric NOT NULL DEFAULT 0,
  semestrality_fee numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.camed_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.camed_settings TO anon, authenticated;
GRANT ALL ON public.camed_settings TO service_role;
GRANT UPDATE ON public.camed_settings TO authenticated;
ALTER TABLE public.camed_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_select" ON public.camed_settings FOR SELECT USING (true);
CREATE POLICY "cs_update" ON public.camed_settings FOR UPDATE TO authenticated
  USING (is_admin_master(auth.uid()) OR is_camed_president(auth.uid()));

-- Extend camed_members + camed_info policies to allow camed presidents
DROP POLICY IF EXISTS "camed_members_admin" ON public.camed_members;
CREATE POLICY "camed_members_manage" ON public.camed_members FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR is_camed_president(auth.uid()))
  WITH CHECK (is_admin_master(auth.uid()) OR is_camed_president(auth.uid()));

DROP POLICY IF EXISTS "camed_info_update_admin" ON public.camed_info;
CREATE POLICY "camed_info_update" ON public.camed_info FOR UPDATE TO authenticated
  USING (is_admin_master(auth.uid()) OR is_camed_president(auth.uid()));
