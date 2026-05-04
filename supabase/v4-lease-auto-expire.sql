-- ============================================================================
-- AUTO-EXPIRE LEASES
-- Marks leases as 'expired' when their end_date is past, every time the
-- leases table is queried (lazy approach — works without a cron job).
-- Also runs on each property/tenant query through the existing RLS chains.
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- A function any authenticated user can call to "tick" expired leases
CREATE OR REPLACE FUNCTION expire_overdue_leases()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE leases
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date < CURRENT_DATE;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_overdue_leases() TO authenticated;

-- One-time backfill so existing past leases get flipped right now
SELECT expire_overdue_leases();
