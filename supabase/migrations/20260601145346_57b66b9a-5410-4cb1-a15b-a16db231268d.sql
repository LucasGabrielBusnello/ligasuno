
REVOKE EXECUTE ON FUNCTION public.mark_overdue_semester_payments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_semester_payments() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_semester_payments() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_semester_payments() TO service_role;
