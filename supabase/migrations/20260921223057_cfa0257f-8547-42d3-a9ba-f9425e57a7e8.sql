REVOKE EXECUTE ON FUNCTION public.get_report_by_token(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_by_token(uuid) TO service_role;