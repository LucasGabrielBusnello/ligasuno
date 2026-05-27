UPDATE public.app_settings SET annual_fee_pix_monthly = 2.90, annual_fee_credit_monthly = 3.30, updated_at = now() WHERE id = 1;

CREATE TABLE public.league_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_league_subs_league ON public.league_subscriptions(league_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_subscriptions TO authenticated;
GRANT ALL ON public.league_subscriptions TO service_role;

ALTER TABLE public.league_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_select" ON public.league_subscriptions FOR SELECT TO authenticated
USING (is_admin_master(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = league_subscriptions.league_id AND l.president_id = auth.uid()
));

CREATE POLICY "subs_manage_admin" ON public.league_subscriptions FOR ALL TO authenticated
USING (is_admin_master(auth.uid())) WITH CHECK (is_admin_master(auth.uid()));

CREATE TRIGGER trg_league_subs_updated BEFORE UPDATE ON public.league_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();