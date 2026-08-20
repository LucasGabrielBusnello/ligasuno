CREATE TABLE public.camed_course_infos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.camed_course_infos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camed_course_infos TO authenticated;
GRANT ALL ON public.camed_course_infos TO service_role;
ALTER TABLE public.camed_course_infos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camed_course_infos_public_read" ON public.camed_course_infos FOR SELECT USING (true);
CREATE POLICY "camed_course_infos_manage" ON public.camed_course_infos FOR ALL TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'documentos'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'documentos'));
CREATE TRIGGER camed_course_infos_updated_at BEFORE UPDATE ON public.camed_course_infos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.camed_contact_buttons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.camed_contact_buttons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camed_contact_buttons TO authenticated;
GRANT ALL ON public.camed_contact_buttons TO service_role;
ALTER TABLE public.camed_contact_buttons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camed_contact_buttons_public_read" ON public.camed_contact_buttons FOR SELECT USING (true);
CREATE POLICY "camed_contact_buttons_manage" ON public.camed_contact_buttons FOR ALL TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'documentos'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'documentos'));
CREATE TRIGGER camed_contact_buttons_updated_at BEFORE UPDATE ON public.camed_contact_buttons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();