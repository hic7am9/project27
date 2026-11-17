/*
# Add phone column to profiles table

1. Changes
- Added `phone` column (text, nullable) to `profiles` table.
- Updated `handle_new_user()` trigger to copy phone from `raw_user_meta_data->>'phone'` on signup.
- Granted UPDATE on `phone` column to `authenticated` so users can update their own phone.
- Dropped and recreated `get_admin_user_stats()` to include `phone` in return type.

2. Security
- No RLS policy changes — existing `update_own_profile` policy already restricts updates to own row.
- Column-level grant: `GRANT UPDATE (full_name, phone) ON profiles TO authenticated`.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, phone) ON profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.get_admin_user_stats();

CREATE FUNCTION public.get_admin_user_stats()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
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
    p.phone,
    p.created_at,
    p.last_sign_in_at,
    COALESCE(a.cnt, 0) AS apartment_count
  FROM public.profiles p
  LEFT JOIN (
    SELECT user_id, count(*) AS cnt
    FROM public.apartments
    GROUP BY user_id
  ) a ON a.user_id = p.id
  ORDER BY p.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_user_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_stats() TO authenticated;
