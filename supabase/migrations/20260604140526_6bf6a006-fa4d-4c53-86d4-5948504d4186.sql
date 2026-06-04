
-- 1. Exams (one per league)
CREATE TABLE public.league_selection_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL UNIQUE,
  time_limit_minutes integer NOT NULL DEFAULT 30,
  shuffle boolean NOT NULL DEFAULT true,
  send_answers_email boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  reentry_code text NOT NULL DEFAULT lpad((floor(random()*10000))::int::text, 4, '0'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_selection_exams TO authenticated;
GRANT ALL ON public.league_selection_exams TO service_role;
ALTER TABLE public.league_selection_exams ENABLE ROW LEVEL SECURITY;
-- President/admin can manage. Inscritos podem ler apenas (published, time_limit) — código nunca exposto via RLS porque a leitura é só via server function admin.
CREATE POLICY exams_manage ON public.league_selection_exams
  FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid()))
  WITH CHECK (is_admin_master(auth.uid()) OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid()));
CREATE POLICY exams_select_inscrito ON public.league_selection_exams
  FOR SELECT TO authenticated
  USING (
    published = true
    AND EXISTS (
      SELECT 1 FROM public.league_selection_registrations r
      WHERE r.league_id = league_selection_exams.league_id
        AND r.user_id = auth.uid()
        AND r.status = 'paid'
    )
  );

-- 2. Exam questions
CREATE TABLE public.league_selection_exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.league_selection_exams(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer integer NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX league_selection_exam_questions_exam_idx ON public.league_selection_exam_questions(exam_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_selection_exam_questions TO authenticated;
GRANT ALL ON public.league_selection_exam_questions TO service_role;
ALTER TABLE public.league_selection_exam_questions ENABLE ROW LEVEL SECURITY;
-- Only the president/admin can read questions directly. Inscritos receive sanitized questions via server function (which uses service_role).
CREATE POLICY exam_questions_manage ON public.league_selection_exam_questions
  FOR ALL TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_selection_exams e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = exam_id AND l.president_id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_selection_exams e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = exam_id AND l.president_id = auth.uid()
    )
  );

-- 3. Attempts (one per registration)
CREATE TABLE public.league_selection_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.league_selection_exams(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  question_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  option_orders jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  paused_at timestamptz,
  time_used_ms bigint NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  score integer,
  total integer,
  delivery_position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX league_selection_exam_attempts_exam_idx ON public.league_selection_exam_attempts(exam_id);
CREATE INDEX league_selection_exam_attempts_user_idx ON public.league_selection_exam_attempts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_selection_exam_attempts TO authenticated;
GRANT ALL ON public.league_selection_exam_attempts TO service_role;
ALTER TABLE public.league_selection_exam_attempts ENABLE ROW LEVEL SECURITY;
-- Own user can see/update its row; president/admin can see (writes via server).
CREATE POLICY exam_attempts_select ON public.league_selection_exam_attempts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_selection_exams e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = exam_id AND l.president_id = auth.uid()
    )
  );
CREATE POLICY exam_attempts_insert_own ON public.league_selection_exam_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY exam_attempts_update_own ON public.league_selection_exam_attempts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON public.league_selection_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_exam_attempts_updated BEFORE UPDATE ON public.league_selection_exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
