-- ============================================================================
-- v10: Property photos for construction projects
-- Adds construction_project_id to documents so a build can have its own
-- gallery (separate from photos attached to individual expenses).
-- Run once in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS construction_project_id UUID
    REFERENCES construction_projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_construction_project
  ON documents(construction_project_id);
