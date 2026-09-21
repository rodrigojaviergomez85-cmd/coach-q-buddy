
-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'coordinador' CHECK (role IN ('coordinador','senior','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- role helper (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.app_current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public."current_role"()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active)
$$;

CREATE OR REPLACE FUNCTION public.is_senior_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('senior','admin') AND active)
$$;

CREATE POLICY "profiles_select_own_or_privileged" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_senior_or_admin());
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin());

-- link/create profile on signup (respects a pre-existing profile by email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM public.profiles WHERE lower(email) = lower(NEW.email);
  IF existing_id IS NOT NULL THEN
    IF existing_id <> NEW.id THEN
      UPDATE public.profiles SET id = NEW.id WHERE id = existing_id;
    END IF;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NULL), 'coordinador');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ coaches ============
CREATE TABLE public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  coordinator_id uuid REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  senior_name text,
  lob text,
  level text,
  schedule text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX coaches_full_name_key ON public.coaches (lower(full_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches TO authenticated;
GRANT ALL ON public.coaches TO service_role;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER coaches_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "coaches_select" ON public.coaches FOR SELECT TO authenticated
  USING (coordinator_id = auth.uid() OR public.is_senior_or_admin());
CREATE POLICY "coaches_insert" ON public.coaches FOR INSERT TO authenticated
  WITH CHECK (coordinator_id = auth.uid() OR public.is_senior_or_admin());
CREATE POLICY "coaches_update" ON public.coaches FOR UPDATE TO authenticated
  USING (coordinator_id = auth.uid() OR public.is_senior_or_admin())
  WITH CHECK (coordinator_id = auth.uid() OR public.is_senior_or_admin());
CREATE POLICY "coaches_delete" ON public.coaches FOR DELETE TO authenticated
  USING (coordinator_id = auth.uid() OR public.is_admin());

-- ============ templates ============
CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  source_sheet text,
  scoring text CHECK (scoring IN ('points_sum','area_weighted','checklist')),
  subject text DEFAULT 'coach',
  active boolean NOT NULL DEFAULT true,
  has_student_grid boolean NOT NULL DEFAULT false,
  notes text,
  sort_order int DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_read" ON public.templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_write" ON public.templates FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.templates(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('item','checklist','penalty','bonus')),
  sort_order int DEFAULT 0,
  section text,
  area text,
  ss text,
  item_number text,
  short_label text,
  description text NOT NULL,
  points numeric,
  area_points numeric,
  penalty_kind text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_items TO authenticated;
GRANT ALL ON public.template_items TO service_role;
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_items_read" ON public.template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "template_items_write" ON public.template_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ monitorings ============
CREATE TABLE public.monitorings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
  coordinator_id uuid REFERENCES public.profiles(id) ON UPDATE CASCADE,
  template_id uuid REFERENCES public.templates(id),
  qa_date date DEFAULT current_date,
  class_date date,
  syllabus text,
  schedule text,
  level text,
  zoom_link text,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','enviado')),
  transcript_raw text,
  transcript_metrics jsonb,
  base_score numeric,
  bonus_total numeric,
  penalty_applied boolean NOT NULL DEFAULT false,
  final_score numeric,
  result_phrase text,
  customer_expectation text,
  kudos jsonb NOT NULL DEFAULT '[]',
  aois jsonb NOT NULL DEFAULT '[]',
  main_aoi text,
  previous_aois jsonb NOT NULL DEFAULT '[]',
  general_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitorings TO authenticated;
GRANT ALL ON public.monitorings TO service_role;
ALTER TABLE public.monitorings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER monitorings_updated_at BEFORE UPDATE ON public.monitorings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "monitorings_select" ON public.monitorings FOR SELECT TO authenticated
  USING (coordinator_id = auth.uid() OR public.is_senior_or_admin());
CREATE POLICY "monitorings_insert" ON public.monitorings FOR INSERT TO authenticated
  WITH CHECK (coordinator_id = auth.uid() OR public.is_admin());
CREATE POLICY "monitorings_update" ON public.monitorings FOR UPDATE TO authenticated
  USING (coordinator_id = auth.uid() OR public.is_admin())
  WITH CHECK (coordinator_id = auth.uid() OR public.is_admin());
CREATE POLICY "monitorings_delete" ON public.monitorings FOR DELETE TO authenticated
  USING (coordinator_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.can_read_monitoring(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.monitorings m WHERE m.id = _id
    AND (m.coordinator_id = auth.uid() OR public.is_senior_or_admin()))
$$;
CREATE OR REPLACE FUNCTION public.can_write_monitoring(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.monitorings m WHERE m.id = _id
    AND (m.coordinator_id = auth.uid() OR public.is_admin()))
$$;

CREATE TABLE public.monitoring_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoring_id uuid NOT NULL REFERENCES public.monitorings(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.template_items(id) ON DELETE CASCADE,
  result text NOT NULL DEFAULT 'na' CHECK (result IN ('si','no','na')),
  score numeric,
  comment text,
  UNIQUE (monitoring_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_answers TO authenticated;
GRANT ALL ON public.monitoring_answers TO service_role;
ALTER TABLE public.monitoring_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers_select" ON public.monitoring_answers FOR SELECT TO authenticated
  USING (public.can_read_monitoring(monitoring_id));
CREATE POLICY "answers_write" ON public.monitoring_answers FOR ALL TO authenticated
  USING (public.can_write_monitoring(monitoring_id))
  WITH CHECK (public.can_write_monitoring(monitoring_id));

CREATE TABLE public.monitoring_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoring_id uuid NOT NULL REFERENCES public.monitorings(id) ON DELETE CASCADE,
  student_number int,
  student_name text,
  gr numeric, pr numeric, fl numeric, co numeric, "in" numeric,
  score numeric,
  phrase text,
  goal boolean,
  coach_phrase text,
  comment text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_students TO authenticated;
GRANT ALL ON public.monitoring_students TO service_role;
ALTER TABLE public.monitoring_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_select" ON public.monitoring_students FOR SELECT TO authenticated
  USING (public.can_read_monitoring(monitoring_id));
CREATE POLICY "students_write" ON public.monitoring_students FOR ALL TO authenticated
  USING (public.can_write_monitoring(monitoring_id))
  WITH CHECK (public.can_write_monitoring(monitoring_id));

-- ============ app_config ============
CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb,
  description text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_config_read" ON public.app_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_config_write" ON public.app_config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.app_config (key, value, description) VALUES
 ('monthly_target', '2'::jsonb, 'Monitoreos meta por coach al mes'),
 ('talk_time_green', '70'::jsonb, '% mínimo de tiempo de alumnos para verde'),
 ('talk_time_yellow', '55'::jsonb, '% mínimo de tiempo de alumnos para amarillo; abajo es rojo'),
 ('student_min_pct', '8'::jsonb, '% mínimo del tiempo de alumnos que debería tener cada alumno'),
 ('bonus_points_each', '1'::jsonb, 'Puntos que suma cada bonus marcado'),
 ('penalty_cap', '5'::jsonb, 'Puntaje máximo si aplica una penalidad'),
 ('score_phrases', '[{"min":10,"phrase":"Excellent Plus"},{"min":9,"phrase":"Excellent"},{"min":8,"phrase":"Well Done"},{"min":7,"phrase":"Almost There"},{"min":0,"phrase":"Needs Improvement"}]'::jsonb, 'Frases de resultado según puntaje'),
 ('expectation_phrases', '[{"min":9,"phrase":"Exceeded expectations"},{"min":7,"phrase":"Met expectations"},{"min":0,"phrase":"Below expectations"}]'::jsonb, 'Frases de expectativa del cliente según puntaje');

-- semilla admin
INSERT INTO public.profiles (email, full_name, role, active)
VALUES ('english4callcenters@gmail.com', 'Rodrigo', 'admin', true)
ON CONFLICT (email) DO UPDATE SET role = 'admin', full_name = 'Rodrigo', active = true;
