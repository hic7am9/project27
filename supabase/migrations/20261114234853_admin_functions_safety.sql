/*
# Add admin checks to admin RPC functions

The get_admin_user_stats() and get_admin_dashboard_stats() functions are SECURITY DEFINER
and callable by any authenticated user via RPC. Add an is_admin() check inside each so
non-admins get an empty result instead of seeing all users' data.
*/

CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  apartment_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.created_at,
    p.last_sign_in_at,
    COALESCE(a.cnt, 0) AS apartment_count
  FROM public.profiles p
  LEFT JOIN (
    SELECT user_id, count(*) AS cnt
    FROM public.apartments
    GROUP BY user_id
  ) a ON a.user_id = p.id
  WHERE public.is_admin()
  ORDER BY p.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_user_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  total_users bigint,
  new_today bigint,
  new_7d bigint,
  new_30d bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE public.is_admin())::bigint AS total_users,
    count(*) FILTER (WHERE created_at >= now() - interval '1 day' AND public.is_admin())::bigint AS new_today,
    count(*) FILTER (WHERE created_at >= now() - interval '7 days' AND public.is_admin())::bigint AS new_7d,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND public.is_admin())::bigint AS new_30d
  FROM public.profiles;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
