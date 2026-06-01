
-- ============= Matrícula e CPF em profiles =============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS cpf text;

-- Unique CPF (case-insensitive normalizado: só dígitos). Permite NULL.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

-- ============= Matrícula em inscrições da seleção =============
ALTER TABLE public.league_selection_registrations
  ADD COLUMN IF NOT EXISTS registration_number text;

-- ============= Tabela de pedidos de desistência =============
CREATE TABLE IF NOT EXISTS public.league_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (league_id, user_id, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_leave_requests TO authenticated;
GRANT ALL ON public.league_leave_requests TO service_role;

ALTER TABLE public.league_leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llr_select" ON public.league_leave_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  );

CREATE POLICY "llr_insert_own" ON public.league_leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "llr_update_pres" ON public.league_leave_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  );

-- ============= Log de e-mails de evento (idempotência do cron) =============
CREATE TABLE IF NOT EXISTS public.event_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  kind text NOT NULL,  -- 'reminder_7d' | 'reminder_1d' | 'reminder_0d' | 'minicourse_0d' | 'confirm_event' | 'confirm_minicourse'
  recipient text NOT NULL,
  reference_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_email_log_dedupe
  ON public.event_email_log (event_id, kind, recipient);

GRANT SELECT, INSERT ON public.event_email_log TO authenticated;
GRANT ALL ON public.event_email_log TO service_role;

ALTER TABLE public.event_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eel_admin" ON public.event_email_log
  FOR SELECT TO authenticated
  USING (public.is_admin_master(auth.uid()));

-- ============= Agendar cron de lembretes de evento (08:00 UTC) =============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'event-reminders') THEN
    PERFORM cron.unschedule('event-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'event-reminders',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ligasuno.lovable.app/api/public/cron/event-reminders',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );
  $$
);
