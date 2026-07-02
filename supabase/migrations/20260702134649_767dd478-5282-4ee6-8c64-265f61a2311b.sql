
CREATE TABLE public.league_cash_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('entrada','saida')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL DEFAULT 'outro',
  description TEXT NOT NULL,
  notes TEXT,
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_cash_entries TO authenticated;
GRANT ALL ON public.league_cash_entries TO service_role;

ALTER TABLE public.league_cash_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view cash entries"
  ON public.league_cash_entries FOR SELECT
  TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_cash_entries.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
  );

CREATE POLICY "Managers can insert cash entries"
  ON public.league_cash_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_cash_entries.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
  );

CREATE POLICY "Managers can update cash entries"
  ON public.league_cash_entries FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_cash_entries.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
  );

CREATE POLICY "Managers can delete cash entries"
  ON public.league_cash_entries FOR DELETE
  TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_cash_entries.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
  );

CREATE TRIGGER update_league_cash_entries_updated_at
  BEFORE UPDATE ON public.league_cash_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_league_cash_entries_league_date ON public.league_cash_entries(league_id, occurred_at DESC);
