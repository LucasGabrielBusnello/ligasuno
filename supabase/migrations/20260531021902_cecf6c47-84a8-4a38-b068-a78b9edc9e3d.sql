CREATE TABLE public.league_minicourses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.league_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructor TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  location TEXT,
  is_free BOOLEAN NOT NULL DEFAULT true,
  price NUMERIC NOT NULL DEFAULT 0,
  max_registrations INTEGER NOT NULL DEFAULT 1,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT league_minicourses_price_check CHECK (price >= 0),
  CONSTRAINT league_minicourses_capacity_check CHECK (max_registrations > 0)
);
GRANT SELECT ON public.league_minicourses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_minicourses TO authenticated;
GRANT ALL ON public.league_minicourses TO service_role;
ALTER TABLE public.league_minicourses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minicourses_select" ON public.league_minicourses
  FOR SELECT
  USING (
    published = true
    OR is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.league_events e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = league_minicourses.event_id
        AND l.president_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.league_events e
      JOIN public.league_memberships m ON m.league_id = e.league_id
      WHERE e.id = league_minicourses.event_id
        AND m.user_id = auth.uid()
        AND m.role = 'diretor'
    )
  );
CREATE POLICY "minicourses_manage" ON public.league_minicourses
  FOR ALL TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.league_events e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = league_minicourses.event_id
        AND l.president_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.league_events e
      JOIN public.league_memberships m ON m.league_id = e.league_id
      WHERE e.id = league_minicourses.event_id
        AND m.user_id = auth.uid()
        AND m.role = 'diretor'
    )
  )
  WITH CHECK (
    is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.league_events e
      JOIN public.leagues l ON l.id = e.league_id
      WHERE e.id = league_minicourses.event_id
        AND l.president_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.league_events e
      JOIN public.league_memberships m ON m.league_id = e.league_id
      WHERE e.id = league_minicourses.event_id
        AND m.user_id = auth.uid()
        AND m.role = 'diretor'
    )
  );

CREATE TABLE public.minicourse_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minicourse_id UUID NOT NULL REFERENCES public.league_minicourses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  paid_price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(minicourse_id, user_id),
  CONSTRAINT minicourse_registrations_price_check CHECK (paid_price >= 0)
);
GRANT SELECT, INSERT, UPDATE ON public.minicourse_registrations TO authenticated;
GRANT ALL ON public.minicourse_registrations TO service_role;
ALTER TABLE public.minicourse_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minicourse_registrations_select" ON public.minicourse_registrations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.league_minicourses mc
      JOIN public.league_events e ON e.id = mc.event_id
      JOIN public.leagues l ON l.id = e.league_id
      WHERE mc.id = minicourse_registrations.minicourse_id
        AND l.president_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.league_minicourses mc
      JOIN public.league_events e ON e.id = mc.event_id
      JOIN public.league_memberships m ON m.league_id = e.league_id
      WHERE mc.id = minicourse_registrations.minicourse_id
        AND m.user_id = auth.uid()
        AND m.role = 'diretor'
    )
  );
CREATE POLICY "minicourse_registrations_insert" ON public.minicourse_registrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "minicourse_registrations_update" ON public.minicourse_registrations
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.league_minicourses mc
      JOIN public.league_events e ON e.id = mc.event_id
      JOIN public.leagues l ON l.id = e.league_id
      WHERE mc.id = minicourse_registrations.minicourse_id
        AND l.president_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.league_minicourses mc
      JOIN public.league_events e ON e.id = mc.event_id
      JOIN public.league_memberships m ON m.league_id = e.league_id
      WHERE mc.id = minicourse_registrations.minicourse_id
        AND m.user_id = auth.uid()
        AND m.role = 'diretor'
    )
  );

CREATE INDEX idx_league_minicourses_event_id ON public.league_minicourses(event_id);
CREATE INDEX idx_league_minicourses_starts_at ON public.league_minicourses(starts_at);
CREATE INDEX idx_minicourse_registrations_minicourse_id ON public.minicourse_registrations(minicourse_id);
CREATE INDEX idx_minicourse_registrations_user_id ON public.minicourse_registrations(user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_league_minicourses_updated ON public.league_minicourses;
CREATE TRIGGER trg_league_minicourses_updated
BEFORE UPDATE ON public.league_minicourses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_minicourse_registrations_updated ON public.minicourse_registrations;
CREATE TRIGGER trg_minicourse_registrations_updated
BEFORE UPDATE ON public.minicourse_registrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();