ALTER TABLE public.camed_info
  ADD COLUMN IF NOT EXISTS history_title text NOT NULL DEFAULT 'Conheça a Nossa História',
  ADD COLUMN IF NOT EXISTS history_description text,
  ADD COLUMN IF NOT EXISTS history_images jsonb NOT NULL DEFAULT '[]'::jsonb;