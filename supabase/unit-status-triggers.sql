-- ============================================================================
-- AUTO-SYNC UNIT STATUS WITH LEASE STATUS
-- Run once in Supabase SQL Editor.
--
-- These triggers keep `units.status` in sync with active leases:
--   - When a lease becomes active   -> mark unit "occupied"
--   - When a lease is deleted/ended -> mark unit "vacant" (if no other active lease)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_unit_status_after_lease_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_unit UUID;
  active_count  INTEGER;
BEGIN
  -- Determine which unit was affected
  IF TG_OP = 'DELETE' THEN
    affected_unit := OLD.unit_id;
  ELSE
    affected_unit := NEW.unit_id;
  END IF;

  IF affected_unit IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Count any remaining active leases on this unit
  SELECT COUNT(*) INTO active_count
  FROM leases
  WHERE unit_id = affected_unit
    AND status = 'active';

  -- Set unit status accordingly (skip if currently 'maintenance')
  IF active_count > 0 THEN
    UPDATE units SET status = 'occupied'
    WHERE id = affected_unit
      AND status <> 'maintenance';
  ELSE
    UPDATE units SET status = 'vacant'
    WHERE id = affected_unit
      AND status <> 'maintenance';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_unit_after_lease_insert ON leases;
DROP TRIGGER IF EXISTS sync_unit_after_lease_update ON leases;
DROP TRIGGER IF EXISTS sync_unit_after_lease_delete ON leases;

CREATE TRIGGER sync_unit_after_lease_insert
  AFTER INSERT ON leases
  FOR EACH ROW EXECUTE FUNCTION sync_unit_status_after_lease_change();

CREATE TRIGGER sync_unit_after_lease_update
  AFTER UPDATE OF status, unit_id ON leases
  FOR EACH ROW EXECUTE FUNCTION sync_unit_status_after_lease_change();

CREATE TRIGGER sync_unit_after_lease_delete
  AFTER DELETE ON leases
  FOR EACH ROW EXECUTE FUNCTION sync_unit_status_after_lease_change();

-- ============================================================================
-- BACKFILL: fix existing data (run once)
-- ============================================================================
UPDATE units u
SET status = CASE
  WHEN EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = u.id AND l.status = 'active') THEN 'occupied'
  ELSE 'vacant'
END
WHERE u.status <> 'maintenance';
