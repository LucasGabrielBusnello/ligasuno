
-- Path convention: <league_id>/signature.png
CREATE POLICY "sig_obj_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'league-signatures' AND (
    public.is_admin_master(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id::text = (storage.foldername(name))[1]
        AND (l.president_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = l.id AND m.user_id = auth.uid()))
    )
  )
);
CREATE POLICY "sig_obj_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'league-signatures' AND (
    public.is_admin_master(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id::text = (storage.foldername(name))[1] AND l.president_id = auth.uid()
    )
  )
);
CREATE POLICY "sig_obj_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'league-signatures' AND (
    public.is_admin_master(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id::text = (storage.foldername(name))[1] AND l.president_id = auth.uid())
  )
);
CREATE POLICY "sig_obj_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'league-signatures' AND (
    public.is_admin_master(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.leagues l WHERE l.id::text = (storage.foldername(name))[1] AND l.president_id = auth.uid())
  )
);
