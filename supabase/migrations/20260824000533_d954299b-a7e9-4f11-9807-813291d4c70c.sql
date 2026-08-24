ALTER TABLE public.sim_sessions
  ADD COLUMN IF NOT EXISTS tokens_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS persona jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS clarifications jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sim_settings
  ADD COLUMN IF NOT EXISTS max_tokens_per_case integer NOT NULL DEFAULT 200000,
  ADD COLUMN IF NOT EXISTS credits_per_case numeric NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.sim_add_session_tokens(_session_id uuid, _tokens integer)
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.sim_sessions
     SET tokens_used = COALESCE(tokens_used, 0) + GREATEST(_tokens, 0)
   WHERE id = _session_id
  RETURNING tokens_used;
$$;