CREATE TABLE public.camed_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.camed_documents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('folder','file')),
  name text NOT NULL,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_camed_documents_parent ON public.camed_documents(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.camed_documents TO authenticated;
GRANT ALL ON public.camed_documents TO service_role;

ALTER TABLE public.camed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Camed docs managers full access"
ON public.camed_documents FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_master')
  OR public.is_camed_president(auth.uid())
  OR public.has_camed_panel_tab(auth.uid(), 'documentos')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin_master')
  OR public.is_camed_president(auth.uid())
  OR public.has_camed_panel_tab(auth.uid(), 'documentos')
);

CREATE TRIGGER update_camed_documents_updated_at
BEFORE UPDATE ON public.camed_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();