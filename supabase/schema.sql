-- ============================================================================
-- RENTAL PROPERTY MANAGEMENT - DATABASE SCHEMA
-- Run this in Supabase SQL Editor (one-time setup)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROPERTIES
-- ============================================================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  property_type TEXT CHECK (property_type IN ('single_family', 'duplex', 'triplex', 'fourplex', 'condo', 'apartment', 'townhouse', 'other')),
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  square_feet INTEGER,
  purchase_price NUMERIC(12,2),
  purchase_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- UNITS (for multi-unit buildings; single-family has 1 unit)
-- ============================================================================
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_label TEXT NOT NULL DEFAULT 'Main',
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  square_feet INTEGER,
  status TEXT DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TENANTS
-- ============================================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LEASES
-- ============================================================================
CREATE TABLE leases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent NUMERIC(10,2) NOT NULL,
  security_deposit NUMERIC(10,2),
  rent_due_day INTEGER DEFAULT 1 CHECK (rent_due_day BETWEEN 1 AND 31),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYMENTS
-- ============================================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'paypal', 'other')),
  reference_number TEXT,
  for_month DATE NOT NULL, -- which month this payment is for (use 1st of month)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXPENSES
-- ============================================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('repairs', 'maintenance', 'utilities', 'insurance', 'property_tax', 'mortgage', 'hoa', 'management_fee', 'supplies', 'legal', 'advertising', 'other')),
  description TEXT NOT NULL,
  vendor TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MAINTENANCE REQUESTS
-- ============================================================================
CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  reported_date DATE DEFAULT CURRENT_DATE,
  completed_date DATE,
  cost NUMERIC(10,2),
  contractor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DOCUMENTS (file metadata; actual files in Supabase Storage)
-- ============================================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  document_type TEXT CHECK (document_type IN ('lease', 'receipt', 'id_document', 'insurance', 'tax_document', 'photo', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_units_property ON units(property_id);
CREATE INDEX idx_tenants_owner ON tenants(owner_id);
CREATE INDEX idx_leases_owner ON leases(owner_id);
CREATE INDEX idx_leases_unit ON leases(unit_id);
CREATE INDEX idx_leases_tenant ON leases(tenant_id);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_payments_owner ON payments(owner_id);
CREATE INDEX idx_payments_lease ON payments(lease_id);
CREATE INDEX idx_payments_for_month ON payments(for_month);
CREATE INDEX idx_expenses_owner ON expenses(owner_id);
CREATE INDEX idx_expenses_property ON expenses(property_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_maintenance_owner ON maintenance_requests(owner_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);

-- ============================================================================
-- ROW LEVEL SECURITY (each user only sees their own data)
-- ============================================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Properties policies
CREATE POLICY "Users see own properties" ON properties FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users insert own properties" ON properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users update own properties" ON properties FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users delete own properties" ON properties FOR DELETE USING (auth.uid() = owner_id);

-- Units policies (via property ownership)
CREATE POLICY "Users see own units" ON units FOR SELECT USING (
  EXISTS (SELECT 1 FROM properties WHERE properties.id = units.property_id AND properties.owner_id = auth.uid())
);
CREATE POLICY "Users insert own units" ON units FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM properties WHERE properties.id = units.property_id AND properties.owner_id = auth.uid())
);
CREATE POLICY "Users update own units" ON units FOR UPDATE USING (
  EXISTS (SELECT 1 FROM properties WHERE properties.id = units.property_id AND properties.owner_id = auth.uid())
);
CREATE POLICY "Users delete own units" ON units FOR DELETE USING (
  EXISTS (SELECT 1 FROM properties WHERE properties.id = units.property_id AND properties.owner_id = auth.uid())
);

-- Tenants, Leases, Payments, Expenses, Maintenance, Documents - all by owner_id
CREATE POLICY "Users see own tenants" ON tenants FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users see own leases" ON leases FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users see own payments" ON payments FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users see own expenses" ON expenses FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users see own maintenance" ON maintenance_requests FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users see own documents" ON documents FOR ALL USING (auth.uid() = owner_id);

-- ============================================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON leases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STORAGE BUCKET for documents (run in Storage section, or via dashboard)
-- ============================================================================
-- Go to Storage in Supabase dashboard and create a bucket called 'documents'
-- Set it as Private. Then add this policy:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
