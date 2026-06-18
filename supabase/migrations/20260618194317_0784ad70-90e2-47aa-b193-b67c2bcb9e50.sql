CREATE TABLE public.camed_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  category text default 'Geral',
  image_url text,
  link text,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.camed_news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camed_news TO authenticated;
GRANT ALL ON public.camed_news TO service_role;
ALTER TABLE public.camed_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view camed news" ON public.camed_news FOR SELECT USING (true);
CREATE POLICY "Camed presidents can manage news" ON public.camed_news FOR ALL TO authenticated USING (public.is_camed_president(auth.uid())) WITH CHECK (public.is_camed_president(auth.uid()));