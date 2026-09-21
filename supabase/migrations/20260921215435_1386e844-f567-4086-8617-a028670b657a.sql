
CREATE OR REPLACE FUNCTION public.email_is_authorized(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(trim(_email)) AND active
  )
$$;
REVOKE EXECUTE ON FUNCTION public.email_is_authorized(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_is_authorized(text) TO anon, authenticated;
