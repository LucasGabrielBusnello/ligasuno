
-- 1) profiles: aluno Unochapecó
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_unochapeco_student boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS current_semester integer;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_matricula_format_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_matricula_format_chk
  CHECK (matricula IS NULL OR matricula ~ '^[0-9]{9}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_current_semester_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_current_semester_chk
  CHECK (current_semester IS NULL OR (current_semester BETWEEN 1 AND 20));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_matricula_unique
  ON public.profiles (matricula) WHERE matricula IS NOT NULL;

-- 2) athletic_sports: grupo whatsapp
ALTER TABLE public.athletic_sports
  ADD COLUMN IF NOT EXISTS whatsapp_url text;

-- 3) events end_date
ALTER TABLE public.league_events
  ADD COLUMN IF NOT EXISTS end_date timestamptz;
ALTER TABLE public.athletic_events
  ADD COLUMN IF NOT EXISTS end_date timestamptz;

-- 4) images on questions
ALTER TABLE public.league_quizzes
  ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.league_selection_exam_questions
  ADD COLUMN IF NOT EXISTS image_url text;

-- 5) subjects & teachers
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  semester integer NOT NULL CHECK (semester BETWEEN 1 AND 20),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_read_public" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects_admin_write" ON public.subjects FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teachers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_read_public" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "teachers_admin_write" ON public.teachers FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER trg_teachers_updated BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.subject_teachers (
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, teacher_id)
);
GRANT SELECT ON public.subject_teachers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subject_teachers TO authenticated;
GRANT ALL ON public.subject_teachers TO service_role;
ALTER TABLE public.subject_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subject_teachers_read_public" ON public.subject_teachers FOR SELECT USING (true);
CREATE POLICY "subject_teachers_admin_write" ON public.subject_teachers FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));

-- 6) coordination_staff
CREATE TABLE IF NOT EXISTS public.coordination_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE, -- 'coordenador' | 'adjunta' | 'assistente' (livre)
  name text NOT NULL,
  title text NOT NULL,
  bio text,
  email text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coordination_staff TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coordination_staff TO authenticated;
GRANT ALL ON public.coordination_staff TO service_role;
ALTER TABLE public.coordination_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coord_read_public" ON public.coordination_staff FOR SELECT USING (true);
CREATE POLICY "coord_admin_write" ON public.coordination_staff FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER trg_coord_updated BEFORE UPDATE ON public.coordination_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) ads
CREATE TABLE IF NOT EXISTS public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text NOT NULL,
  redirect_url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_read_public" ON public.ads FOR SELECT USING (true);
CREATE POLICY "ads_admin_write" ON public.ads FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER trg_ads_updated BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) ad_analytics
CREATE TABLE IF NOT EXISTS public.ad_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL CHECK (action IN ('view','click')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_analytics_ad_action_idx ON public.ad_analytics (ad_id, action, created_at);
CREATE INDEX IF NOT EXISTS ad_analytics_user_idx ON public.ad_analytics (user_id);
GRANT INSERT ON public.ad_analytics TO anon, authenticated;
GRANT SELECT ON public.ad_analytics TO authenticated;
GRANT ALL ON public.ad_analytics TO service_role;
ALTER TABLE public.ad_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_analytics_insert_any" ON public.ad_analytics FOR INSERT
  WITH CHECK (true);
CREATE POLICY "ad_analytics_admin_read" ON public.ad_analytics FOR SELECT TO authenticated
  USING (public.is_admin_master(auth.uid()));

-- 9) advance semester function
CREATE OR REPLACE FUNCTION public.advance_semester()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin_master(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles
     SET current_semester = LEAST(COALESCE(current_semester, 0) + 1, 20),
         updated_at = now()
   WHERE is_unochapeco_student = true
     AND current_semester IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_semester() FROM public;
GRANT EXECUTE ON FUNCTION public.advance_semester() TO authenticated;
