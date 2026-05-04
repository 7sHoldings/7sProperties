-- ============================================================================
-- PUBLIC LISTINGS RPC
-- Shows a redacted view of properties that have at least one vacant unit.
-- Anonymous users can see name, city, state, type, bedrooms, bathrooms, sqft.
-- Sensitive data (purchase price, owner_id, address full, etc.) stays private.
-- Run once in Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public_listings()
RETURNS TABLE (
  property_id UUID,
  property_name TEXT,
  city TEXT,
  state TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  square_feet INTEGER,
  vacant_units BIGINT,
  asking_rent NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id AS property_id,
    p.name AS property_name,
    p.city,
    p.state,
    p.property_type,
    p.bedrooms,
    p.bathrooms,
    p.square_feet,
    COUNT(u.id) FILTER (WHERE u.status = 'vacant') AS vacant_units,
    -- last known rent for any of this property's leases (optional listing price)
    (
      SELECT l.monthly_rent
      FROM leases l
      JOIN units u2 ON u2.id = l.unit_id
      WHERE u2.property_id = p.id
      ORDER BY l.created_at DESC
      LIMIT 1
    ) AS asking_rent
  FROM properties p
  JOIN units u ON u.property_id = p.id
  GROUP BY p.id
  HAVING COUNT(u.id) FILTER (WHERE u.status = 'vacant') > 0;
$$;

GRANT EXECUTE ON FUNCTION public_listings() TO anon, authenticated;
