-- ============================================================================
-- v11: Free-form expense categories
-- The original CHECK locked expenses.category to a fixed 12-item list, so
-- users couldn't tag expenses with anything specific to their setup.
-- Drop the CHECK so the app can accept custom category labels (still typed
-- as TEXT NOT NULL). The rental P&L formula only special-cases
-- category = 'mortgage'; all other values bucket into operating expenses.
-- ============================================================================

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_category_check;
