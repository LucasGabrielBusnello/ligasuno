
-- Fix infinite recursion in league_memberships SELECT policy by using a SECURITY DEFINER helper
CREATE OR REPLACE FUNCTION public.is_league_member(_user_id uuid, _league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_memberships
    WHERE league_id = _league_id AND user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS memberships_select_scoped ON public.league_memberships;

CREATE POLICY memberships_select_scoped ON public.league_memberships
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_admin_master(auth.uid())
  OR is_camed_president(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_memberships.league_id AND l.president_id = auth.uid()
  )
  OR public.is_league_member(auth.uid(), league_memberships.league_id)
);
