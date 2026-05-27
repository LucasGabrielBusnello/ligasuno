
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin_master', 'presidente', 'diretor', 'ligante', 'visitante');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT username_len CHECK (char_length(username) <= 30 AND char_length(username) >= 2)
);
CREATE INDEX idx_profiles_username ON public.profiles(lower(username));
CREATE INDEX idx_profiles_email ON public.profiles(lower(email));
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- GLOBAL ADMIN ROLES (separate to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin_master')
$$;

-- LEAGUES
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  theme_color TEXT NOT NULL DEFAULT '#1f5132',
  president_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  paid_until DATE,
  initial_setup_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leagues_slug ON public.leagues(lower(slug));
GRANT SELECT ON public.leagues TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leagues_select_all" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "leagues_admin_insert" ON public.leagues FOR INSERT TO authenticated WITH CHECK (public.is_admin_master(auth.uid()));
CREATE POLICY "leagues_update" ON public.leagues FOR UPDATE TO authenticated USING (
  public.is_admin_master(auth.uid()) OR president_id = auth.uid()
);
CREATE POLICY "leagues_admin_delete" ON public.leagues FOR DELETE TO authenticated USING (public.is_admin_master(auth.uid()));

-- LEAGUE MEMBERSHIPS
CREATE TABLE public.league_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'visitante',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);
GRANT SELECT ON public.league_memberships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_memberships TO authenticated;
GRANT ALL ON public.league_memberships TO service_role;
ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_select_all" ON public.league_memberships FOR SELECT USING (true);
CREATE POLICY "memberships_manage" ON public.league_memberships FOR ALL TO authenticated USING (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
) WITH CHECK (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
);

-- CAMED INFO (singleton)
CREATE TABLE public.camed_info (
  id INTEGER PRIMARY KEY DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'CAMED',
  subtitle TEXT NOT NULL DEFAULT 'Centro Acadêmico de Medicina da Unochapecó',
  description TEXT NOT NULL DEFAULT 'O Centro Acadêmico de Medicina representa os estudantes do curso, organizando eventos, defendendo direitos e fomentando a integração acadêmica.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.camed_info (id) VALUES (1);
GRANT SELECT ON public.camed_info TO anon, authenticated;
GRANT UPDATE ON public.camed_info TO authenticated;
GRANT ALL ON public.camed_info TO service_role;
ALTER TABLE public.camed_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camed_info_select" ON public.camed_info FOR SELECT USING (true);
CREATE POLICY "camed_info_update_admin" ON public.camed_info FOR UPDATE TO authenticated USING (public.is_admin_master(auth.uid()));

-- CAMED MEMBERS
CREATE TABLE public.camed_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.camed_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.camed_members TO authenticated;
GRANT ALL ON public.camed_members TO service_role;
ALTER TABLE public.camed_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camed_members_select" ON public.camed_members FOR SELECT USING (true);
CREATE POLICY "camed_members_admin" ON public.camed_members FOR ALL TO authenticated USING (public.is_admin_master(auth.uid())) WITH CHECK (public.is_admin_master(auth.uid()));

-- LEAGUE EVENTS
CREATE TABLE public.league_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  registration_link TEXT,
  event_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_events TO authenticated;
GRANT ALL ON public.league_events TO service_role;
ALTER TABLE public.league_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON public.league_events FOR SELECT USING (true);
CREATE POLICY "events_manage" ON public.league_events FOR ALL TO authenticated USING (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
) WITH CHECK (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
);

-- LEAGUE CONTENT (customizable text blocks per league)
CREATE TABLE public.league_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  content_key TEXT NOT NULL,
  content_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, content_key)
);
GRANT SELECT ON public.league_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_content TO authenticated;
GRANT ALL ON public.league_content TO service_role;
ALTER TABLE public.league_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_select" ON public.league_content FOR SELECT USING (true);
CREATE POLICY "content_manage" ON public.league_content FOR ALL TO authenticated USING (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
) WITH CHECK (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
);

-- NOTIFICATIONS (per league)
CREATE TABLE public.league_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_notifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.league_notifications TO authenticated;
GRANT ALL ON public.league_notifications TO service_role;
ALTER TABLE public.league_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select" ON public.league_notifications FOR SELECT USING (true);
CREATE POLICY "notif_manage" ON public.league_notifications FOR ALL TO authenticated USING (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
) WITH CHECK (
  public.is_admin_master(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.president_id = auth.uid())
);

-- APP SETTINGS (singleton: annual fee, etc.)
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  annual_fee_credit_monthly NUMERIC(10,2) NOT NULL DEFAULT 9.80,
  annual_fee_pix_monthly NUMERIC(10,2) NOT NULL DEFAULT 7.90,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.app_settings (id) VALUES (1);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_update_admin" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin_master(auth.uid()));

-- Trigger: auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  -- Ensure uniqueness with suffix if collision
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) LOOP
    v_username := v_username || floor(random()*1000)::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, email, phone, full_name)
  VALUES (
    NEW.id,
    v_username,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- View: public leagues (published AND paid_until >= today)
CREATE OR REPLACE VIEW public.public_leagues AS
SELECT * FROM public.leagues
WHERE published = true AND paid_until IS NOT NULL AND paid_until >= CURRENT_DATE;
GRANT SELECT ON public.public_leagues TO anon, authenticated;
