-- ============================================================================
-- v6 TWEAKS
-- 1. Add 'lot' to allowed property_type values (properties + construction_projects)
-- 2. Make recurring_expenses.property_id NULLABLE so general/owner-level
--    recurring costs (umbrella insurance, accountant fees, etc.) can be tracked.
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- 1a. Add 'lot' to properties.property_type
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_property_type_check
  CHECK (property_type IN (
    'single_family', 'duplex', 'triplex', 'fourplex',
    'condo', 'apartment', 'townhouse', 'lot', 'other'
  ));

-- 1b. Add 'lot' to construction_projects.property_type
ALTER TABLE construction_projects DROP CONSTRAINT IF EXISTS construction_projects_property_type_check;
ALTER TABLE construction_projects
  ADD CONSTRAINT construction_projects_property_type_check
  CHECK (property_type IN (
    'single_family', 'duplex', 'triplex', 'fourplex',
    'condo', 'apartment', 'townhouse', 'lot', 'other'
  ));

-- 2. Allow recurring_expenses without a property
ALTER TABLE recurring_expenses ALTER COLUMN property_id DROP NOT NULL;
