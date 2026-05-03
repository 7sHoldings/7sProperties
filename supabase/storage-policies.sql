-- ============================================================================
-- DOCUMENTS BUCKET — storage policies
-- Run this AFTER creating a private bucket named "documents" in Supabase Storage
-- ============================================================================

-- Files are uploaded under the path:  ${user_id}/${entity_type}/${entity_id}/${filename}
-- The first path segment must equal the authenticated user's UID, which gives
-- per-user isolation without coupling to the documents table.

CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
