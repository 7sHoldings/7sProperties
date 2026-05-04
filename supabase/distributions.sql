-- ============================================================================
-- DISTRIBUTIONS ("Profit taken out")
-- Run once in Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  distribution_date DATE NOT NULL,
  destination TEXT,           -- e.g. "Vape store investment", "Personal"
  payment_method TEXT,        -- bank transfer, check, cash, etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own distributions" ON distributions;
CREATE POLICY "Users see own distributions" ON distributions
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_distributions_owner ON distributions(owner_id);
CREATE INDEX IF NOT EXISTS idx_distributions_property ON distributions(property_id);
CREATE INDEX IF NOT EXISTS idx_distributions_date ON distributions(distribution_date);
