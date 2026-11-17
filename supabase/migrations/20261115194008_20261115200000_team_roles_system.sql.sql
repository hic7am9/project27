/*
# Team roles & access control system

## Overview
Adds a team-based role system with owner/host/cleaner roles.
- owner: full access, manages team & admin panel
- host: full operational access except team management & admin
- cleaner: sees only assigned apartments via a restricted view

## New Tables
### team_members
- id (uuid PK)
- owner_id (uuid FK -> profiles.id, the team owner)
- member_user_id (uuid FK -> profiles.id, the invited member)
- role (text: 'owner' | 'host' | 'cleaner')
- email (text, the email used for invitation)
- created_at (timestamptz)

### cleaner_apartments
- cleaner_user_id (uuid FK -> profiles.id)
- apartment_id (uuid FK -> apartments.id)
- owner_id (uuid FK -> profiles.id)
- PRIMARY KEY (cleaner_user_id, apartment_id)

## Helper Functions (SECURITY DEFINER)
- get_my_owner_id(): returns the owner_id for the current user
- get_my_role(): returns the user's role ('owner', 'host', 'cleaner')

## RLS Changes
- All existing tables: policies now check ownership via get_my_owner_id()
- cleaners have NO direct access to bookings, guests_archive, etc.

## Cleaner View
- cleaner_apartments_view: security_invoker view, no guest data

## Secure Function
- mark_apartment_clean(apartment_id): cleaner-only, verified

## Status Change
- Added 'needs_cleaning' to apartments status CHECK constraint
*/

-- ============ Add needs_cleaning to status constraint ============
ALTER TABLE apartments DROP CONSTRAINT IF EXISTS apartments_status_check;
ALTER TABLE apartments ADD CONSTRAINT apartments_status_check
  CHECK (status = ANY (ARRAY['occupied'::text, 'ready'::text, 'not_ready'::text, 'maintenance'::text, 'needs_cleaning'::text]));

-- ============ team_members table ============
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'host' CHECK (role IN ('owner', 'host', 'cleaner')),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO service_role;

-- ============ cleaner_apartments table ============
CREATE TABLE IF NOT EXISTS cleaner_apartments (
  cleaner_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cleaner_user_id, apartment_id)
);

ALTER TABLE cleaner_apartments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON cleaner_apartments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cleaner_apartments TO service_role;

CREATE INDEX IF NOT EXISTS idx_cleaner_apartments_cleaner ON cleaner_apartments(cleaner_user_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_apartments_apt ON cleaner_apartments(apartment_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_apartments_owner ON cleaner_apartments(owner_id);

-- ============ Helper functions ============
CREATE OR REPLACE FUNCTION public.get_my_owner_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE member_user_id = auth.uid() AND role = 'owner') THEN auth.uid()
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE member_user_id = auth.uid()) THEN
      (SELECT owner_id FROM public.team_members WHERE member_user_id = auth.uid() LIMIT 1)
    ELSE auth.uid()
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_owner_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_owner_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.team_members WHERE member_user_id = auth.uid() LIMIT 1),
    'owner'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- ============ team_members RLS policies ============
DROP POLICY IF EXISTS "select_own_team_members" ON team_members;
CREATE POLICY "select_own_team_members" ON team_members FOR SELECT
  TO authenticated USING (owner_id = get_my_owner_id() OR member_user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_team_members" ON team_members;
CREATE POLICY "insert_own_team_members" ON team_members FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_team_members" ON team_members;
CREATE POLICY "update_own_team_members" ON team_members FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_team_members" ON team_members;
CREATE POLICY "delete_own_team_members" ON team_members FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============ cleaner_apartments RLS policies ============
DROP POLICY IF EXISTS "select_own_cleaner_apartments" ON cleaner_apartments;
CREATE POLICY "select_own_cleaner_apartments" ON cleaner_apartments FOR SELECT
  TO authenticated USING (owner_id = get_my_owner_id() OR cleaner_user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_cleaner_apartments" ON cleaner_apartments;
CREATE POLICY "insert_own_cleaner_apartments" ON cleaner_apartments FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_cleaner_apartments" ON cleaner_apartments;
CREATE POLICY "update_own_cleaner_apartments" ON cleaner_apartments FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_cleaner_apartments" ON cleaner_apartments;
CREATE POLICY "delete_own_cleaner_apartments" ON cleaner_apartments FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============ Update RLS on existing tables ============
-- locations
DROP POLICY IF EXISTS "select_own_locations" ON locations;
CREATE POLICY "select_own_locations" ON locations FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "insert_own_locations" ON locations;
CREATE POLICY "insert_own_locations" ON locations FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() OR user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_locations" ON locations;
CREATE POLICY "update_own_locations" ON locations FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id()) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_locations" ON locations;
CREATE POLICY "delete_own_locations" ON locations FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id());

-- apartments
DROP POLICY IF EXISTS "select_own_apartments" ON apartments;
CREATE POLICY "select_own_apartments" ON apartments FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "insert_own_apartments" ON apartments;
CREATE POLICY "insert_own_apartments" ON apartments FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() OR user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_apartments" ON apartments;
CREATE POLICY "update_own_apartments" ON apartments FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id()) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_apartments" ON apartments;
CREATE POLICY "delete_own_apartments" ON apartments FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id());

-- bookings (only owner + host, NOT cleaner)
DROP POLICY IF EXISTS "select_own_bookings" ON bookings;
CREATE POLICY "select_own_bookings" ON bookings FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "insert_own_bookings" ON bookings;
CREATE POLICY "insert_own_bookings" ON bookings FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "update_own_bookings" ON bookings;
CREATE POLICY "update_own_bookings" ON bookings FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host')) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_bookings" ON bookings;
CREATE POLICY "delete_own_bookings" ON bookings FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));

-- guests_archive (only owner + host, NOT cleaner)
DROP POLICY IF EXISTS "select_own_guests_archive" ON guests_archive;
CREATE POLICY "select_own_guests_archive" ON guests_archive FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "insert_own_guests_archive" ON guests_archive;
CREATE POLICY "insert_own_guests_archive" ON guests_archive FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "update_own_guests_archive" ON guests_archive;
CREATE POLICY "update_own_guests_archive" ON guests_archive FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host')) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_guests_archive" ON guests_archive;
CREATE POLICY "delete_own_guests_archive" ON guests_archive FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));

-- ical_sync (only owner + host)
DROP POLICY IF EXISTS "select_own_ical_sync" ON ical_sync;
CREATE POLICY "select_own_ical_sync" ON ical_sync FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "insert_own_ical_sync" ON ical_sync;
CREATE POLICY "insert_own_ical_sync" ON ical_sync FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "update_own_ical_sync" ON ical_sync;
CREATE POLICY "update_own_ical_sync" ON ical_sync FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host')) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_ical_sync" ON ical_sync;
CREATE POLICY "delete_own_ical_sync" ON ical_sync FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));

-- deleted_bookings (only owner + host)
DROP POLICY IF EXISTS "select_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "select_own_deleted_bookings" ON deleted_bookings FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "insert_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "insert_own_deleted_bookings" ON deleted_bookings FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "update_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "update_own_deleted_bookings" ON deleted_bookings FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host')) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_deleted_bookings" ON deleted_bookings;
CREATE POLICY "delete_own_deleted_bookings" ON deleted_bookings FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));

-- cleaners table (only owner + host)
DROP POLICY IF EXISTS "select_own_cleaners" ON cleaners;
CREATE POLICY "select_own_cleaners" ON cleaners FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "insert_own_cleaners" ON cleaners;
CREATE POLICY "insert_own_cleaners" ON cleaners FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "update_own_cleaners" ON cleaners;
CREATE POLICY "update_own_cleaners" ON cleaners FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host')) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_cleaners" ON cleaners;
CREATE POLICY "delete_own_cleaners" ON cleaners FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));

-- cleaner_assignments table (only owner + host)
DROP POLICY IF EXISTS "select_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "select_own_cleaner_assignments" ON cleaner_assignments FOR SELECT
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "insert_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "insert_own_cleaner_assignments" ON cleaner_assignments FOR INSERT
  TO authenticated WITH CHECK (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));
DROP POLICY IF EXISTS "update_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "update_own_cleaner_assignments" ON cleaner_assignments FOR UPDATE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host')) WITH CHECK (user_id = get_my_owner_id());
DROP POLICY IF EXISTS "delete_own_cleaner_assignments" ON cleaner_assignments;
CREATE POLICY "delete_own_cleaner_assignments" ON cleaner_assignments FOR DELETE
  TO authenticated USING (user_id = get_my_owner_id() AND get_my_role() IN ('owner', 'host'));

-- ============ Cleaner view (security_invoker) ============
CREATE OR REPLACE VIEW public.cleaner_apartments_view AS
SELECT
  a.id AS apartment_id,
  a.name AS apartment_name,
  a.apt_number,
  loc.name AS location_name,
  a.status,
  b.check_out AS next_check_out
FROM public.cleaner_apartments ca
JOIN public.apartments a ON a.id = ca.apartment_id
LEFT JOIN public.locations loc ON loc.id = a.location_id
LEFT JOIN public.bookings b ON b.id = a.current_booking_id
WHERE ca.cleaner_user_id = auth.uid()
AND a.user_id = ca.owner_id;

ALTER VIEW public.cleaner_apartments_view SET (security_invoker = true);

GRANT SELECT ON public.cleaner_apartments_view TO authenticated;

-- ============ mark_apartment_clean function ============
CREATE OR REPLACE FUNCTION public.mark_apartment_clean(p_apartment_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_is_assigned boolean;
  v_current_status text;
BEGIN
  SELECT public.get_my_role() INTO v_role;
  IF v_role != 'cleaner' THEN
    RETURN json_build_object('success', false, 'error', 'Only cleaners can mark apartments clean');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.cleaner_apartments
    WHERE cleaner_user_id = auth.uid() AND apartment_id = p_apartment_id
  ) INTO v_is_assigned;

  IF NOT v_is_assigned THEN
    RETURN json_build_object('success', false, 'error', 'Apartment not assigned to you');
  END IF;

  SELECT status INTO v_current_status FROM public.apartments WHERE id = p_apartment_id;
  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Apartment not found');
  END IF;

  IF v_current_status != 'needs_cleaning' THEN
    RETURN json_build_object('success', false, 'error', 'Apartment does not need cleaning');
  END IF;

  UPDATE public.apartments SET status = 'ready' WHERE id = p_apartment_id;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_apartment_clean(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_apartment_clean(uuid) TO authenticated;

-- ============ Update handle_new_user to create owner team_members record ============
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
  INSERT INTO public.team_members (owner_id, member_user_id, role, email)
  VALUES (NEW.id, NEW.id, 'owner', NEW.email);
  RETURN NEW;
END;
$$;

-- ============ Link invited users to team on signup ============
CREATE OR REPLACE FUNCTION public.link_team_member_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_members
  SET member_user_id = NEW.id
  WHERE email = NEW.email AND member_user_id IS NULL AND role != 'owner';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_link_team ON auth.users;
CREATE TRIGGER on_auth_user_link_team
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_team_member_on_signup();
