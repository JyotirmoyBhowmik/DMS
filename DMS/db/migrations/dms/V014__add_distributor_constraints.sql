-- =============================================================================
-- V014: Add integrity constraints, check rules, and composite indexes to distributors table.
-- =============================================================================

BEGIN;

-- 1. Add CHECK constraints to prevent empty values
ALTER TABLE distributors ADD CONSTRAINT chk_distributors_name CHECK (char_length(trim(name)) > 0);
ALTER TABLE distributors ADD CONSTRAINT chk_distributors_region CHECK (char_length(trim(region)) > 0);

-- 2. Add Unique business key constraint (name must be unique within a tenant)
ALTER TABLE distributors ADD CONSTRAINT uq_distributors_name_tenant UNIQUE (tenant_id, name);

-- 3. Add high-performance composite indexes for common filter/sort paths
CREATE INDEX IF NOT EXISTS idx_distributors_tenant_region ON distributors (tenant_id, region);
CREATE INDEX IF NOT EXISTS idx_distributors_tenant_name ON distributors (tenant_id, name);

COMMIT;

-- =============================================================================
-- REVERSIBLE ROLLBACK DOWN-MIGRATION (for manual rollbacks)
-- =============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_distributors_tenant_name;
-- DROP INDEX IF EXISTS idx_distributors_tenant_region;
-- ALTER TABLE distributors DROP CONSTRAINT IF EXISTS uq_distributors_name_tenant;
-- ALTER TABLE distributors DROP CONSTRAINT IF EXISTS chk_distributors_region;
-- ALTER TABLE distributors DROP CONSTRAINT IF EXISTS chk_distributors_name;
-- COMMIT;
