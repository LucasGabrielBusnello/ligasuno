CREATE TABLE public.league_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  points integer NOT NULL,
  description text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_points TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_points TO authenticated;
GRANT ALL ON public.league_points TO service_role;
ALTER TABLE public.league_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp_select_all" ON public.league_points FOR SELECT USING (true);
CREATE POLICY "lp_camed_insert" ON public.league_points FOR INSERT TO authenticated
  WITH CHECK (public.is_camed_president(auth.uid()) OR public.is_admin_master(auth.uid()));
CREATE POLICY "lp_camed_delete" ON public.league_points FOR DELETE TO authenticated
  USING (public.is_camed_president(auth.uid()) OR public.is_admin_master(auth.uid()));
CREATE INDEX league_points_league_id_idx ON public.league_points(league_id);