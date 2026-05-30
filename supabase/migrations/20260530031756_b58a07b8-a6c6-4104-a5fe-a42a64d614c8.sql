ALTER TABLE public.league_events ADD COLUMN IF NOT EXISTS schedule text;

-- Remove attendance rows that mirror event titles (auto-created on event payment)
DELETE FROM public.league_attendance la
WHERE EXISTS (
  SELECT 1 FROM public.league_events e
  WHERE e.league_id = la.league_id AND e.title = la.activity
);