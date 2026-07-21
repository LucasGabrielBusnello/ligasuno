
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.maintenance_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.maintenance_allowlist TO anon, authenticated;
GRANT ALL ON public.maintenance_allowlist TO service_role;

ALTER TABLE public.maintenance_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allowlist_public_read" ON public.maintenance_allowlist;
CREATE POLICY "allowlist_public_read" ON public.maintenance_allowlist FOR SELECT USING (true);

DROP POLICY IF EXISTS "allowlist_admin_all" ON public.maintenance_allowlist;
CREATE POLICY "allowlist_admin_all" ON public.maintenance_allowlist FOR ALL
  USING (public.is_admin_master(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()));

INSERT INTO public.maintenance_allowlist (email, note)
VALUES ('lucassgabrielbusnello@gmail.com', 'owner')
ON CONFLICT (email) DO NOTHING;
