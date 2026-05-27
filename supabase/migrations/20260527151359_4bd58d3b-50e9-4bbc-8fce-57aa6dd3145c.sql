
-- NEWS
CREATE TABLE public.league_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  title text NOT NULL,
  excerpt text,
  image_url text,
  category text DEFAULT 'Geral',
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_news TO authenticated;
GRANT ALL ON public.league_news TO service_role;
ALTER TABLE public.league_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_select ON public.league_news FOR SELECT USING (true);
CREATE POLICY news_manage ON public.league_news FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid()))
  WITH CHECK (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid()));

-- ACTIVITIES
CREATE TABLE public.league_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_activities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_activities TO authenticated;
GRANT ALL ON public.league_activities TO service_role;
ALTER TABLE public.league_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY act_select ON public.league_activities FOR SELECT USING (true);
CREATE POLICY act_manage ON public.league_activities FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid()))
  WITH CHECK (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid()));

-- QUIZ SETS
CREATE TABLE public.league_quiz_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_quiz_sets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_quiz_sets TO authenticated;
GRANT ALL ON public.league_quiz_sets TO service_role;
ALTER TABLE public.league_quiz_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY qs_select ON public.league_quiz_sets FOR SELECT USING (true);
CREATE POLICY qs_manage ON public.league_quiz_sets FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid()))
  WITH CHECK (is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid()));

-- QUIZZES
CREATE TABLE public.league_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_set_id uuid NOT NULL REFERENCES public.league_quiz_sets(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_answer int NOT NULL,
  explanation text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_quizzes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_quizzes TO authenticated;
GRANT ALL ON public.league_quizzes TO service_role;
ALTER TABLE public.league_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY qz_select ON public.league_quizzes FOR SELECT USING (true);
CREATE POLICY qz_manage ON public.league_quizzes FOR ALL TO authenticated
  USING (is_admin_master(auth.uid()) OR EXISTS(
    SELECT 1 FROM league_quiz_sets s JOIN leagues l ON l.id=s.league_id
    WHERE s.id=quiz_set_id AND (l.president_id=auth.uid() OR is_admin_master(auth.uid()))
  ))
  WITH CHECK (is_admin_master(auth.uid()) OR EXISTS(
    SELECT 1 FROM league_quiz_sets s JOIN leagues l ON l.id=s.league_id
    WHERE s.id=quiz_set_id AND (l.president_id=auth.uid() OR is_admin_master(auth.uid()))
  ));

-- QUIZ ANSWERS
CREATE TABLE public.league_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_id uuid NOT NULL REFERENCES public.league_quizzes(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL,
  selected int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_quiz_answers TO authenticated;
GRANT ALL ON public.league_quiz_answers TO service_role;
ALTER TABLE public.league_quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_select_own ON public.league_quiz_answers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY qa_insert_own ON public.league_quiz_answers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY qa_update_own ON public.league_quiz_answers FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ATTENDANCE (registro de presença)
CREATE TABLE public.league_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  activity text NOT NULL,
  activity_date date NOT NULL,
  user_id uuid NOT NULL,
  present boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, activity, activity_date, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_attendance TO authenticated;
GRANT ALL ON public.league_attendance TO service_role;
ALTER TABLE public.league_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY att_select ON public.league_attendance FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR is_admin_master(auth.uid()) OR EXISTS(
    SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid()
  ) OR EXISTS(
    SELECT 1 FROM league_memberships m WHERE m.league_id=league_attendance.league_id AND m.user_id=auth.uid() AND m.role='diretor'
  )
);
CREATE POLICY att_manage ON public.league_attendance FOR ALL TO authenticated USING (
  is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid())
  OR EXISTS(SELECT 1 FROM league_memberships m WHERE m.league_id=league_attendance.league_id AND m.user_id=auth.uid() AND m.role='diretor')
) WITH CHECK (
  is_admin_master(auth.uid()) OR EXISTS(SELECT 1 FROM leagues l WHERE l.id=league_id AND l.president_id=auth.uid())
  OR EXISTS(SELECT 1 FROM league_memberships m WHERE m.league_id=league_attendance.league_id AND m.user_id=auth.uid() AND m.role='diretor')
);
