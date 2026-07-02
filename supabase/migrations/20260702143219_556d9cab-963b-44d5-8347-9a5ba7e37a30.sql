
CREATE OR REPLACE FUNCTION public.can_manage_league_cash(_user_id uuid, _league_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_master(_user_id)
    OR EXISTS (SELECT 1 FROM public.leagues WHERE id = _league_id AND president_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.league_memberships WHERE league_id = _league_id AND user_id = _user_id AND role = 'diretor');
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_league_cash(uuid, uuid) FROM anon;

CREATE POLICY "cash receipts read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cash-receipts' AND public.can_manage_league_cash(auth.uid(), (split_part(name,'/',1))::uuid));

CREATE POLICY "cash receipts insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cash-receipts' AND public.can_manage_league_cash(auth.uid(), (split_part(name,'/',1))::uuid));

CREATE POLICY "cash receipts delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cash-receipts' AND public.can_manage_league_cash(auth.uid(), (split_part(name,'/',1))::uuid));
