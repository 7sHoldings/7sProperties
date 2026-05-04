-- ============================================================================
-- v3 HOTFIX: tenant RLS recursion + add payment_id to documents
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- Add payment_id column to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_payment ON documents(payment_id);

-- ============================================================================
-- Fix infinite recursion in tenant policies
-- The original policies cross-referenced properties/units/leases via EXISTS,
-- which (combined with how Postgres OR's all policies) created cycles.
-- We replace them with SECURITY DEFINER helper functions.
-- ============================================================================

DROP POLICY IF EXISTS "Tenants see leased properties" ON properties;
DROP POLICY IF EXISTS "Tenants see leased units" ON units;
DROP POLICY IF EXISTS "Tenants see own leases" ON leases;
DROP POLICY IF EXISTS "Tenants see own payments" ON payments;
DROP POLICY IF EXISTS "Tenants see own maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "Tenants submit maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "Tenants see own documents" ON documents;
DROP POLICY IF EXISTS "Tenants see own charges" ON tenant_charges;

CREATE OR REPLACE FUNCTION current_tenant_lease_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM leases
  WHERE tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION current_tenant_unit_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT unit_id FROM leases
  WHERE tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION current_tenant_property_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.property_id FROM units u
  JOIN leases l ON l.unit_id = u.id
  WHERE l.tenant_id = (SELECT id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1);
$$;

CREATE POLICY "Tenants see leased properties" ON properties
  FOR SELECT USING (id IN (SELECT current_tenant_property_ids()));

CREATE POLICY "Tenants see leased units" ON units
  FOR SELECT USING (id IN (SELECT current_tenant_unit_ids()));

CREATE POLICY "Tenants see own leases" ON leases
  FOR SELECT USING (id IN (SELECT current_tenant_lease_ids()));

CREATE POLICY "Tenants see own payments" ON payments
  FOR SELECT USING (lease_id IN (SELECT current_tenant_lease_ids()));

CREATE POLICY "Tenants see own maintenance" ON maintenance_requests
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Tenants submit maintenance" ON maintenance_requests
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
    AND submitted_by_tenant = true
    AND property_id IN (SELECT current_tenant_property_ids())
  );

CREATE POLICY "Tenants see own charges" ON tenant_charges
  FOR SELECT USING (lease_id IN (SELECT current_tenant_lease_ids()));

CREATE POLICY "Tenants see own documents" ON documents
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    OR lease_id IN (SELECT current_tenant_lease_ids())
    OR property_id IN (SELECT current_tenant_property_ids())
  );
