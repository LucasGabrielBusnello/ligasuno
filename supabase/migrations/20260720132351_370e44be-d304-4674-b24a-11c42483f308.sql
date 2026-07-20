-- 1. Athletics: chave-mestra de novas associações
ALTER TABLE public.athletics
  ADD COLUMN IF NOT EXISTS memberships_open boolean NOT NULL DEFAULT true;

-- 2. Ciclos de associação
CREATE TABLE IF NOT EXISTS public.athletic_membership_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id uuid NOT NULL REFERENCES public.athletics(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  price_new numeric(10,2) NOT NULL,
  price_renewal numeric(10,2) NOT NULL,
  open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.athletic_membership_cycles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_membership_cycles TO authenticated;
GRANT ALL ON public.athletic_membership_cycles TO service_role;

ALTER TABLE public.athletic_membership_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view membership cycles"
  ON public.athletic_membership_cycles FOR SELECT
  USING (true);

CREATE POLICY "Directors manage membership cycles"
  ON public.athletic_membership_cycles FOR ALL
  TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TRIGGER update_athletic_membership_cycles_updated_at
  BEFORE UPDATE ON public.athletic_membership_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Membership: vinculo com ciclo + permissões granulares
ALTER TABLE public.athletic_memberships
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.athletic_membership_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS director_tabs text[];

-- 4. Contas InfinitePay
CREATE TABLE IF NOT EXISTS public.athletic_infinitepay_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athletic_id uuid NOT NULL UNIQUE REFERENCES public.athletics(id) ON DELETE CASCADE,
  handle text NOT NULL,
  api_key_encrypted text NOT NULL,
  webhook_secret_encrypted text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletic_infinitepay_accounts TO authenticated;
GRANT ALL ON public.athletic_infinitepay_accounts TO service_role;

ALTER TABLE public.athletic_infinitepay_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors manage infinitepay accounts"
  ON public.athletic_infinitepay_accounts FOR ALL
  TO authenticated
  USING (public.is_athletic_director(auth.uid(), athletic_id))
  WITH CHECK (public.is_athletic_director(auth.uid(), athletic_id));

CREATE TRIGGER update_athletic_infinitepay_accounts_updated_at
  BEFORE UPDATE ON public.athletic_infinitepay_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();