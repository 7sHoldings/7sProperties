-- ============================================================================
-- v3 FEATURES: recurring expenses, mileage, mortgages, tenant ledger,
-- security deposits, owner contributions
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- 1. Recurring expense templates
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  vendor TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','quarterly','yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  day_of_month INTEGER DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  active BOOLEAN DEFAULT true,
  last_generated_for DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own recurring_expenses" ON recurring_expenses;
CREATE POLICY "Users own recurring_expenses" ON recurring_expenses
  FOR ALL USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_recurring_owner ON recurring_expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_recurring_property ON recurring_expenses(property_id);

-- 2. Mileage logs
CREATE TABLE IF NOT EXISTS mileage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  trip_date DATE NOT NULL,
  miles NUMERIC(10,2) NOT NULL CHECK (miles > 0),
  purpose TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own mileage_logs" ON mileage_logs;
CREATE POLICY "Users own mileage_logs" ON mileage_logs
  FOR ALL USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_mileage_owner ON mileage_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_mileage_property ON mileage_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_mileage_date ON mileage_logs(trip_date);

-- 3. Mortgages (one per property)
CREATE TABLE IF NOT EXISTS mortgages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
  lender TEXT,
  original_principal NUMERIC(12,2),
  current_balance NUMERIC(12,2),
  interest_rate NUMERIC(6,3),
  monthly_payment NUMERIC(10,2),
  term_months INTEGER,
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mortgages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own mortgages" ON mortgages;
CREATE POLICY "Users own mortgages" ON mortgages
  FOR ALL USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_mortgages_property ON mortgages(property_id);

-- 4. Tenant charges (late fees, adjustments — rent expected is derived from lease)
CREATE TABLE IF NOT EXISTS tenant_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  charge_date DATE NOT NULL,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('late_fee','adjustment','other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own tenant_charges" ON tenant_charges;
CREATE POLICY "Users own tenant_charges" ON tenant_charges
  FOR ALL USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_tenant_charges_lease ON tenant_charges(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_charges_date ON tenant_charges(charge_date);

-- Tenants can SELECT their own charges (for portal)
DROP POLICY IF EXISTS "Tenants see own charges" ON tenant_charges;
CREATE POLICY "Tenants see own charges" ON tenant_charges
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM leases WHERE leases.id = tenant_charges.lease_id AND leases.tenant_id = current_tenant_id())
  );

-- 5. Security deposit transactions (refund / deduction trail)
CREATE TABLE IF NOT EXISTS deposit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('refund','deduction')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deposit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own deposit_transactions" ON deposit_transactions;
CREATE POLICY "Users own deposit_transactions" ON deposit_transactions
  FOR ALL USING (auth.uid() = owner_id);

-- 6. Add type column to distributions for owner contributions support
ALTER TABLE distributions
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'distribution'
    CHECK (type IN ('distribution','contribution'));
