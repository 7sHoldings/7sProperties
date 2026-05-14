-- ============================================================================
-- v7: Attach receipts/photos to construction expenses
-- Adds construction_expense_id to documents so we can store build receipts
-- alongside the expense (lumber invoices, permit copies, subcontractor bills).
-- Run once in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS construction_expense_id UUID
    REFERENCES construction_expenses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_construction_expense
  ON documents(construction_expense_id);
