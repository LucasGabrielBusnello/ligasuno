ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS president2_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $do$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_sql text;
  v_roles text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename <> 'athletics'
      AND (qual ILIKE '%president_id%' OR with_check ILIKE '%president_id%')
  LOOP
    v_qual := regexp_replace(coalesce(r.qual,''), '(([a-zA-Z_][a-zA-Z0-9_]*)\.)?president_id = auth\.uid\(\)', '(\1president_id = auth.uid() OR \1president2_id = auth.uid())', 'g');
    v_check := regexp_replace(coalesce(r.with_check,''), '(([a-zA-Z_][a-zA-Z0-9_]*)\.)?president_id = auth\.uid\(\)', '(\1president_id = auth.uid() OR \1president2_id = auth.uid())', 'g');
    v_roles := array_to_string(r.roles, ', ');

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    v_sql := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      r.policyname, r.tablename,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      r.cmd, v_roles);
    IF r.qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_qual);
    END IF;
    IF r.with_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION public.can_manage_league_cash(_user_id uuid, _league_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_master(_user_id)
    OR EXISTS (SELECT 1 FROM public.leagues WHERE id = _league_id AND (president_id = _user_id OR president2_id = _user_id))
    OR EXISTS (SELECT 1 FROM public.league_memberships WHERE league_id = _league_id AND user_id = _user_id AND role = 'diretor');
$function$;

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
  )
  ORDER BY (lower(p.email) = lower(_query)) DESC, (lower(p.username) = lower(_query)) DESC
  LIMIT 5;
$function$;

CREATE OR REPLACE FUNCTION public.manager_get_quizzes(_set_id uuid)
 RETURNS TABLE(id uuid, quiz_set_id uuid, question text, options jsonb, correct_answer integer, explanation text, display_order integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT q.id, q.quiz_set_id, q.question, q.options, q.correct_answer, q.explanation, q.display_order, q.created_at
  FROM public.league_quizzes q
  JOIN public.league_quiz_sets s ON s.id = q.quiz_set_id
  JOIN public.leagues l ON l.id = s.league_id
  WHERE q.quiz_set_id = _set_id
    AND (
      public.is_admin_master(auth.uid())
      OR l.president_id = auth.uid()
      OR l.president2_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.league_memberships m
        WHERE m.league_id = l.id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role
      )
    )
  ORDER BY q.display_order;
$function$;

CREATE OR REPLACE FUNCTION public.users_share_league(_a uuid, _b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    _a IS NOT NULL AND _b IS NOT NULL AND (
      _a = _b
      OR EXISTS (
        SELECT 1 FROM public.league_memberships m1
        JOIN public.league_memberships m2 ON m1.league_id = m2.league_id
        WHERE m1.user_id = _a AND m2.user_id = _b
      )
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        LEFT JOIN public.league_memberships m ON m.league_id = l.id
        WHERE (l.president_id = _a AND (m.user_id = _b OR l.president_id = _b OR l.president2_id = _b))
           OR (l.president_id = _b AND (m.user_id = _a OR l.president_id = _a OR l.president2_id = _a))
           OR (l.president2_id = _a AND (m.user_id = _b OR l.president_id = _b OR l.president2_id = _b))
           OR (l.president2_id = _b AND (m.user_id = _a OR l.president_id = _a OR l.president2_id = _a))
      )
    );
$function$;