
ALTER TABLE public.camed_info ADD COLUMN IF NOT EXISTS email text;

-- mensagens anônimas
CREATE TABLE IF NOT EXISTS public.camed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.camed_messages TO anon, authenticated;
GRANT SELECT, DELETE ON public.camed_messages TO authenticated;
GRANT ALL ON public.camed_messages TO service_role;
ALTER TABLE public.camed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_insert_msg" ON public.camed_messages FOR INSERT TO anon, authenticated WITH CHECK (length(message) BETWEEN 1 AND 5000);
CREATE POLICY "camed_read_msg" ON public.camed_messages FOR SELECT TO authenticated USING (is_camed_president(auth.uid()) OR is_admin_master(auth.uid()));
CREATE POLICY "camed_del_msg" ON public.camed_messages FOR DELETE TO authenticated USING (is_camed_president(auth.uid()) OR is_admin_master(auth.uid()));

-- horários semanais
CREATE TABLE IF NOT EXISTS public.camed_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_at timestamptz NOT NULL,
  allow_online boolean NOT NULL DEFAULT true,
  allow_in_person boolean NOT NULL DEFAULT true,
  attendant_name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.camed_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.camed_slots TO authenticated;
GRANT ALL ON public.camed_slots TO service_role;
ALTER TABLE public.camed_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots_select_all" ON public.camed_slots FOR SELECT USING (true);
CREATE POLICY "slots_camed_write" ON public.camed_slots FOR INSERT TO authenticated WITH CHECK (is_camed_president(auth.uid()) OR is_admin_master(auth.uid()));
CREATE POLICY "slots_camed_update" ON public.camed_slots FOR UPDATE TO authenticated USING (is_camed_president(auth.uid()) OR is_admin_master(auth.uid()));
CREATE POLICY "slots_camed_delete" ON public.camed_slots FOR DELETE TO authenticated USING (is_camed_president(auth.uid()) OR is_admin_master(auth.uid()));

CREATE TRIGGER trg_camed_slots_upd BEFORE UPDATE ON public.camed_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agendamentos
CREATE TABLE IF NOT EXISTS public.camed_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL UNIQUE REFERENCES public.camed_slots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modality text NOT NULL CHECK (modality IN ('online','presencial')),
  reason text NOT NULL,
  extra_participants text,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.camed_bookings TO authenticated;
GRANT ALL ON public.camed_bookings TO service_role;
ALTER TABLE public.camed_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bk_camed_select" ON public.camed_bookings FOR SELECT TO authenticated USING (is_camed_president(auth.uid()) OR is_admin_master(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "bk_user_insert" ON public.camed_bookings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bk_user_delete" ON public.camed_bookings FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_camed_president(auth.uid()) OR is_admin_master(auth.uid()));
