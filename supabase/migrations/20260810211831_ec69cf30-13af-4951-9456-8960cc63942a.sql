ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'mercadopago';

CREATE TABLE IF NOT EXISTS public.league_asaas_accounts (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  api_key_encrypted text NOT NULL,
  account_name text,
  account_email text,
  wallet_id text,
  sandbox boolean NOT NULL DEFAULT false,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.league_asaas_accounts TO service_role;
ALTER TABLE public.league_asaas_accounts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_league_asaas_updated ON public.league_asaas_accounts;
CREATE TRIGGER trg_league_asaas_updated BEFORE UPDATE ON public.league_asaas_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();