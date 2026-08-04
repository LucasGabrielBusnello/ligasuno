
CREATE TABLE public.ifmsa_panel_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifmsa_panel_access TO authenticated;
GRANT ALL ON public.ifmsa_panel_access TO service_role;
ALTER TABLE public.ifmsa_panel_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_ifmsa_panel_tab(_user_id uuid, _tab text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin_master')
      OR EXISTS (
        SELECT 1 FROM public.ifmsa_panel_access a
        JOIN public.profiles p ON lower(p.email) = lower(a.email)
        WHERE p.id = _user_id AND _tab = ANY(a.permissions)
      );
$$;

CREATE OR REPLACE FUNCTION public.has_ifmsa_panel_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin_master')
      OR EXISTS (
        SELECT 1 FROM public.ifmsa_panel_access a
        JOIN public.profiles p ON lower(p.email) = lower(a.email)
        WHERE p.id = _user_id AND array_length(a.permissions, 1) > 0
      );
$$;

CREATE POLICY "ifmsa_access_read" ON public.ifmsa_panel_access FOR SELECT TO authenticated
  USING (public.has_ifmsa_panel_access(auth.uid()));
CREATE POLICY "ifmsa_access_admin" ON public.ifmsa_panel_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master')) WITH CHECK (public.has_role(auth.uid(), 'admin_master'));

CREATE TABLE public.ifmsa_info (
  id integer PRIMARY KEY DEFAULT 1,
  title text NOT NULL DEFAULT 'IFMSA Brazil Unochapecó',
  subtitle text,
  description text,
  hero_image_url text,
  logo_url text,
  cartilha_url text,
  cartilha_title text DEFAULT 'Cartilha do Calouro',
  cartilha_cta text DEFAULT 'Chegou agora na universidade? Comece por aqui',
  cartilha_description text,
  instagram_url text,
  whatsapp_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ifmsa_info TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifmsa_info TO authenticated;
GRANT ALL ON public.ifmsa_info TO service_role;
ALTER TABLE public.ifmsa_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ifmsa_info_public_read" ON public.ifmsa_info FOR SELECT USING (true);
CREATE POLICY "ifmsa_info_manage" ON public.ifmsa_info FOR ALL TO authenticated
  USING (public.has_ifmsa_panel_tab(auth.uid(), 'info')) WITH CHECK (public.has_ifmsa_panel_tab(auth.uid(), 'info'));

CREATE TABLE public.ifmsa_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  full_name text,
  short_description text,
  description text,
  color text NOT NULL DEFAULT '#0a8f4a',
  emoji text DEFAULT '🐱',
  image_url text,
  links jsonb NOT NULL DEFAULT '[]',
  highlights jsonb NOT NULL DEFAULT '[]',
  is_exchange boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ifmsa_sectors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifmsa_sectors TO authenticated;
GRANT ALL ON public.ifmsa_sectors TO service_role;
ALTER TABLE public.ifmsa_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ifmsa_sectors_public_read" ON public.ifmsa_sectors FOR SELECT USING (true);
CREATE POLICY "ifmsa_sectors_manage" ON public.ifmsa_sectors FOR ALL TO authenticated
  USING (public.has_ifmsa_panel_tab(auth.uid(), 'setores')) WITH CHECK (public.has_ifmsa_panel_tab(auth.uid(), 'setores'));

CREATE TABLE public.ifmsa_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  acronym text,
  description text,
  image_url text,
  sector_code text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ifmsa_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifmsa_members TO authenticated;
GRANT ALL ON public.ifmsa_members TO service_role;
ALTER TABLE public.ifmsa_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ifmsa_members_public_read" ON public.ifmsa_members FOR SELECT USING (true);
CREATE POLICY "ifmsa_members_manage" ON public.ifmsa_members FOR ALL TO authenticated
  USING (public.has_ifmsa_panel_tab(auth.uid(), 'diretoria')) WITH CHECK (public.has_ifmsa_panel_tab(auth.uid(), 'diretoria'));

CREATE TABLE public.ifmsa_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  location text,
  program text,
  quote text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ifmsa_testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifmsa_testimonials TO authenticated;
GRANT ALL ON public.ifmsa_testimonials TO service_role;
ALTER TABLE public.ifmsa_testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ifmsa_testimonials_public_read" ON public.ifmsa_testimonials FOR SELECT USING (true);
CREATE POLICY "ifmsa_testimonials_manage" ON public.ifmsa_testimonials FOR ALL TO authenticated
  USING (public.has_ifmsa_panel_tab(auth.uid(), 'intercambio')) WITH CHECK (public.has_ifmsa_panel_tab(auth.uid(), 'intercambio'));

INSERT INTO public.ifmsa_info (id, title, subtitle, description, logo_url, cartilha_url, cartilha_description)
VALUES (1,
 'IFMSA Brazil Unochapecó',
 'International Federation of Medical Students Associations',
 'A IFMSA Brazil é uma federação nacional filiada à IFMSA, federação internacional de estudantes de medicina. Nossos valores são Humanização, União, Ética, Equidade e Cidadania. Aqui em Chapecó, promovemos atividades acadêmicas, projetos sociais, ações em saúde, pesquisa e intercâmbios que complementam sua formação dentro e fora da universidade.',
 '/__l5e/assets-v1/173a69b8-60b6-4c90-a366-623759225d21/ifmsa-logo.jpeg',
 '/__l5e/assets-v1/5ed701b7-52e1-434b-8c3a-f2d2448eed6d/Cartilha_do_Calouro.pdf',
 'Um documento pensado para você que acabou de chegar na universidade e quer entender o universo dos iéficos: comitês, intercâmbios, atividades, siglas e muito mais.');

INSERT INTO public.ifmsa_sectors (code, name, full_name, short_description, description, color, emoji, is_exchange, display_order) VALUES
('SCOPE','SCOPE','Comitê Permanente de Intercâmbio Internacional Clínico-Cirúrgico','Estágios clínicos e cirúrgicos em mais de 130 países.','O SCOPE conecta estudantes de medicina do mundo todo por meio de estágios profissionais não remunerados em mais de 130 países, por 4 a 8 semanas. O PI (Período de Intercâmbios Internacionais) define os meses em que os classificados podem viajar, com etapas de inscrição, divulgação da lista final e confirmação de vaga.','#0f766e','🌍',true,1),
('SCORE','SCORE','Comitê Permanente de Intercâmbios de Pesquisa','Intercâmbios de pesquisa de 4 a 8 semanas.','O SCORE promove projetos de pesquisa e expande conhecimentos médicos globalmente. Intercâmbios de 4 a 8 semanas, com enriquecimento cultural, imersão médica, networking, desenvolvimento de habilidades e diferencial no currículo. Recomenda-se escolher uma área de pesquisa já estudada na graduação.','#1d4ed8','🔬',true,2),
('SCONE','SCONE','Comitê Permanente de Intercâmbios Nacionais','Intercâmbios em faculdades e hospitais de todo o Brasil.','O SCONE cuida do PIN (Período de Intercâmbio Nacional), com modalidades clínico-cirúrgica e pesquisa, em faculdades e hospitais de todo o Brasil, com duração de 2 a 4 semanas. Existem inscrições por pontuação (1ª etapa) e vagas remanescentes por ordem de inscrição.','#15803d','🇧🇷',true,3),
('SCOPH','SCOPH','Comitê Permanente de Saúde Pública','Promoção da saúde, prevenção e educação em saúde.','O SCOPH atua na promoção da saúde, prevenção de doenças e educação em saúde, indo além do hospital: determinantes sociais, saúde mental, doenças crônicas e infecciosas, sustentabilidade e políticas públicas. Na prática: Hospital do Ursinho, Projeto Vestibulandos, capacitações em primeiros socorros, campanhas e ações em escolas e comunidades.','#ca8a04','💚',false,4),
('SCORA','SCORA','Comitê Permanente de Saúde e Direitos Sexuais e Reprodutivos incluindo HIV e AIDS','Educação em saúde sexual, direitos reprodutivos e diversidade.','A SCORA atua em três pilares: educação em saúde sexual e reprodutiva; direitos reprodutivos (autonomia corporal, acesso a serviços e enfrentamento à violência de gênero); e diversidade e inclusão, com foco na saúde da população LGBTQIA+ e no combate ao estigma, sempre com base científica e sensibilidade social.','#db2777','🎗️',false,5),
('SCOME','SCOME','Comitê Permanente de Educação Médica','Qualidade e inovação na formação médica.','O SCOME trabalha para aprimorar a educação médica, discutindo currículo, metodologias de ensino, capacitações e o protagonismo estudantil na própria formação.','#7c3aed','📚',false,6),
('SCORP','SCORP','Comitê Permanente de Direitos Humanos e Paz','Direitos humanos, equidade e cultura de paz.','O SCORP promove ações em direitos humanos e paz, atuando com populações vulneráveis, refugiados, equidade social e conscientização sobre violações de direitos.','#0891b2','🕊️',false,7);
