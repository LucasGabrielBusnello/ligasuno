-- Simulador clínico
CREATE TABLE public.sim_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  area text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 6),
  summary text,
  patient jsonb NOT NULL DEFAULT '{}'::jsonb,
  triage jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden_history text,
  findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  exams jsonb NOT NULL DEFAULT '[]'::jsonb,
  diagnosis text NOT NULL,
  expected_conduct text,
  patient_image_url text,
  published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_cases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_cases TO authenticated;
GRANT ALL ON public.sim_cases TO service_role;
ALTER TABLE public.sim_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_cases_read" ON public.sim_cases FOR SELECT USING (published = true OR public.is_admin_master(auth.uid()));
CREATE POLICY "sim_cases_admin" ON public.sim_cases FOR ALL TO authenticated USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_cases_updated BEFORE UPDATE ON public.sim_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sim_auscultation_sounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  region text NOT NULL,
  finding_key text NOT NULL,
  label text NOT NULL,
  description text,
  audio_url text,
  license text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_auscultation_sounds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_auscultation_sounds TO authenticated;
GRANT ALL ON public.sim_auscultation_sounds TO service_role;
ALTER TABLE public.sim_auscultation_sounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_sounds_read" ON public.sim_auscultation_sounds FOR SELECT USING (true);
CREATE POLICY "sim_sounds_admin" ON public.sim_auscultation_sounds FOR ALL TO authenticated USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_sounds_updated BEFORE UPDATE ON public.sim_auscultation_sounds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sim_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.sim_cases(id) ON DELETE CASCADE,
  level int,
  area text,
  status text NOT NULL DEFAULT 'active',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  exam_requests jsonb NOT NULL DEFAULT '[]'::jsonb,
  physical_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  anamnese text,
  hypothesis text,
  score int,
  review jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_sessions TO authenticated;
GRANT ALL ON public.sim_sessions TO service_role;
ALTER TABLE public.sim_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_sessions_own" ON public.sim_sessions FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin_master(auth.uid())) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER sim_sessions_updated BEFORE UPDATE ON public.sim_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sim_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sim_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('up','down')),
  comment text,
  ai_review jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_feedback TO authenticated;
GRANT ALL ON public.sim_feedback TO service_role;
ALTER TABLE public.sim_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_feedback_insert_own" ON public.sim_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sim_feedback_read" ON public.sim_feedback FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_master(auth.uid()));
CREATE POLICY "sim_feedback_admin" ON public.sim_feedback FOR ALL TO authenticated USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_feedback_updated BEFORE UPDATE ON public.sim_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sim_ai_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  source_feedback_id uuid REFERENCES public.sim_feedback(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_ai_rules TO authenticated;
GRANT ALL ON public.sim_ai_rules TO service_role;
ALTER TABLE public.sim_ai_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_rules_admin" ON public.sim_ai_rules FOR ALL TO authenticated USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_rules_updated BEFORE UPDATE ON public.sim_ai_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sim_cases_area_level ON public.sim_cases(area, level) WHERE published;
CREATE INDEX idx_sim_sessions_user ON public.sim_sessions(user_id, created_at DESC);