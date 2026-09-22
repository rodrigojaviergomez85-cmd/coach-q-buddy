ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','senior') AND active)
$function$;