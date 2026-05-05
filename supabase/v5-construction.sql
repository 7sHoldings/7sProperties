-- ============================================================================
-- CONSTRUCTION PROJECTS
-- Track new home builds with their costs/expenses, and convert to a rental
-- property once construction is complete.
-- Run once in Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS construction_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  property_type TEXT CHECK (property_type IN ('single_family', 'duplex', 'triplex', 'fourplex', 'condo', 'apartment', 'townhouse', 'other')),
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed')),
  start_date DATE,
  expected_completion_date DATE,
  actual_completion_date DATE,
  budget NUMERIC(12,2),
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  square_feet INTEGER,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS construction_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  vendor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_construction_projects_owner ON construction_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_construction_projects_status ON construction_projects(status);
CREATE INDEX IF NOT EXISTS idx_construction_expenses_owner ON construction_expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_construction_expenses_project ON construction_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_expenses_date ON construction_expenses(expense_date);

ALTER TABLE construction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own construction projects" ON construction_projects;
CREATE POLICY "Users see own construction projects" ON construction_projects
  FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users see own construction expenses" ON construction_expenses;
CREATE POLICY "Users see own construction expenses" ON construction_expenses
  FOR ALL USING (auth.uid() = owner_id);

-- updated_at trigger (assumes update_updated_at_column() exists from schema.sql)
DROP TRIGGER IF EXISTS update_construction_projects_updated_at ON construction_projects;
CREATE TRIGGER update_construction_projects_updated_at
  BEFORE UPDATE ON construction_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CONVERT COMPLETED PROJECT TO RENTAL PROPERTY
-- Creates a properties row + a default Main unit, links the project to it.
-- Returns the new property_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION convert_construction_to_property(p_project_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_project construction_projects%ROWTYPE;
  v_property_id UUID;
  v_caller UUID := auth.uid();
BEGIN
  SELECT * INTO v_project FROM construction_projects WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF v_project.owner_id <> v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_project.property_id IS NOT NULL THEN
    RETURN v_project.property_id;
  END IF;

  INSERT INTO properties (
    owner_id, name, address, city, state, zip, property_type,
    bedrooms, bathrooms, square_feet, purchase_date, notes
  ) VALUES (
    v_project.owner_id,
    v_project.name,
    COALESCE(v_project.address, ''),
    v_project.city,
    v_project.state,
    v_project.zip,
    COALESCE(v_project.property_type, 'single_family'),
    v_project.bedrooms,
    v_project.bathrooms,
    v_project.square_feet,
    v_project.actual_completion_date,
    'Converted from construction project'
  )
  RETURNING id INTO v_property_id;

  INSERT INTO units (property_id, unit_label, bedrooms, bathrooms, square_feet, status)
  VALUES (v_property_id, 'Main', v_project.bedrooms, v_project.bathrooms, v_project.square_feet, 'vacant');

  UPDATE construction_projects
  SET property_id = v_property_id,
      status = 'completed',
      actual_completion_date = COALESCE(actual_completion_date, CURRENT_DATE)
  WHERE id = p_project_id;

  RETURN v_property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION convert_construction_to_property(UUID) TO authenticated;
