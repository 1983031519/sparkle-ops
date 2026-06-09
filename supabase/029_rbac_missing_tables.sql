-- Migration 029: RBAC policies for change_orders, events, inventory, suppliers,
--                project_phases, projects, job_material_costs, job_labor_costs, job_other_costs
--
-- Replaces overly-permissive ALL policies (auth.role()='authenticated' or qual=true)
-- with 4 granular policies per table matching the clients/invoices model:
--   SELECT  → open read (true)
--   INSERT  → admin | manager | office
--   UPDATE  → admin | manager | office
--   DELETE  → admin | manager only
--
-- project_phases and projects: anon SELECT policies are preserved (public view feature).

-- ─── change_orders ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can do everything on change_orders" ON change_orders;

CREATE POLICY change_orders_select
  ON change_orders FOR SELECT
  USING (true);

CREATE POLICY change_orders_insert
  ON change_orders FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY change_orders_update
  ON change_orders FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY change_orders_delete
  ON change_orders FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── events ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can do all" ON events;

CREATE POLICY events_select
  ON events FOR SELECT
  USING (true);

CREATE POLICY events_insert
  ON events FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY events_update
  ON events FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY events_delete
  ON events FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── inventory ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow all for authenticated" ON inventory;

CREATE POLICY inventory_select
  ON inventory FOR SELECT
  USING (true);

CREATE POLICY inventory_insert
  ON inventory FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY inventory_update
  ON inventory FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY inventory_delete
  ON inventory FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── suppliers ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow all for authenticated" ON suppliers;

CREATE POLICY suppliers_select
  ON suppliers FOR SELECT
  USING (true);

CREATE POLICY suppliers_insert
  ON suppliers FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY suppliers_update
  ON suppliers FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY suppliers_delete
  ON suppliers FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── project_phases ────────────────────────────────────────────────────────────
-- NOTE: "Anon can read project_phases for public view" is intentionally preserved.

DROP POLICY IF EXISTS "Authenticated users can do everything on project_phases" ON project_phases;

CREATE POLICY project_phases_select
  ON project_phases FOR SELECT
  USING (true);

CREATE POLICY project_phases_insert
  ON project_phases FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY project_phases_update
  ON project_phases FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY project_phases_delete
  ON project_phases FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── projects ──────────────────────────────────────────────────────────────────
-- NOTE: "Anon can read projects for public view" is intentionally preserved.

DROP POLICY IF EXISTS "Authenticated users can do everything on projects" ON projects;

CREATE POLICY projects_select
  ON projects FOR SELECT
  USING (true);

CREATE POLICY projects_insert
  ON projects FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY projects_update
  ON projects FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY projects_delete
  ON projects FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── job_material_costs ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access on job_material_costs" ON job_material_costs;

CREATE POLICY job_material_costs_select
  ON job_material_costs FOR SELECT
  USING (true);

CREATE POLICY job_material_costs_insert
  ON job_material_costs FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY job_material_costs_update
  ON job_material_costs FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY job_material_costs_delete
  ON job_material_costs FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── job_labor_costs ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access on job_labor_costs" ON job_labor_costs;

CREATE POLICY job_labor_costs_select
  ON job_labor_costs FOR SELECT
  USING (true);

CREATE POLICY job_labor_costs_insert
  ON job_labor_costs FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY job_labor_costs_update
  ON job_labor_costs FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY job_labor_costs_delete
  ON job_labor_costs FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));

-- ─── job_other_costs ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access on job_other_costs" ON job_other_costs;

CREATE POLICY job_other_costs_select
  ON job_other_costs FOR SELECT
  USING (true);

CREATE POLICY job_other_costs_insert
  ON job_other_costs FOR INSERT
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY job_other_costs_update
  ON job_other_costs FOR UPDATE
  USING  (auth_user_role() = ANY(ARRAY['admin','manager','office']))
  WITH CHECK (auth_user_role() = ANY(ARRAY['admin','manager','office']));

CREATE POLICY job_other_costs_delete
  ON job_other_costs FOR DELETE
  USING (auth_user_role() = ANY(ARRAY['admin','manager']));
