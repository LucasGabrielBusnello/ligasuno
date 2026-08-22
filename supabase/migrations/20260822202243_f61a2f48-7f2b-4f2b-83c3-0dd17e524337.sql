-- Economia de créditos e telemetria de IA do simulador
CREATE TABLE public.sim_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  chat_model text NOT NULL DEFAULT 'google/gemini-3.7-flash',
  grade_model text NOT NULL DEFAULT 'google/gemini-3.1-pro-preview',
  chat_cost_in_brl_per_mtok numeric NOT NULL DEFAULT 1.80,
  chat_cost_out_brl_per_mtok numeric NOT NULL DEFAULT 7.20,
  grade_cost_in_brl_per_mtok numeric NOT NULL DEFAULT 18.00,
  grade_cost_out_brl_per_mtok numeric NOT NULL DEFAULT 72.00,
  tokens_per_credit int NOT NULL DEFAULT 1000,
  gateway_fee_pct numeric NOT NULL DEFAULT 3,
  price_divisor numeric NOT NULL DEFAULT 0.47,
  free_credits int NOT NULL DEFAULT 20,
  mp_access_token_enc text,
  openai_key_enc text,
  anthropic_key_enc text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sim_settings TO authenticated;
GRANT ALL ON public.sim_settings TO service_role;
ALTER TABLE public.sim_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_settings_admin" ON public.sim_settings FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_settings_updated BEFORE UPDATE ON public.sim_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.sim_settings (id) VALUES (true);

CREATE TABLE public.sim_credit_balances (
  user_id uuid PRIMARY KEY,
  credits numeric(14,4) NOT NULL DEFAULT 0,
  total_purchased numeric(14,4) NOT NULL DEFAULT 0,
  total_spent numeric(14,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_credit_balances TO authenticated;
GRANT ALL ON public.sim_credit_balances TO service_role;
ALTER TABLE public.sim_credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_balance_read" ON public.sim_credit_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_balances_updated BEFORE UPDATE ON public.sim_credit_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sim_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sim_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  phase text NOT NULL,
  model text NOT NULL,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  cost_brl numeric(12,6) NOT NULL DEFAULT 0,
  credits numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_usage_events TO authenticated;
GRANT ALL ON public.sim_usage_events TO service_role;
ALTER TABLE public.sim_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_usage_read" ON public.sim_usage_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_master(auth.uid()));
CREATE INDEX idx_sim_usage_session ON public.sim_usage_events(session_id);
CREATE INDEX idx_sim_usage_created ON public.sim_usage_events(created_at DESC);

CREATE TABLE public.sim_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.sim_sessions(id) ON DELETE SET NULL,
  kind text NOT NULL,
  credits numeric(12,4) NOT NULL,
  tokens int NOT NULL DEFAULT 0,
  cost_brl numeric(12,6) NOT NULL DEFAULT 0,
  amount_brl numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_credit_ledger TO authenticated;
GRANT ALL ON public.sim_credit_ledger TO service_role;
ALTER TABLE public.sim_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_ledger_read" ON public.sim_credit_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_master(auth.uid()));
CREATE INDEX idx_sim_ledger_user ON public.sim_credit_ledger(user_id, created_at DESC);

CREATE TABLE public.sim_credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits int NOT NULL,
  price_brl numeric(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_credit_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_credit_packages TO authenticated;
GRANT ALL ON public.sim_credit_packages TO service_role;
ALTER TABLE public.sim_credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_packages_read" ON public.sim_credit_packages FOR SELECT USING (active OR public.is_admin_master(auth.uid()));
CREATE POLICY "sim_packages_admin" ON public.sim_credit_packages FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_packages_updated BEFORE UPDATE ON public.sim_credit_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sim_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid REFERENCES public.sim_credit_packages(id) ON DELETE SET NULL,
  credits numeric(12,4) NOT NULL,
  amount_brl numeric(10,2) NOT NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  status text NOT NULL DEFAULT 'pending',
  external_id text,
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sim_purchases TO authenticated;
GRANT ALL ON public.sim_purchases TO service_role;
ALTER TABLE public.sim_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim_purchases_read" ON public.sim_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_master(auth.uid()));
CREATE TRIGGER sim_purchases_updated BEFORE UPDATE ON public.sim_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Débito atômico de créditos
CREATE OR REPLACE FUNCTION public.sim_debit_credits(_user_id uuid, _session_id uuid, _credits numeric, _tokens int, _cost numeric, _description text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance numeric;
BEGIN
  INSERT INTO public.sim_credit_balances (user_id, credits)
  VALUES (_user_id, (SELECT free_credits FROM public.sim_settings WHERE id))
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.sim_credit_balances
     SET credits = credits - _credits,
         total_spent = total_spent + _credits
   WHERE user_id = _user_id
  RETURNING credits INTO v_balance;

  INSERT INTO public.sim_credit_ledger (user_id, session_id, kind, credits, tokens, cost_brl, description)
  VALUES (_user_id, _session_id, 'debit', -_credits, _tokens, _cost, _description);

  RETURN v_balance;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sim_debit_credits(uuid, uuid, numeric, int, numeric, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sim_add_credits(_user_id uuid, _credits numeric, _amount numeric, _description text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance numeric;
BEGIN
  INSERT INTO public.sim_credit_balances (user_id, credits) VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.sim_credit_balances
     SET credits = credits + _credits,
         total_purchased = total_purchased + GREATEST(_credits, 0)
   WHERE user_id = _user_id
  RETURNING credits INTO v_balance;

  INSERT INTO public.sim_credit_ledger (user_id, kind, credits, amount_brl, description)
  VALUES (_user_id, 'purchase', _credits, _amount, _description);

  RETURN v_balance;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sim_add_credits(uuid, numeric, numeric, text) FROM PUBLIC, anon, authenticated;

INSERT INTO public.sim_credit_packages (name, credits, price_brl, sort) VALUES
  ('Pacote Início', 100, 19.90, 1),
  ('Pacote Plantão', 300, 49.90, 2),
  ('Pacote Internato', 800, 119.90, 3);