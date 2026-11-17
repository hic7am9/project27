/*
# Storage setup for per-user file isolation

Creates a storage bucket 'user-files' and policies so each authenticated user
can only read/write files within their own folder (user_id/...).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false)
ON CONFLICT (id) DO NOTHING;

-- Users can read files in their own folder
DROP POLICY IF EXISTS "read_own_files" ON storage.objects;
CREATE POLICY "read_own_files" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can upload to their own folder
DROP POLICY IF EXISTS "upload_own_files" ON storage.objects;
CREATE POLICY "upload_own_files" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can update files in their own folder
DROP POLICY IF EXISTS "update_own_files" ON storage.objects;
CREATE POLICY "update_own_files" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can delete files in their own folder
DROP POLICY IF EXISTS "delete_own_files" ON storage.objects;
CREATE POLICY "delete_own_files" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
