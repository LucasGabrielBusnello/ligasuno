ALTER TABLE public.camed_info ADD COLUMN IF NOT EXISTS hero_image_url text;

-- camed_info
DROP POLICY IF EXISTS camed_info_update ON public.camed_info;
CREATE POLICY camed_info_update ON public.camed_info FOR UPDATE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'info'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'info'));
DROP POLICY IF EXISTS camed_info_insert ON public.camed_info;
CREATE POLICY camed_info_insert ON public.camed_info FOR INSERT TO authenticated
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'info'));

-- camed_settings
DROP POLICY IF EXISTS cs_update ON public.camed_settings;
CREATE POLICY cs_update ON public.camed_settings FOR UPDATE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'info'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'info'));

-- camed_members
DROP POLICY IF EXISTS camed_members_manage ON public.camed_members;
CREATE POLICY camed_members_manage ON public.camed_members FOR ALL TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'membros'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'membros'));

-- camed_news
DROP POLICY IF EXISTS "Camed presidents can manage news" ON public.camed_news;
CREATE POLICY camed_news_manage ON public.camed_news FOR ALL TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'noticias'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'noticias'));

-- camed_messages
DROP POLICY IF EXISTS camed_read_msg ON public.camed_messages;
CREATE POLICY camed_read_msg ON public.camed_messages FOR SELECT TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'mensagens'));
DROP POLICY IF EXISTS camed_del_msg ON public.camed_messages;
CREATE POLICY camed_del_msg ON public.camed_messages FOR DELETE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'mensagens'));

-- camed_slots
DROP POLICY IF EXISTS slots_camed_write ON public.camed_slots;
CREATE POLICY slots_camed_write ON public.camed_slots FOR INSERT TO authenticated
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'horarios'));
DROP POLICY IF EXISTS slots_camed_update ON public.camed_slots;
CREATE POLICY slots_camed_update ON public.camed_slots FOR UPDATE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'horarios'))
  WITH CHECK (public.has_camed_panel_tab(auth.uid(), 'horarios'));
DROP POLICY IF EXISTS slots_camed_delete ON public.camed_slots;
CREATE POLICY slots_camed_delete ON public.camed_slots FOR DELETE TO authenticated
  USING (public.has_camed_panel_tab(auth.uid(), 'horarios'));

-- camed_bookings
DROP POLICY IF EXISTS bk_camed_select ON public.camed_bookings;
CREATE POLICY bk_camed_select ON public.camed_bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_camed_panel_tab(auth.uid(), 'horarios'));
DROP POLICY IF EXISTS bk_user_delete ON public.camed_bookings;
CREATE POLICY bk_user_delete ON public.camed_bookings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_camed_panel_tab(auth.uid(), 'horarios'));
