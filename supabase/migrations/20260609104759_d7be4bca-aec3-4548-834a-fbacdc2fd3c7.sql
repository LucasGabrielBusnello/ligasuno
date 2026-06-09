
-- 1) Tri-estado + horas em league_attendance
ALTER TABLE public.league_attendance
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ausente',
  ADD COLUMN IF NOT EXISTS hours numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_attendance_status_check') THEN
    ALTER TABLE public.league_attendance
      ADD CONSTRAINT league_attendance_status_check
      CHECK (status IN ('presente','ausente','justificada'));
  END IF;
END $$;

UPDATE public.league_attendance
SET status = CASE WHEN present THEN 'presente' ELSE 'ausente' END
WHERE status = 'ausente' AND present = true;

-- 2) Assinatura do presidente
CREATE TABLE IF NOT EXISTS public.league_president_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL UNIQUE REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  signature_url text NOT NULL,
  president_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_president_signatures TO authenticated;
GRANT ALL ON public.league_president_signatures TO service_role;
ALTER TABLE public.league_president_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig_select" ON public.league_president_signatures FOR SELECT TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_president_signatures.league_id AND m.user_id = auth.uid())
  );
CREATE POLICY "sig_manage" ON public.league_president_signatures FOR ALL TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  );
CREATE TRIGGER trg_sig_updated BEFORE UPDATE ON public.league_president_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Log de envio de certificados
CREATE TABLE IF NOT EXISTS public.certificate_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  cpf text,
  total_hours numeric(6,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.certificate_email_log TO authenticated;
GRANT ALL ON public.certificate_email_log TO service_role;
ALTER TABLE public.certificate_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_log_select" ON public.certificate_email_log FOR SELECT TO authenticated
  USING (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  );
CREATE POLICY "cert_log_insert" ON public.certificate_email_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  );
