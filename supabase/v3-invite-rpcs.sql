-- ============================================================================
-- TENANT INVITE RPCs
-- The signup page queries tenants by invite_token BEFORE the user is logged
-- in, so RLS blocks the read. These SECURITY DEFINER RPCs bypass RLS for
-- exactly that flow (lookup + activate).
-- Run once in Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION lookup_tenant_invite(p_token UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  invite_expires_at TIMESTAMPTZ,
  portal_activated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, email, invite_expires_at, portal_activated_at
  FROM tenants
  WHERE invite_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION lookup_tenant_invite(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION activate_tenant_invite(p_token UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE tenants
  SET auth_user_id = p_user_id,
      portal_activated_at = now(),
      invite_token = NULL,
      invite_expires_at = NULL
  WHERE invite_token = p_token
    AND portal_activated_at IS NULL;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION activate_tenant_invite(UUID, UUID) TO authenticated;
