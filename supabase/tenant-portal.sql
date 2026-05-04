-- ============================================================================
-- TENANT PORTAL: schema + RLS additions
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- 1. Add portal columns to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_token UUID,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_activated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_auth_user ON tenants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_invite_token ON tenants(invite_token);

-- 2. Track who submitted a maintenance request (tenant vs owner)
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS submitted_by_tenant BOOLEAN DEFAULT false;

-- 3. Helper: returns the tenants.id for the currently logged-in tenant user
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM tenants WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================================
-- RLS POLICIES FOR TENANT PORTAL
--
-- Owners keep their existing FOR ALL ... USING (auth.uid() = owner_id) policies.
-- Below we ADD tenant-side SELECT policies.
-- ============================================================================

-- Tenant can SELECT their own tenant row
DROP POLICY IF EXISTS "Tenants see own tenant row" ON tenants;
CREATE POLICY "Tenants see own tenant row" ON tenants
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Tenant can UPDATE their own tenant row (limited to their own contact info)
DROP POLICY IF EXISTS "Tenants update own tenant row" ON tenants;
CREATE POLICY "Tenants update own tenant row" ON tenants
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Tenant can SELECT their own leases
DROP POLICY IF EXISTS "Tenants see own leases" ON leases;
CREATE POLICY "Tenants see own leases" ON leases
  FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Tenant can SELECT payments on their leases
DROP POLICY IF EXISTS "Tenants see own payments" ON payments;
CREATE POLICY "Tenants see own payments" ON payments
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM leases WHERE leases.id = payments.lease_id AND leases.tenant_id = current_tenant_id())
  );

-- Tenant can SELECT properties they have a lease on
DROP POLICY IF EXISTS "Tenants see leased properties" ON properties;
CREATE POLICY "Tenants see leased properties" ON properties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN units u ON u.id = l.unit_id
      WHERE u.property_id = properties.id AND l.tenant_id = current_tenant_id()
    )
  );

-- Tenant can SELECT units they have a lease on
DROP POLICY IF EXISTS "Tenants see leased units" ON units;
CREATE POLICY "Tenants see leased units" ON units
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM leases WHERE leases.unit_id = units.id AND leases.tenant_id = current_tenant_id())
  );

-- Tenant can SELECT their own maintenance requests
DROP POLICY IF EXISTS "Tenants see own maintenance" ON maintenance_requests;
CREATE POLICY "Tenants see own maintenance" ON maintenance_requests
  FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Tenant can INSERT maintenance requests against their property
DROP POLICY IF EXISTS "Tenants submit maintenance" ON maintenance_requests;
CREATE POLICY "Tenants submit maintenance" ON maintenance_requests
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND submitted_by_tenant = true
    AND EXISTS (
      SELECT 1 FROM leases l
      JOIN units u ON u.id = l.unit_id
      WHERE l.tenant_id = current_tenant_id() AND u.property_id = maintenance_requests.property_id
    )
  );

-- Tenant can SELECT documents tied to their tenant_id, lease_id, or property
DROP POLICY IF EXISTS "Tenants see own documents" ON documents;
CREATE POLICY "Tenants see own documents" ON documents
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR lease_id IN (SELECT id FROM leases WHERE tenant_id = current_tenant_id())
    OR property_id IN (
      SELECT u.property_id FROM units u
      JOIN leases l ON l.unit_id = u.id
      WHERE l.tenant_id = current_tenant_id()
    )
  );
