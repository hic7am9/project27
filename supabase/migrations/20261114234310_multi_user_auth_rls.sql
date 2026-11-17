/*
# Multi-user: profiles, user_id columns, RLS, admin functions

Converts the single-tenant property management app into a multi-user app where
each user has isolated data. Also adds admin infrastructure.

## 1. New Tables
- `profiles`: one row per auth user, auto-created by trigger on signup.
  - id, full_name, email, role (default 'user'), last_sign_in_at, created_at

## 2. Modified Tables — user_id columns added
- locations, apartments, bookings, guests_archive, ical_sync,
  deleted_bookings, cleaners, cleaner_assignments: add user_id column
  referencing auth.users, DEFAULT auth.uid() for new inserts.

## 3. Triggers
- handle_new_user: after insert on auth.users, creates a profiles row.
- update_last_sign_in_at: updates profiles.last_sign_in_at on auth login.

## 4. RLS — replace all existing policies with owner-scoped ones
Each user can only access their own rows (user_id = auth.uid()).

## 5. Admin infrastructure
- is_admin() SECURITY DEFINER function
- get_admin_user_stats() SECURITY DEFINER function: user list + apartment counts
- get_admin_dashboard_stats() SECURITY DEFINER function: total/new user counts
- profiles: admin can read ALL profiles; users read only their own.
*/

-- ============ profiles table ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  last_sign_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============ is_admin() function (defined before policies that use it) ============
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============ profiles grants and policies ============
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON profiles TO service_role;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name) ON profiles TO authenticated;

-- ============ handle_new_user trigger ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ update_last_sign_in_at trigger ============
CREATE OR REPLACE FUNCTION public.update_last_sign_in_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.profiles SET last_sign_in_at = NEW.last_sign_in_at WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.update_last_sign_in_at();

-- ============ Add user_id to existing tables ============
ALTER TABLE locations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE locations ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE apartments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE apartments ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bookings ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE guests_archive ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE guests_archive ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE ical_sync ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ical_sync ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE deleted_bookings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE deleted_bookings ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE cleaners ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE cleaner_assignments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE cleaner_assignments ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_apartments_user ON apartments(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_guests_archive_user ON guests_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_ical_sync_user ON ical_sync(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_bookings_user ON deleted_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_cleaners_user ON cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_assignments_user ON cleaner_assignments(user_id);

-- ============ Admin functions (after user_id columns exist) ============
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
    count(*)::bigint AS total_users,
    count(*) FILTER (WHERE created_at >= now() - interval '1 day')::bigint AS new_today,
    count(*) FILTER (WHERE created_at >= now() - interval '7 days')::bigint AS new_7d,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days')::bigint AS new_30d
  FROM public.profiles;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- ============ Replace RLS policies on all existing tables ============

-- ---------- locations ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON locations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO service_role;

DROP POLICY IF EXISTS "anon_select_locations" ON locations;
DROP POLICY IF EXISTS "anon_insert_locations" ON locations;
DROP POLICY IF EXISTS "anon_update_locations" ON locations;
DROP POLICY IF EXISTS "anon_delete_locations" ON locations;

DROP POLICY IF EXISTS "select_own_locations" ON locations;
CREATE POLICY "select_own_locations" ON locations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_locations" ON locations;
CREATE POLICY "insert_own_locations" ON locations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_locations" ON locations;
CREATE POLICY "update_own_locations" ON locations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_locations" ON locations;
CREATE POLICY "delete_own_locations" ON locations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- apartments ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON apartments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON apartments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON apartments TO service_role;

DROP POLICY IF EXISTS "anon_select_apartments" ON apartments;
DROP POLICY IF EXISTS "anon_insert_apartments" ON apartments;
DROP POLICY IF EXISTS "anon_update_apartments" ON apartments;
DROP POLICY IF EXISTS "anon_delete_apartments" ON apartments;

DROP POLICY IF EXISTS "select_own_apartments" ON apartments;
CREATE POLICY "select_own_apartments" ON apartments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_apartments" ON apartments;
CREATE POLICY "insert_own_apartments" ON apartments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_apartments" ON apartments;
CREATE POLICY "update_own_apartments" ON apartments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_apartments" ON apartments;
CREATE POLICY "delete_own_apartments" ON apartments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- bookings ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON bookings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookings TO service_role;

DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_delete_bookings" ON bookings;

DROP POLICY IF EXISTS "select_own_bookings" ON bookings;
CREATE POLICY "select_own_bookings" ON bookings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bookings" ON bookings;
CREATE POLICY "insert_own_bookings" ON bookings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bookings" ON bookings;
CREATE POLICY "update_own_bookings" ON bookings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bookings" ON bookings;
CREATE POLICY "delete_own_bookings" ON bookings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- guests_archive ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON guests_archive FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guests_archive TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guests_archive TO service_role;

DROP POLICY IF EXISTS "anon_select_guests_archive" ON guests_archive;
DROP POLICY IF EXISTS "anon_insert_guests_archive" ON guests_archive;
DROP POLICY IF EXISTS "anon_update_guests_archive" ON guests_archive;
DROP POLICY IF EXISTS "anon_delete_guests_archive" ON guests_archive;

DROP POLICY IF EXISTS "select_own_guests_archive" ON guests_archive;
CREATE POLICY "select_own_guests_archive" ON guests_archive FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_guests_archive" ON guests_archive;
CREATE POLICY "insert_own_guests_archive" ON guests_archive FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_guests_archive" ON guests_archive;
CREATE POLICY "update_own_guests_archive" ON guests_archive FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_guests_archive" ON guests_archive;
CREATE POLICY "delete_own_guests_archive" ON guests_archive FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- ical_sync ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON ical_sync FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ical_sync TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ical_sync TO service_role;

DROP POLICY IF EXISTS "anon_select_ical_sync" ON ical_sync;
DROP POLICY IF EXISTS "anon_insert_ical_sync" ON ical_sync;
DROP POLICY IF EXISTS "anon_update_ical_sync" ON ical_sync;
DROP POLICY IF EXISTS "anon_delete_ical_sync" ON ical_sync;

DROP POLICY IF EXISTS "select_own_ical_sync" ON ical_sync;
CREATE POLICY "select_own_ical_sync" ON ical_sync FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ical_sync" ON ical_sync;
CREATE POLICY "insert_own_ical_sync" ON ical_sync FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ical_sync" ON ical_sync;
CREATE POLICY "update_own_ical_sync" ON ical_sync FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ical_sync" ON ical_sync;
CREATE POLICY "delete_own_ical_sync" ON ical_sync FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- deleted_bookings ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON deleted_bookings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deleted_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deleted_bookings TO service_role;

DROP POLICY IF EXISTS "anon_select_blocked_uids" ON deleted_bookings;
DROP POLICY IF EXISTS "anon_insert_blocked_uids" ON deleted_bookings;
DROP POLICY IF EXISTS "anon_update_blocked_uids" ON deleted_bookings;
DROP POLICY IF EXISTS "anon_delete_blocked_uids" ON deleted_bookings;

DROP POLICY IF EXISTS "select_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "select_own_deleted_bookings" ON deleted_bookings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "insert_own_deleted_bookings" ON deleted_bookings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "update_own_deleted_bookings" ON deleted_bookings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "delete_own_deleted_bookings" ON deleted_bookings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- cleaners ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON cleaners FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cleaners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cleaners TO service_role;

DROP POLICY IF EXISTS "anon_select_cleaners" ON cleaners;
DROP POLICY IF EXISTS "anon_insert_cleaners" ON cleaners;
DROP POLICY IF EXISTS "anon_update_cleaners" ON cleaners;
DROP POLICY IF EXISTS "anon_delete_cleaners" ON cleaners;

DROP POLICY IF EXISTS "select_own_cleaners" ON cleaners;
CREATE POLICY "select_own_cleaners" ON cleaners FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cleaners" ON cleaners;
CREATE POLICY "insert_own_cleaners" ON cleaners FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cleaners" ON cleaners;
CREATE POLICY "update_own_cleaners" ON cleaners FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cleaners" ON cleaners;
CREATE POLICY "delete_own_cleaners" ON cleaners FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- cleaner_assignments ----------
REVOKE SELECT, INSERT, UPDATE, DELETE ON cleaner_assignments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cleaner_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cleaner_assignments TO service_role;

DROP POLICY IF EXISTS "anon_select_cleaner_assignments" ON cleaner_assignments;
DROP POLICY IF EXISTS "anon_insert_cleaner_assignments" ON cleaner_assignments;
DROP POLICY IF EXISTS "anon_update_cleaner_assignments" ON cleaner_assignments;
DROP POLICY IF EXISTS "anon_delete_cleaner_assignments" ON cleaner_assignments;

DROP POLICY IF EXISTS "select_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "select_own_cleaner_assignments" ON cleaner_assignments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "insert_own_cleaner_assignments" ON cleaner_assignments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "update_own_cleaner_assignments" ON cleaner_assignments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "delete_own_cleaner_assignments" ON cleaner_assignments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
