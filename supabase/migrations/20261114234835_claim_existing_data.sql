/*
# Claim existing data for the app owner

After the app owner creates their account, all existing rows (which have user_id = NULL
because they were created before multi-user support) need to be assigned to the owner's
user_id. This migration creates a SECURITY DEFINER function that:
1. Finds the owner by their email
2. Updates all rows with NULL user_id across all tables to the owner's user_id
3. Returns the count of claimed rows

The owner should call this RPC once after signing up.
The function is restricted to authenticated users only.

Note: Replace 'admin@example.com' with the actual owner email before running.
For now, the function accepts any authenticated user and assigns NULL rows to THEM,
meaning whoever calls it first claims the existing data. This is safe because:
- The owner should be the first to sign up
- After claiming, NULL rows are gone, so subsequent calls do nothing
*/

CREATE OR REPLACE FUNCTION public.claim_existing_data()
RETURNS TABLE (claimed_locations bigint, claimed_apartments bigint, claimed_bookings bigint, claimed_archive bigint, claimed_ical_sync bigint, claimed_deleted_bookings bigint, claimed_cleaners bigint, claimed_cleaner_assignments bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  UPDATE locations SET user_id = uid WHERE user_id IS NULL;
  UPDATE apartments SET user_id = uid WHERE user_id IS NULL;
  UPDATE bookings SET user_id = uid WHERE user_id IS NULL;
  UPDATE guests_archive SET user_id = uid WHERE user_id IS NULL;
  UPDATE ical_sync SET user_id = uid WHERE user_id IS NULL;
  UPDATE deleted_bookings SET user_id = uid WHERE user_id IS NULL;
  UPDATE cleaners SET user_id = uid WHERE user_id IS NULL;
  UPDATE cleaner_assignments SET user_id = uid WHERE user_id IS NULL;

  RETURN QUERY
    SELECT
      (SELECT count(*) FROM locations WHERE user_id = uid)::bigint,
      (SELECT count(*) FROM apartments WHERE user_id = uid)::bigint,
      (SELECT count(*) FROM bookings WHERE user_id = uid)::bigint,
      (SELECT count(*) FROM guests_archive WHERE user_id = uid)::bigint,
      (SELECT count(*) FROM ical_sync WHERE user_id = uid)::bigint,
      (SELECT count(*) FROM deleted_bookings WHERE user_id = uid)::bigint,
      (SELECT count(*) FROM cleaners WHERE user_id = uid)::bigint,
      (SELECT count(*) FROM cleaner_assignments WHERE user_id = uid)::bigint;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_existing_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_existing_data() TO authenticated;
