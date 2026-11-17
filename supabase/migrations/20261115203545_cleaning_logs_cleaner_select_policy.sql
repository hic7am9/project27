/*
# Add cleaner SELECT policy on cleaning_logs

1. Security Changes
- Add a new SELECT policy on `cleaning_logs` so cleaners can read
  their own cleaning log entries (where cleaner_user_id = auth.uid()).
- The existing `select_own_cleaning_logs` policy only allows owner/host
  roles. Cleaners create logs via `mark_apartment_clean()` (SECURITY DEFINER)
  but could not read them back.
- This does NOT grant write access — all inserts still go through the
  `mark_apartment_clean` SECURITY DEFINER function.
*/

DROP POLICY IF EXISTS "select_own_cleaning_logs_cleaner" ON cleaning_logs;

CREATE POLICY "select_own_cleaning_logs_cleaner"
ON cleaning_logs FOR SELECT
TO authenticated
USING (
  cleaner_user_id = auth.uid()
);
