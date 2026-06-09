ALTER TABLE public.league_selection_quotas
ADD COLUMN IF NOT EXISTS restrict_to_semester BOOLEAN NOT NULL DEFAULT FALSE;