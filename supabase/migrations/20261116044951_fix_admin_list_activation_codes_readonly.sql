/*
# Make admin_list_activation_codes read-only

1. Problem
- The function was declared STABLE but executed expire_stale_codes() (an UPDATE).
- PostgREST runs RPC calls in a read-only transaction, so any call failed with
  "cannot execute UPDATE in a read-only transaction".

2. Fix
- admin_list_activation_codes is now a pure SELECT. Codes past their expires_at
  are reported with an effective status 'expired' computed in the query itself
  (no data is modified). Row shape is unchanged, so the frontend needs no edits.
- expire_stale_codes() stays available (VOLATILE) but is no longer called here.
- Admin-only checks unchanged: the function keeps is_admin() guard (SECURITY
  DEFINER) and its EXECUTE grants stay revoked from PUBLIC/anon.
*/

CREATE OR REPLACE FUNCTION public.admin_list_activation_codes()
RETURNS TABLE (
  id uuid, code_prefix text, duration_days integer, status text,
  used_by_email text, used_at timestamptz, expires_at timestamptz,
  note text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.code_prefix,
    c.duration_days,
    CASE
      WHEN c.status = 'unused' AND c.expires_at IS NOT NULL AND c.expires_at < now() THEN 'expired'
      ELSE c.status
    END::text AS status,
    c.used_by_email,
    c.used_at,
    c.expires_at,
    c.note,
    c.created_at
  FROM public.activation_codes c
  ORDER BY c.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_activation_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_activation_codes() TO authenticated;
