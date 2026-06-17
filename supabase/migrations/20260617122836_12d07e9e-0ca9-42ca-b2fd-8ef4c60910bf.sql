CREATE TABLE public.league_certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL UNIQUE REFERENCES public.leagues(id) ON DELETE CASCADE,
  template_url text NOT NULL,
  name_box jsonb NOT NULL DEFAULT '{"x":0.28,"y":0.42,"width":0.44,"height":0.09}'::jsonb,
  signature_box jsonb NOT NULL DEFAULT '{"x":0.58,"y":0.68,"width":0.24,"height":0.1}'::jsonb,
  font_family text NOT NULL DEFAULT 'TimesRoman',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_certificate_templates TO authenticated;
GRANT ALL ON public.league_certificate_templates TO service_role;

ALTER TABLE public.league_certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificate_templates_select" ON public.league_certificate_templates
FOR SELECT TO authenticated
USING (
  public.is_admin_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_certificate_templates.league_id
      AND l.president_id = auth.uid()
  )
);

CREATE POLICY "certificate_templates_manage" ON public.league_certificate_templates
FOR ALL TO authenticated
USING (
  public.is_admin_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_certificate_templates.league_id
      AND l.president_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_certificate_templates.league_id
      AND l.president_id = auth.uid()
  )
);

CREATE TRIGGER trg_certificate_templates_updated
BEFORE UPDATE ON public.league_certificate_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();