
CREATE OR REPLACE FUNCTION public.has_camed_panel_tab(_user_id uuid, _tab text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_master(_user_id)
      OR public.is_camed_president(_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.camed_panel_access a
        JOIN public.profiles p ON p.id = _user_id
        WHERE lower(a.email) = lower(coalesce(p.email, ''))
          AND _tab = ANY (a.permissions)
      );
$$;

DROP POLICY IF EXISTS lp_camed_insert ON public.league_points;
CREATE POLICY lp_camed_insert ON public.league_points
  FOR INSERT TO authenticated
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'ligas'));

DROP POLICY IF EXISTS lp_camed_delete ON public.league_points;
CREATE POLICY lp_camed_delete ON public.league_points
  FOR DELETE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'ligas'));

DROP POLICY IF EXISTS lp_camed_update ON public.league_points;
CREATE POLICY lp_camed_update ON public.league_points
  FOR UPDATE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'ligas'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'ligas'));

DROP POLICY IF EXISTS lsr_camed_review ON public.league_score_requests;
CREATE POLICY lsr_camed_review ON public.league_score_requests
  FOR UPDATE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'ligas'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'ligas'));

DROP POLICY IF EXISTS lsr_select ON public.league_score_requests;
CREATE POLICY lsr_select ON public.league_score_requests
  FOR SELECT TO authenticated
  USING (
    public.has_camed_panel_tab(auth.uid(), 'ligas')
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_score_requests.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_score_requests.league_id AND m.user_id = auth.uid() AND m.role = ANY (ARRAY['diretor'::app_role, 'presidente'::app_role]))
  );

ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS cta_label text;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_placement_check;
ALTER TABLE public.ads ADD CONSTRAINT ads_placement_check
  CHECK (placement IN ('home','ligas','logos','parceiros'));
