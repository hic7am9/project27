/*
# Fix admin dashboard stats to use proper admin guard

Previous version used is_admin() inside FILTER which is incorrect because is_admin()
is a stable scalar — it returns the same value for all rows. Use a CASE guard instead.
*/

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  total_users bigint,
  new_today bigint,
  new_7d bigint,
  new_30d bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT
      count(*)::bigint AS total_users,
      count(*) FILTER (WHERE created_at >= now() - interval '1 day')::bigint AS new_today,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::bigint AS new_7d,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::bigint AS new_30d
    FROM public.profiles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
