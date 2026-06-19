
-- 1) Helper: do two users share a league? (memberships overlap, or one is president of a league the other is member/president of)
CREATE OR REPLACE FUNCTION public.users_share_league(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
        WHERE (l.president_id = _a AND (m.user_id = _b OR l.president_id = _b))
           OR (l.president_id = _b AND (m.user_id = _a OR l.president_id = _a))
      )
    );
$$;

-- 2) profiles: replace permissive SELECT with scoped policy
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_scoped" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin_master(auth.uid())
    OR public.is_camed_president(auth.uid())
    OR public.users_share_league(auth.uid(), id)
  );

-- 3) league_memberships: scoped SELECT
DROP POLICY IF EXISTS "memberships_select_authenticated" ON public.league_memberships;
CREATE POLICY "memberships_select_scoped" ON public.league_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_master(auth.uid())
    OR public.is_camed_president(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_memberships.league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m2 WHERE m2.league_id = league_memberships.league_id AND m2.user_id = auth.uid())
  );

-- 4) league_quizzes: hide correct_answer / explanation via column-level grants
REVOKE SELECT ON public.league_quizzes FROM authenticated;
GRANT SELECT (id, quiz_set_id, question, options, display_order, created_at)
  ON public.league_quizzes TO authenticated;

-- 4a) Manager RPC: full quiz rows (including correct_answer/explanation) for admins/president/diretor
CREATE OR REPLACE FUNCTION public.manager_get_quizzes(_set_id uuid)
RETURNS TABLE(
  id uuid,
  quiz_set_id uuid,
  question text,
  options jsonb,
  correct_answer int,
  explanation text,
  display_order int,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.quiz_set_id, q.question, q.options, q.correct_answer, q.explanation, q.display_order, q.created_at
  FROM public.league_quizzes q
  JOIN public.league_quiz_sets s ON s.id = q.quiz_set_id
  JOIN public.leagues l ON l.id = s.league_id
  WHERE q.quiz_set_id = _set_id
    AND (
      public.is_admin_master(auth.uid())
      OR l.president_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.league_memberships m
        WHERE m.league_id = l.id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role
      )
    )
  ORDER BY q.display_order;
$$;
GRANT EXECUTE ON FUNCTION public.manager_get_quizzes(uuid) TO authenticated;

-- 4b) Submit answer RPC: validates server-side and reveals correct_answer+explanation only after answering
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(_quiz_id uuid, _answer int)
RETURNS TABLE(is_correct boolean, correct_answer int, explanation text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_correct int;
  v_expl text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT q.correct_answer, q.explanation INTO v_correct, v_expl
  FROM public.league_quizzes q WHERE q.id = _quiz_id;
  IF v_correct IS NULL THEN RAISE EXCEPTION 'quiz not found'; END IF;

  INSERT INTO public.league_quiz_answers(quiz_id, user_id, selected, is_correct)
  VALUES (_quiz_id, v_uid, _answer, _answer = v_correct)
  ON CONFLICT (user_id, quiz_id) DO UPDATE
    SET selected = EXCLUDED.selected, is_correct = EXCLUDED.is_correct;

  RETURN QUERY SELECT (_answer = v_correct), v_correct, v_expl;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, int) TO authenticated;

-- 4c) Get the user's own answers with the correct_answer/explanation revealed (only for already-answered quizzes)
CREATE OR REPLACE FUNCTION public.my_quiz_answers(_set_id uuid)
RETURNS TABLE(
  quiz_id uuid,
  selected int,
  is_correct boolean,
  correct_answer int,
  explanation text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.quiz_id, a.selected, a.is_correct, q.correct_answer, q.explanation
  FROM public.league_quiz_answers a
  JOIN public.league_quizzes q ON q.id = a.quiz_id
  WHERE a.user_id = auth.uid()
    AND (_set_id IS NULL OR q.quiz_set_id = _set_id);
$$;
GRANT EXECUTE ON FUNCTION public.my_quiz_answers(uuid) TO authenticated;

-- 5) Fix storage.objects policies for league-signatures
DROP POLICY IF EXISTS "sig_obj_select" ON storage.objects;
DROP POLICY IF EXISTS "sig_obj_write"  ON storage.objects;
DROP POLICY IF EXISTS "sig_obj_update" ON storage.objects;
DROP POLICY IF EXISTS "sig_obj_delete" ON storage.objects;

CREATE POLICY "sig_obj_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'league-signatures' AND (
      public.is_admin_master(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE (storage.foldername(storage.objects.name))[1] = l.id::text
          AND (
            l.president_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = l.id AND m.user_id = auth.uid())
          )
      )
    )
  );

CREATE POLICY "sig_obj_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'league-signatures' AND (
      public.is_admin_master(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE (storage.foldername(storage.objects.name))[1] = l.id::text
          AND l.president_id = auth.uid()
      )
    )
  );

CREATE POLICY "sig_obj_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'league-signatures' AND (
      public.is_admin_master(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE (storage.foldername(storage.objects.name))[1] = l.id::text
          AND l.president_id = auth.uid()
      )
    )
  );

CREATE POLICY "sig_obj_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'league-signatures' AND (
      public.is_admin_master(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE (storage.foldername(storage.objects.name))[1] = l.id::text
          AND l.president_id = auth.uid()
      )
    )
  );
