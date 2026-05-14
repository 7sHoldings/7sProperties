-- ============================================================================
-- v8: Tenant onboarding document types
-- Adds 'paystub' and 'rental_application' to the allowed document_type values
-- so tenant onboarding paperwork can be tagged correctly.
-- Run once in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (
    document_type IN (
      'lease',
      'receipt',
      'id_document',
      'insurance',
      'tax_document',
      'photo',
      'paystub',
      'rental_application',
      'other'
    )
  );
