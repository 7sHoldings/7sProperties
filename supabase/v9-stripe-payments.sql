-- ============================================================================
-- v9: Stripe ACH + card rent payments
-- Lets tenants pay rent through Stripe (ACH via Financial Connections or
-- micro-deposits, plus card as a backup). Adds processor metadata to
-- payments, saved payment methods per tenant, and per-lease autopay state.
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- Stripe customer per tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Per-lease autopay state
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopay_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Processor metadata on payments. The legacy `payment_method` column is kept
-- for backward compat with manually-recorded payments; new processor-driven
-- payments populate processor / processor_status / method_kind.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS processor TEXT,
  ADD COLUMN IF NOT EXISTS processor_status TEXT,
  ADD COLUMN IF NOT EXISTS method_kind TEXT,
  ADD COLUMN IF NOT EXISTS processor_fee NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);

-- Widen the payment_method CHECK to allow new values without breaking existing
-- rows. The processor column is the source of truth for processor-driven flows.
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_method_check CHECK (
    payment_method IS NULL OR payment_method IN (
      'cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'paypal',
      'ach', 'card', 'other'
    )
  );

-- Saved payment methods per tenant (us_bank_account + card)
CREATE TABLE IF NOT EXISTS tenant_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('us_bank_account', 'card')),
  brand TEXT,            -- bank name, or card brand
  last4 TEXT,
  is_default BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'detached', 'unverified')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_pm_tenant ON tenant_payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_pm_owner ON tenant_payment_methods(owner_id);

ALTER TABLE tenant_payment_methods ENABLE ROW LEVEL SECURITY;

-- Owners see methods for their tenants
DROP POLICY IF EXISTS "Owners see own tenant payment methods" ON tenant_payment_methods;
CREATE POLICY "Owners see own tenant payment methods" ON tenant_payment_methods
  FOR ALL USING (auth.uid() = owner_id);

-- Tenants see/manage their own payment methods
DROP POLICY IF EXISTS "Tenants manage own payment methods" ON tenant_payment_methods;
CREATE POLICY "Tenants manage own payment methods" ON tenant_payment_methods
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
  );

-- Tenants can read their own payments (already exists for owners; mirror it
-- for portal). RLS already exists on payments via owner; add tenant read.
DROP POLICY IF EXISTS "Tenants read own payments" ON payments;
CREATE POLICY "Tenants read own payments" ON payments
  FOR SELECT USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      WHERE t.auth_user_id = auth.uid()
    )
  );
