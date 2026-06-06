
CREATE TABLE public.league_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id)
);

GRANT SELECT ON public.league_likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.league_likes TO authenticated;
GRANT ALL ON public.league_likes TO service_role;

ALTER TABLE public.league_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select_public" ON public.league_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON public.league_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes_delete_own" ON public.league_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_league_likes_league ON public.league_likes(league_id);
