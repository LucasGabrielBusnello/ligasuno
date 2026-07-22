
ALTER TABLE public.league_activities
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS participating_league_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS league_activities_is_open_idx ON public.league_activities(is_open) WHERE is_open = true;
