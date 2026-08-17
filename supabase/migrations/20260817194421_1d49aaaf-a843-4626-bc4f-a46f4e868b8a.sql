GRANT EXECUTE ON FUNCTION public.is_admin_master(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_camed_president(uuid) TO anon;

CREATE TABLE IF NOT EXISTS public.camed_course_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  file_url text NOT NULL,
  file_name text,
  storage_path text,
  size_bytes bigint,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.camed_course_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camed_course_documents TO authenticated;
GRANT ALL ON public.camed_course_documents TO service_role;

ALTER TABLE public.camed_course_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camed_course_docs_public_read" ON public.camed_course_documents
  FOR SELECT USING (true);

CREATE POLICY "camed_course_docs_manage" ON public.camed_course_documents
  FOR ALL TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'documentos'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'documentos'));

CREATE TRIGGER camed_course_docs_updated_at BEFORE UPDATE ON public.camed_course_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();