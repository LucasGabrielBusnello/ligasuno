
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenacao';

DO $$ BEGIN
  CREATE TYPE public.shift_period AS ENUM ('morning','afternoon','night');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.schedule_kind AS ENUM ('class','practice','exam','green_zone','abex');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.is_coordination(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('coordenacao','admin_master')
  )
$$;

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  date date NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, label)
);
GRANT SELECT ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays select authenticated" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays coord manage" ON public.holidays FOR ALL TO authenticated
  USING (public.is_coordination(auth.uid())) WITH CHECK (public.is_coordination(auth.uid()));
CREATE TRIGGER update_holidays_updated_at BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid REFERENCES public.academic_terms(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_code public.atm_class NOT NULL,
  subdivision text NOT NULL DEFAULT 'A',
  date date NOT NULL,
  shift public.shift_period NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  kind public.schedule_kind NOT NULL DEFAULT 'class',
  is_abex boolean NOT NULL DEFAULT false,
  rescheduled_from_entry_id uuid REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  rescheduled_to_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_class_date ON public.schedule_entries(class_code, date);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_date_shift ON public.schedule_entries(date, shift);
GRANT SELECT ON public.schedule_entries TO authenticated;
GRANT ALL ON public.schedule_entries TO service_role;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule select authenticated" ON public.schedule_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule coord manage" ON public.schedule_entries FOR ALL TO authenticated
  USING (public.is_coordination(auth.uid())) WITH CHECK (public.is_coordination(auth.uid()));
CREATE TRIGGER update_schedule_entries_updated_at BEFORE UPDATE ON public.schedule_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  CREATE POLICY "academic_terms coord manage" ON public.academic_terms FOR ALL TO authenticated
    USING (public.is_coordination(auth.uid())) WITH CHECK (public.is_coordination(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
