
ALTER TABLE public.athletics ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.camed_settings ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.athletic_memberships ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz;
