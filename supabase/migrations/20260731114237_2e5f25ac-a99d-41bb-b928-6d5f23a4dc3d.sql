CREATE POLICY "act_camed_manage" ON public.league_activities
FOR ALL TO authenticated
USING (public.has_camed_panel_tab(auth.uid(), 'ligas'))
WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'ligas'));