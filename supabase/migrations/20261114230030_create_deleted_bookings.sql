/*
# Track deleted manual bookings so iCal export can signal CANCELLED to Airbnb

1. New Tables
- `deleted_bookings`: stores the UID and date range of manually-created bookings
  that were deleted from the app. The export-ical edge function includes these as
  CANCELLED VEVENTs in the exported iCal feed, so Airbnb re-opens those dates on
  its calendar. Without this, Airbnb holds the dates blocked because the event
  simply disappears from the feed — Airbnb needs an explicit CANCELLED event to
  release the dates.
- `id` (uuid, primary key)
- `apartment_id` (uuid, references apartments, ON DELETE CASCADE)
- `ical_uid` (text, not null) — the UID used in the exported iCal feed
  (format: booking-<uuid>@property-management)
- `check_in` (date, not null)
- `check_out` (date, not null)
- `deleted_at` (timestamptz, default now())

2. Security
- Enable RLS on `deleted_bookings`.
- Grant CRUD to `anon` + `authenticated` (single-tenant, no sign-in app).
- Allow anon + authenticated full CRUD because the data is intentionally shared.
- Grant service_role CRUD so the export-ical edge function can read via the service key.

3. Notes
- Only manual bookings (external_uid IS NULL) are tracked here, because Airbnb-sourced
  bookings are controlled by Airbnb itself — deleting them locally shouldn't push a
  CANCELLED to Airbnb.
- Entries older than 30 days are cleaned up by the export-ical function to avoid
  unbounded growth.
*/

CREATE TABLE IF NOT EXISTS deleted_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid REFERENCES apartments(id) ON DELETE CASCADE,
  ical_uid text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  deleted_at timestamptz DEFAULT now()
);

ALTER TABLE deleted_bookings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON deleted_bookings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deleted_bookings TO service_role;

DROP POLICY IF EXISTS "anon_select_deleted_bookings" ON deleted_bookings;
CREATE POLICY "anon_select_deleted_bookings" ON deleted_bookings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_deleted_bookings" ON deleted_bookings;
CREATE POLICY "anon_insert_deleted_bookings" ON deleted_bookings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_deleted_bookings" ON deleted_bookings;
CREATE POLICY "anon_update_deleted_bookings" ON deleted_bookings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_deleted_bookings" ON deleted_bookings;
CREATE POLICY "anon_delete_deleted_bookings" ON deleted_bookings FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_deleted_bookings_apartment ON deleted_bookings(apartment_id);
