
-- =========================================================
-- 1) League score requests (pedidos de pontuação enviados por presidente/diretor)
-- =========================================================
CREATE TABLE public.league_score_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  points_requested integer NOT NULL,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_points integer,
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX league_score_requests_league_idx ON public.league_score_requests(league_id);
CREATE INDEX league_score_requests_status_idx ON public.league_score_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_score_requests TO authenticated;
GRANT ALL ON public.league_score_requests TO service_role;

ALTER TABLE public.league_score_requests ENABLE ROW LEVEL SECURITY;

-- Presidente/diretor da liga cria e vê seus pedidos; CAMED/admin veem tudo
CREATE POLICY "lsr_select" ON public.league_score_requests FOR SELECT TO authenticated
USING (
  public.is_admin_master(auth.uid())
  OR public.is_camed_president(auth.uid())
  OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_score_requests.league_id AND m.user_id = auth.uid() AND m.role IN ('diretor','presidente'))
);

CREATE POLICY "lsr_insert" ON public.league_score_requests FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_score_requests.league_id AND m.user_id = auth.uid() AND m.role IN ('diretor','presidente'))
);

CREATE POLICY "lsr_update_owner_pending" ON public.league_score_requests FOR UPDATE TO authenticated
USING (
  status = 'pending' AND (
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = league_score_requests.league_id AND m.user_id = auth.uid() AND m.role IN ('diretor','presidente'))
  )
)
WITH CHECK (true);

CREATE POLICY "lsr_camed_review" ON public.league_score_requests FOR UPDATE TO authenticated
USING (public.is_admin_master(auth.uid()) OR public.is_camed_president(auth.uid()))
WITH CHECK (public.is_admin_master(auth.uid()) OR public.is_camed_president(auth.uid()));

CREATE POLICY "lsr_delete" ON public.league_score_requests FOR DELETE TO authenticated
USING (
  public.is_admin_master(auth.uid())
  OR public.is_camed_president(auth.uid())
  OR (status = 'pending' AND (
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  ))
);

CREATE TRIGGER lsr_set_updated_at BEFORE UPDATE ON public.league_score_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for league-score-receipts bucket
CREATE POLICY "lsr_receipts_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'league-score-receipts' AND (
    public.is_admin_master(auth.uid())
    OR public.is_camed_president(auth.uid())
    OR owner = auth.uid()
  )
);
CREATE POLICY "lsr_receipts_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'league-score-receipts' AND owner = auth.uid());
CREATE POLICY "lsr_receipts_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'league-score-receipts' AND (owner = auth.uid() OR public.is_admin_master(auth.uid()) OR public.is_camed_president(auth.uid())));

-- =========================================================
-- 2) Director permissions per league (aba filter)
-- =========================================================
ALTER TABLE public.league_memberships
  ADD COLUMN IF NOT EXISTS permissions text[];
-- NULL = todas as abas (compatibilidade com diretores existentes)

-- =========================================================
-- 3) CAMED panel access (permissões de abas por e-mail)
-- =========================================================
CREATE TABLE public.camed_panel_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX camed_panel_access_email_idx ON public.camed_panel_access(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.camed_panel_access TO authenticated;
GRANT ALL ON public.camed_panel_access TO service_role;

ALTER TABLE public.camed_panel_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpa_manage" ON public.camed_panel_access FOR ALL TO authenticated
USING (public.is_admin_master(auth.uid()) OR public.is_camed_president(auth.uid()))
WITH CHECK (public.is_admin_master(auth.uid()) OR public.is_camed_president(auth.uid()));

CREATE POLICY "cpa_select_self" ON public.camed_panel_access FOR SELECT TO authenticated
USING (
  lower(email) = lower(COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), ''))
);

CREATE TRIGGER cpa_set_updated_at BEFORE UPDATE ON public.camed_panel_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper para checar acesso ao painel CAMED (presidente/admin = acesso total)
CREATE OR REPLACE FUNCTION public.camed_panel_permissions(_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_admin_master(_user_id) OR public.is_camed_president(_user_id)
      THEN ARRAY['info','membros','noticias','ligas','mensagens','horarios']
    ELSE COALESCE(
      (SELECT cpa.permissions FROM public.camed_panel_access cpa
       JOIN public.profiles p ON lower(p.email) = lower(cpa.email)
       WHERE p.id = _user_id LIMIT 1),
      ARRAY[]::text[]
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_camed_panel_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT array_length(public.camed_panel_permissions(_user_id), 1) > 0;
$$;
