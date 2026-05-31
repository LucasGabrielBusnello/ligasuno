
-- Restrict public SELECT policies to authenticated users to prevent anonymous data exposure

-- profiles: drop public select, add authenticated select. Provide a SECURITY DEFINER
-- function so the signup flow (anon) can still check username availability without
-- exposing emails/phones.
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_username));
$$;
REVOKE EXECUTE ON FUNCTION public.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- league_memberships: only authenticated users can read role assignments
DROP POLICY IF EXISTS memberships_select_all ON public.league_memberships;
CREATE POLICY memberships_select_authenticated ON public.league_memberships
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.league_memberships FROM anon;

-- league_quiz_sets: only authenticated users; private sets only to members/admins
DROP POLICY IF EXISTS qs_select ON public.league_quiz_sets;
CREATE POLICY qs_select_authenticated ON public.league_quiz_sets
  FOR SELECT TO authenticated USING (
    COALESCE(is_private, false) = false
    OR is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_quiz_sets.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_quiz_sets.league_id AND m.user_id = auth.uid())
  );
REVOKE SELECT ON public.league_quiz_sets FROM anon;

-- league_quizzes: only authenticated users can see questions (and correct_answer)
DROP POLICY IF EXISTS qz_select ON public.league_quizzes;
CREATE POLICY qz_select_authenticated ON public.league_quizzes
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.league_quizzes FROM anon;

-- Lock down SECURITY DEFINER helper functions: only authenticated users need them
REVOKE EXECUTE ON FUNCTION public.is_admin_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_master(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_camed_president(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_camed_president(uuid) TO authenticated, service_role;
