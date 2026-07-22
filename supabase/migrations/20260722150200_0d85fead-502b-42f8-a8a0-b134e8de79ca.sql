
DROP POLICY IF EXISTS "lsr_update_owner_pending" ON public.league_score_requests;
CREATE POLICY "lsr_update_owner_pending" ON public.league_score_requests FOR UPDATE TO authenticated
USING (
  status = 'pending' AND (
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_score_requests.league_id AND m.user_id = auth.uid() AND m.role IN ('diretor','presidente'))
  )
)
WITH CHECK (
  status = 'pending' AND (
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_score_requests.league_id AND m.user_id = auth.uid() AND m.role IN ('diretor','presidente'))
  )
);
