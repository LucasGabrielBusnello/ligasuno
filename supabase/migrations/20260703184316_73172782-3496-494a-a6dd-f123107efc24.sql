-- Políticas do bucket público de imagens
-- O bucket 'images' foi criado via ferramenta de storage como público.

-- Leitura pública para exibição direta
CREATE POLICY "Images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');

-- Upload permitido para usuários autenticados (presidentes/diretores/admin)
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images'
  AND LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

-- Delete pelo proprietário da imagem ou admin master
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'images'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin_master')
  )
);
