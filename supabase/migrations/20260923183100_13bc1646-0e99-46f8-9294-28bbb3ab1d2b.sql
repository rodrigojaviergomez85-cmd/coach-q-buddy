CREATE TABLE public.coach_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coordinator_id, coach_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_assignments TO authenticated;
GRANT ALL ON public.coach_assignments TO service_role;
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY coach_assignments_select ON public.coach_assignments FOR SELECT TO authenticated
  USING (public.is_admin() OR coordinator_id = auth.uid() OR coach_id = auth.uid());
CREATE POLICY coach_assignments_write ON public.coach_assignments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());