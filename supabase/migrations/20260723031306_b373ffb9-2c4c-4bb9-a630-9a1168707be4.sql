ALTER TABLE public.athletic_infinitepay_accounts
  ALTER COLUMN api_key_encrypted DROP NOT NULL,
  ALTER COLUMN webhook_secret_encrypted DROP NOT NULL;