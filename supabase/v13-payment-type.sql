-- ============================================================================
-- v13: Rent vs. security deposit on payments
-- Every payment row is now tagged with a payment_type so a deposit collected
-- from a tenant can be recorded on the same form as rent without inflating
-- rent collection or P&L. Existing rows are backfilled to 'rent'.
--
-- Accounting note: a security deposit is money held on behalf of the tenant,
-- not income, so deposit rows are excluded from rent income, the monthly
-- collection status, and the cashflow charts. The deposit ledger on the tenant
-- page (deposit_transactions) still tracks deductions and refunds.
-- Run once in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'rent';

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_type_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_type_check CHECK (payment_type IN ('rent', 'deposit'));

CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
