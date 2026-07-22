ALTER TABLE public.athletic_membership_cycles
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

-- Ensure only one is_current cycle per athletic
CREATE UNIQUE INDEX IF NOT EXISTS uniq_athletic_current_cycle
  ON public.athletic_membership_cycles (athletic_id)
  WHERE is_current = true;