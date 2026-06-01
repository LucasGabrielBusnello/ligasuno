
-- 1) Tabela de contas Mercado Pago conectadas por liga (OAuth do presidente)
CREATE TABLE public.league_mp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL UNIQUE,
  mp_user_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  public_key text,
  scope text,
  live_mode boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_mp_accounts TO authenticated;
GRANT ALL ON public.league_mp_accounts TO service_role;

ALTER TABLE public.league_mp_accounts ENABLE ROW LEVEL SECURITY;

-- Presidentes da liga e admin podem ver se a conta está conectada (mas tokens nunca devem ir pro client — só usar via server functions)
CREATE POLICY mp_accounts_select ON public.league_mp_accounts FOR SELECT TO authenticated
  USING (
    is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_mp_accounts.league_id AND l.president_id = auth.uid())
  );

-- Apenas admin pode escrever direto; presidente conecta via server function (service_role)
CREATE POLICY mp_accounts_admin_manage ON public.league_mp_accounts FOR ALL TO authenticated
  USING (is_admin_master(auth.uid())) WITH CHECK (is_admin_master(auth.uid()));

CREATE INDEX idx_mp_accounts_league ON public.league_mp_accounts(league_id);

-- 2) Configurações de taxas por categoria
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS fee_selection_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fee_selection_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_semester_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fee_semester_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_event_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fee_event_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_minicourse_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fee_minicourse_fixed numeric NOT NULL DEFAULT 0;

-- 3) Log unificado de transações Mercado Pago
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid,
  user_id uuid,
  category text NOT NULL, -- 'event' | 'minicourse' | 'selection' | 'semester' | 'anuidade'
  reference_id uuid,      -- registration_id etc.
  mp_payment_id text UNIQUE,
  mp_preference_id text,
  mp_preapproval_id text,
  payment_method text,    -- 'pix' | 'credit_card' | 'debit_card' etc.
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,    -- taxa retida pela plataforma
  status text NOT NULL DEFAULT 'pending',   -- pending|approved|rejected|refunded|cancelled
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pt_select ON public.payment_transactions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = payment_transactions.league_id AND l.president_id = auth.uid())
  );

CREATE INDEX idx_pt_league ON public.payment_transactions(league_id);
CREATE INDEX idx_pt_user ON public.payment_transactions(user_id);
CREATE INDEX idx_pt_category ON public.payment_transactions(category);

-- triggers updated_at
CREATE TRIGGER trg_mp_accounts_updated BEFORE UPDATE ON public.league_mp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pt_updated BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
