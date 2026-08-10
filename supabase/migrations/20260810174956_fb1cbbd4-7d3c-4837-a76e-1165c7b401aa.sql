CREATE OR REPLACE FUNCTION public.find_profile_for_league(_league_id uuid, _query text)
 RETURNS TABLE(id uuid, email text, username text, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.email, p.username, p.full_name
  FROM public.profiles p
  WHERE (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = _league_id AND (l.president_id = auth.uid() OR l.president2_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = _league_id AND m.user_id = auth.uid() AND m.role IN ('diretor','presidente'))
  )
  AND (
    lower(p.email) = lower(_query)
    OR lower(p.username) = lower(_query)
    OR p.email ILIKE '%' || _query || '%'
    OR p.username ILIKE '%' || _query || '%'
    OR p.full_name ILIKE '%' || _query || '%'
  )
  ORDER BY (lower(p.email) = lower(_query)) DESC, (lower(p.username) = lower(_query)) DESC
  LIMIT 8;
$function$;