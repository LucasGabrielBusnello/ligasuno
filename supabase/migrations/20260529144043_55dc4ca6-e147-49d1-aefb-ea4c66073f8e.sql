ALTER TABLE public.league_events
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepting_registrations boolean NOT NULL DEFAULT true;