
DO $$ BEGIN
  CREATE TYPE public.atm_class AS ENUM ('ATM31','ATM30','ATM29','ATM28','ATM27','ATM26');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS class_code public.atm_class,
  ADD COLUMN IF NOT EXISTS profile_reviewed_at timestamptz;
