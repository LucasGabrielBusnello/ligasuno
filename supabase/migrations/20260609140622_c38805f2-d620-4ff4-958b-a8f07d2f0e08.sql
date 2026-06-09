
-- 1) Extender league_events
ALTER TABLE public.league_events
  ADD COLUMN IF NOT EXISTS total_hours numeric(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checkin_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS freeze_on_event_day boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS full_name_required boolean NOT NULL DEFAULT true;

-- 2) Extender inscrições
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS checkin_code text;

ALTER TABLE public.minicourse_registrations
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS checkin_code text;

ALTER TABLE public.league_minicourses
  ADD COLUMN IF NOT EXISTS total_hours numeric(6,2) DEFAULT 0;

-- 3) Função gen + trigger
CREATE OR REPLACE FUNCTION public.gen_checkin_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT lpad((floor(random()*1000000))::int::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_event_reg_checkin_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE i int; c text;
BEGIN
  IF NEW.checkin_code IS NOT NULL THEN RETURN NEW; END IF;
  FOR i IN 1..50 LOOP
    c := public.gen_checkin_code();
    IF NOT EXISTS (SELECT 1 FROM public.event_registrations
      WHERE event_id = NEW.event_id AND checkin_code = c) THEN
      NEW.checkin_code := c; RETURN NEW;
    END IF;
  END LOOP;
  NEW.checkin_code := c; RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_mc_reg_checkin_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE i int; c text;
BEGIN
  IF NEW.checkin_code IS NOT NULL THEN RETURN NEW; END IF;
  FOR i IN 1..50 LOOP
    c := public.gen_checkin_code();
    IF NOT EXISTS (SELECT 1 FROM public.minicourse_registrations
      WHERE minicourse_id = NEW.minicourse_id AND checkin_code = c) THEN
      NEW.checkin_code := c; RETURN NEW;
    END IF;
  END LOOP;
  NEW.checkin_code := c; RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_reg_code ON public.event_registrations;
CREATE TRIGGER trg_event_reg_code BEFORE INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_event_reg_checkin_code();

DROP TRIGGER IF EXISTS trg_mc_reg_code ON public.minicourse_registrations;
CREATE TRIGGER trg_mc_reg_code BEFORE INSERT ON public.minicourse_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_mc_reg_checkin_code();

-- 4) Backfill linha a linha (garantido único)
DO $$
DECLARE r record; c text; i int;
BEGIN
  FOR r IN SELECT id, event_id FROM public.event_registrations WHERE checkin_code IS NULL LOOP
    FOR i IN 1..50 LOOP
      c := lpad((floor(random()*1000000))::int::text, 6, '0');
      IF NOT EXISTS (SELECT 1 FROM public.event_registrations
        WHERE event_id = r.event_id AND checkin_code = c) THEN
        UPDATE public.event_registrations SET checkin_code = c WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  FOR r IN SELECT id, minicourse_id FROM public.minicourse_registrations WHERE checkin_code IS NULL LOOP
    FOR i IN 1..50 LOOP
      c := lpad((floor(random()*1000000))::int::text, 6, '0');
      IF NOT EXISTS (SELECT 1 FROM public.minicourse_registrations
        WHERE minicourse_id = r.minicourse_id AND checkin_code = c) THEN
        UPDATE public.minicourse_registrations SET checkin_code = c WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 5) Índices únicos (após backfill)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_reg_checkin_code
  ON public.event_registrations(event_id, checkin_code)
  WHERE checkin_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_minicourse_reg_checkin_code
  ON public.minicourse_registrations(minicourse_id, checkin_code)
  WHERE checkin_code IS NOT NULL;

-- 6) event_checkins
CREATE TABLE IF NOT EXISTS public.event_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.league_events(id) ON DELETE CASCADE,
  checkin_index integer NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'manual',
  by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(registration_id, checkin_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checkins TO authenticated;
GRANT ALL ON public.event_checkins TO service_role;
ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_checkins_select" ON public.event_checkins FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.event_registrations er
    WHERE er.id = event_checkins.registration_id AND er.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.league_events e
    JOIN public.leagues l ON l.id = e.league_id
    WHERE e.id = event_checkins.event_id AND l.president_id = auth.uid())
);
CREATE POLICY "event_checkins_manage" ON public.event_checkins FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.league_events e
    JOIN public.leagues l ON l.id = e.league_id
    WHERE e.id = event_checkins.event_id AND l.president_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.league_events e
    JOIN public.leagues l ON l.id = e.league_id
    WHERE e.id = event_checkins.event_id AND l.president_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_event_checkins_event ON public.event_checkins(event_id, checkin_index);
CREATE INDEX IF NOT EXISTS idx_event_checkins_registration ON public.event_checkins(registration_id);

-- 7) minicourse_checkins
CREATE TABLE IF NOT EXISTS public.minicourse_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES public.minicourse_registrations(id) ON DELETE CASCADE,
  minicourse_id uuid NOT NULL REFERENCES public.league_minicourses(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'manual',
  by_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(registration_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minicourse_checkins TO authenticated;
GRANT ALL ON public.minicourse_checkins TO service_role;
ALTER TABLE public.minicourse_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mc_checkins_select" ON public.minicourse_checkins FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.minicourse_registrations mr
    WHERE mr.id = minicourse_checkins.registration_id AND mr.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.league_minicourses mc
    JOIN public.league_events e ON e.id = mc.event_id
    JOIN public.leagues l ON l.id = e.league_id
    WHERE mc.id = minicourse_checkins.minicourse_id AND l.president_id = auth.uid())
);
CREATE POLICY "mc_checkins_manage" ON public.minicourse_checkins FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.league_minicourses mc
    JOIN public.league_events e ON e.id = mc.event_id
    JOIN public.leagues l ON l.id = e.league_id
    WHERE mc.id = minicourse_checkins.minicourse_id AND l.president_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.league_minicourses mc
    JOIN public.league_events e ON e.id = mc.event_id
    JOIN public.leagues l ON l.id = e.league_id
    WHERE mc.id = minicourse_checkins.minicourse_id AND l.president_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_mc_checkins_minicourse ON public.minicourse_checkins(minicourse_id);

-- 8) event_snapshots
CREATE TABLE IF NOT EXISTS public.event_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.league_events(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);
GRANT SELECT ON public.event_snapshots TO authenticated;
GRANT ALL ON public.event_snapshots TO service_role;
ALTER TABLE public.event_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_snapshots_select" ON public.event_snapshots FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.league_events e
    JOIN public.leagues l ON l.id = e.league_id
    WHERE e.id = event_snapshots.event_id AND l.president_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_event_snapshots_event ON public.event_snapshots(event_id, taken_at DESC);

-- 9) league_sheets_sync
CREATE TABLE IF NOT EXISTS public.league_sheets_sync (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id uuid NOT NULL UNIQUE REFERENCES public.leagues(id) ON DELETE CASCADE,
  spreadsheet_id text NOT NULL,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_sheets_sync TO authenticated;
GRANT ALL ON public.league_sheets_sync TO service_role;
ALTER TABLE public.league_sheets_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sheets_sync_president" ON public.league_sheets_sync FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_sheets_sync.league_id AND l.president_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_sheets_sync.league_id AND l.president_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_sheets_sync_updated ON public.league_sheets_sync;
CREATE TRIGGER trg_sheets_sync_updated BEFORE UPDATE ON public.league_sheets_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
