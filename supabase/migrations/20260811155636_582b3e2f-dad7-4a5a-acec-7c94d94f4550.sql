CREATE TABLE IF NOT EXISTS public.league_infinitepay_accounts (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  handle text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_infinitepay_accounts TO authenticated;
GRANT ALL ON public.league_infinitepay_accounts TO service_role;
ALTER TABLE public.league_infinitepay_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league_ipay_select_members" ON public.league_infinitepay_accounts;
CREATE POLICY "league_ipay_select_members" ON public.league_infinitepay_accounts
  FOR SELECT TO authenticated
  USING (public.is_league_member(auth.uid(), league_id) OR public.is_admin_master(auth.uid()));

ALTER TABLE public.semester_cycles ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

UPDATE public.leagues SET payment_provider = 'mercadopago'
  WHERE payment_provider IS NOT NULL AND payment_provider NOT IN ('mercadopago','infinitepay');

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.leagues'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%payment_provider%' LIMIT 1;
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.leagues DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.leagues ADD CONSTRAINT leagues_payment_provider_check
  CHECK (payment_provider IN ('mercadopago','infinitepay'));