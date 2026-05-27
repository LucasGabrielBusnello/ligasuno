
-- Extend league_events
ALTER TABLE public.league_events
  ADD COLUMN IF NOT EXISTS price_ligante NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_partner NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_visitor NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_league_ids UUID[] NOT NULL DEFAULT '{}';

-- event_registrations
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.league_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  social_name TEXT,
  cpf TEXT NOT NULL,
  course TEXT NOT NULL,
  base_price NUMERIC NOT NULL DEFAULT 0,
  paid_price NUMERIC NOT NULL DEFAULT 0,
  discount_reason TEXT,
  category TEXT NOT NULL DEFAULT 'visitor',
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reg_select_own_or_president" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_events e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = event_registrations.event_id AND l.president_id = auth.uid()
    )
  );

CREATE POLICY "reg_insert_own" ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reg_update_own_or_president" ON public.event_registrations
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_events e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = event_registrations.event_id AND l.president_id = auth.uid()
    )
  );

-- Allow directors to manage content
DROP POLICY IF EXISTS "news_manage" ON public.league_news;
CREATE POLICY "news_manage" ON public.league_news FOR ALL TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_news.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_news.league_id AND m.user_id = auth.uid() AND m.role = 'diretor')
  )
  WITH CHECK (
    is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_news.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_news.league_id AND m.user_id = auth.uid() AND m.role = 'diretor')
  );

DROP POLICY IF EXISTS "act_manage" ON public.league_activities;
CREATE POLICY "act_manage" ON public.league_activities FOR ALL TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_activities.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_activities.league_id AND m.user_id = auth.uid() AND m.role = 'diretor')
  )
  WITH CHECK (
    is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_activities.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_activities.league_id AND m.user_id = auth.uid() AND m.role = 'diretor')
  );

DROP POLICY IF EXISTS "qs_manage" ON public.league_quiz_sets;
CREATE POLICY "qs_manage" ON public.league_quiz_sets FOR ALL TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_quiz_sets.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_quiz_sets.league_id AND m.user_id = auth.uid() AND m.role = 'diretor')
  )
  WITH CHECK (
    is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_quiz_sets.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_quiz_sets.league_id AND m.user_id = auth.uid() AND m.role = 'diretor')
  );

DROP POLICY IF EXISTS "qz_manage" ON public.league_quizzes;
CREATE POLICY "qz_manage" ON public.league_quizzes FOR ALL TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_quiz_sets s
      JOIN public.leagues l ON l.id = s.league_id
      WHERE s.id = league_quizzes.quiz_set_id
        AND (l.president_id = auth.uid() OR is_admin_master(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.league_quiz_sets s
      JOIN public.league_memberships m ON m.league_id = s.league_id
      WHERE s.id = league_quizzes.quiz_set_id
        AND m.user_id = auth.uid() AND m.role = 'diretor'
    )
  )
  WITH CHECK (
    is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_quiz_sets s
      JOIN public.leagues l ON l.id = s.league_id
      WHERE s.id = league_quizzes.quiz_set_id
        AND (l.president_id = auth.uid() OR is_admin_master(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.league_quiz_sets s
      JOIN public.league_memberships m ON m.league_id = s.league_id
      WHERE s.id = league_quizzes.quiz_set_id
        AND m.user_id = auth.uid() AND m.role = 'diretor'
    )
  );

-- updated_at trigger for event_registrations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_event_reg_updated ON public.event_registrations;
CREATE TRIGGER trg_event_reg_updated BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
