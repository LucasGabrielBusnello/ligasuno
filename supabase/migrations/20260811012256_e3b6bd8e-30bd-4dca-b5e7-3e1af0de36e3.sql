CREATE TABLE IF NOT EXISTS public.league_efi_accounts (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  client_id_encrypted text NOT NULL,
  client_secret_encrypted text NOT NULL,
  account_name text,
  sandbox boolean NOT NULL DEFAULT false,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.league_efi_accounts TO service_role;

ALTER TABLE public.league_efi_accounts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_league_efi_updated ON public.league_efi_accounts;
CREATE TRIGGER trg_league_efi_updated
BEFORE UPDATE ON public.league_efi_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_payment_provider_check;
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_payment_provider_check
  CHECK (payment_provider IN ('mercadopago','asaas','efi'));