CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_email text,
  user_name text,
  category text NOT NULL DEFAULT 'geral',
  action text NOT NULL,
  target text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  path text
);

CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX activity_logs_category_idx ON public.activity_logs (category);
CREATE INDEX activity_logs_user_idx ON public.activity_logs (user_id);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT INSERT ON public.activity_logs TO anon;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can write logs"
ON public.activity_logs FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "admin master can read logs"
ON public.activity_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin_master'));