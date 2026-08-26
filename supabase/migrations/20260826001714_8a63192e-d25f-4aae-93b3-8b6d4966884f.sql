CREATE TABLE public.sim_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'area' CHECK (kind IN ('core','area','guideline')),
  area TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sim_references TO authenticated;
GRANT ALL ON public.sim_references TO service_role;

ALTER TABLE public.sim_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sim references"
  ON public.sim_references FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage sim references"
  ON public.sim_references FOR ALL TO authenticated
  USING (public.is_admin_master(auth.uid()))
  WITH CHECK (public.is_admin_master(auth.uid()));

CREATE TRIGGER update_sim_references_updated_at
  BEFORE UPDATE ON public.sim_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();