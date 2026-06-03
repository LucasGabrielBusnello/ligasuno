-- Restrict camed_presidents SELECT (was public)
DROP POLICY IF EXISTS cp_select ON public.camed_presidents;
CREATE POLICY cp_select ON public.camed_presidents
  FOR SELECT TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- Restrict league_notifications SELECT (was public; contained names/CPFs)
DROP POLICY IF EXISTS notif_select ON public.league_notifications;
CREATE POLICY notif_select ON public.league_notifications
  FOR SELECT TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM leagues l
      WHERE l.id = league_notifications.league_id
        AND l.president_id = auth.uid()
    )
  );
