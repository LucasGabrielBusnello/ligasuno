
-- Tabela de agenda/atividades agendadas (diretores criam, ligantes visualizam)
CREATE TABLE public.league_schedule_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  color TEXT NOT NULL DEFAULT '#1f5132',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.league_schedule_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_schedule_items TO authenticated;
GRANT ALL ON public.league_schedule_items TO service_role;

ALTER TABLE public.league_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_select" ON public.league_schedule_items
FOR SELECT USING (true);

CREATE POLICY "schedule_manage" ON public.league_schedule_items
FOR ALL TO authenticated
USING (
  is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = league_schedule_items.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
)
WITH CHECK (
  is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = league_schedule_items.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
);
