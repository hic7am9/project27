/*
# Security fixes: revoke EXECUTE on trigger functions, fix search_path

1. Revoke EXECUTE on handle_new_user() and update_last_sign_in_at() from PUBLIC and anon.
   These are trigger functions — they should only be called by the trigger, not via RPC.
2. Revoke EXECUTE on update_updated_at() from PUBLIC (it's a trigger function).
3. Fix search_path on update_updated_at() to be explicit.
4. The admin functions (get_admin_user_stats, get_admin_dashboard_stats) already have
   REVOKE from PUBLIC/anon and GRANT to authenticated only. They use SECURITY DEFINER
   with is_admin() check inside. This is intentional — they need to be callable via RPC
   by authenticated users, but the functions check is_admin() internally.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_last_sign_in_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon;

-- Fix search_path on update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
