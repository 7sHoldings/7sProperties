-- ============================================================================
-- v12: General / custom expenses not tied to a property
-- Allow expenses.property_id to be NULL so owner-level costs (accountant,
-- software, umbrella insurance, etc.) can be logged from the same form via a
-- "Custom / Other" option. Mirrors the v6 change to recurring_expenses.
-- NULL-property rows still count toward dashboard and report totals; they are
-- simply excluded when filtering by a specific property.
-- Run once in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE expenses ALTER COLUMN property_id DROP NOT NULL;
