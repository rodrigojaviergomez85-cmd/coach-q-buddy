
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_current_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public."current_role"() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_senior_or_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_monitoring(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_monitoring(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public."current_role"() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_senior_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_monitoring(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_monitoring(uuid) TO authenticated;
