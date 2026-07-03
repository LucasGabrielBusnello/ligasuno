
-- Allow diretors to manage events, registrations, certificate templates, and minicourse exclusive slots

-- league_events: diretor can manage
DROP POLICY IF EXISTS events_manage ON public.league_events;
CREATE POLICY events_manage ON public.league_events
FOR ALL
USING (
  is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_events.league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = league_events.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
)
WITH CHECK (
  is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_events.league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = league_events.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
);

-- event_registrations: diretor can select and update
DROP POLICY IF EXISTS reg_select_own_or_president ON public.event_registrations;
CREATE POLICY reg_select_own_or_president ON public.event_registrations
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_admin_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM league_events e JOIN leagues l ON l.id = e.league_id
    WHERE e.id = event_registrations.event_id AND l.president_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM league_events e JOIN league_memberships m ON m.league_id = e.league_id
    WHERE e.id = event_registrations.event_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role
  )
);

DROP POLICY IF EXISTS reg_update_own_or_president ON public.event_registrations;
CREATE POLICY reg_update_own_or_president ON public.event_registrations
FOR UPDATE
USING (
  user_id = auth.uid()
  OR is_admin_master(auth.uid())
  OR EXISTS (
    SELECT 1 FROM league_events e JOIN leagues l ON l.id = e.league_id
    WHERE e.id = event_registrations.event_id AND l.president_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM league_events e JOIN league_memberships m ON m.league_id = e.league_id
    WHERE e.id = event_registrations.event_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role
  )
);

-- league_certificate_templates: diretor can manage + select
DROP POLICY IF EXISTS certificate_templates_manage ON public.league_certificate_templates;
CREATE POLICY certificate_templates_manage ON public.league_certificate_templates
FOR ALL
USING (
  is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_certificate_templates.league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = league_certificate_templates.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
)
WITH CHECK (
  is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_certificate_templates.league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = league_certificate_templates.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
);

DROP POLICY IF EXISTS certificate_templates_select ON public.league_certificate_templates;
CREATE POLICY certificate_templates_select ON public.league_certificate_templates
FOR SELECT
USING (
  is_admin_master(auth.uid())
  OR EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_certificate_templates.league_id AND l.president_id = auth.uid())
  OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = league_certificate_templates.league_id AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role)
);

-- minicourse_exclusive_slots: diretor can manage
DROP POLICY IF EXISTS exclusive_slots_manage_by_organizer ON public.minicourse_exclusive_slots;
CREATE POLICY exclusive_slots_manage_by_organizer ON public.minicourse_exclusive_slots
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM league_minicourses mc
    JOIN league_events le ON le.id = mc.event_id
    JOIN leagues l ON l.id = le.league_id
    WHERE mc.id = minicourse_exclusive_slots.minicourse_id
      AND (l.president_id = auth.uid() OR is_admin_master(auth.uid()))
  )
  OR EXISTS (
    SELECT 1 FROM league_minicourses mc
    JOIN league_events le ON le.id = mc.event_id
    JOIN league_memberships m ON m.league_id = le.league_id
    WHERE mc.id = minicourse_exclusive_slots.minicourse_id
      AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM league_minicourses mc
    JOIN league_events le ON le.id = mc.event_id
    JOIN leagues l ON l.id = le.league_id
    WHERE mc.id = minicourse_exclusive_slots.minicourse_id
      AND (l.president_id = auth.uid() OR is_admin_master(auth.uid()))
  )
  OR EXISTS (
    SELECT 1 FROM league_minicourses mc
    JOIN league_events le ON le.id = mc.event_id
    JOIN league_memberships m ON m.league_id = le.league_id
    WHERE mc.id = minicourse_exclusive_slots.minicourse_id
      AND m.user_id = auth.uid() AND m.role = 'diretor'::app_role
  )
);
