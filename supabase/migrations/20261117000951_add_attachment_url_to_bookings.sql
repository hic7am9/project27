/*
# Add attachment_url column to bookings

1. Summary
- Adds an optional `attachment_url` column to the `bookings` table so that
  manual bookings can store a link to an uploaded file (receipt, transfer
  proof, ID photo, PDF, etc.) in Supabase Storage.

2. Modified tables
- `bookings`: + attachment_url (text, nullable). Stores the storage path
  within the `user-files` bucket (e.g. "<user_id>/bookings/<filename>").

3. Security
- No RLS changes needed — the existing bookings policies already cover
  the new column (column-level privileges are inherited from table grants).
- The `user-files` storage bucket already has per-user RLS policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='bookings' AND column_name='attachment_url') THEN
    ALTER TABLE public.bookings ADD COLUMN attachment_url text;
  END IF;
END $$;
