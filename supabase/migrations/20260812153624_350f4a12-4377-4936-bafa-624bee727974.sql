ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_registrations_referred_by_idx
  ON public.event_registrations (referred_by);