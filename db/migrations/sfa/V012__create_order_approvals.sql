-- =============================================================================
-- V012: Create order_approvals table for Sales Force Automation (SFA)
-- Multi-level order approval workflow with threshold-based auto-approve/escalation.
-- Monetary amounts stored as BIGINT in smallest currency unit (paise/cents).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS order_approvals (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  order_id          UUID         NOT NULL,
  requested_by      UUID         NOT NULL,
  approved_by       UUID,
  approval_level    INTEGER      NOT NULL DEFAULT 1
                      CHECK (approval_level BETWEEN 1 AND 3),
  threshold_amount  BIGINT       NOT NULL DEFAULT 0 CHECK (threshold_amount >= 0),
  threshold_currency VARCHAR(3)  NOT NULL DEFAULT 'INR',
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','escalated')),
  comments          TEXT,
  requested_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  version           INTEGER      NOT NULL DEFAULT 1
);

COMMENT ON TABLE order_approvals IS 'Multi-level order approval workflow with threshold-based escalation';
COMMENT ON COLUMN order_approvals.approval_level IS 'Approval tier: 1=line manager, 2=area manager, 3=regional head';
COMMENT ON COLUMN order_approvals.threshold_amount IS 'Order amount threshold for this approval level in smallest currency unit';

-- Tenant-scoped indexes
CREATE INDEX idx_order_approvals_tenant     ON order_approvals (tenant_id);
CREATE INDEX idx_order_approvals_order      ON order_approvals (tenant_id, order_id);
CREATE INDEX idx_order_approvals_requester  ON order_approvals (tenant_id, requested_by);
CREATE INDEX idx_order_approvals_approver   ON order_approvals (tenant_id, approved_by) WHERE approved_by IS NOT NULL;
CREATE INDEX idx_order_approvals_status     ON order_approvals (tenant_id, status);
CREATE INDEX idx_order_approvals_level      ON order_approvals (tenant_id, approval_level, status);
CREATE INDEX idx_order_approvals_requested  ON order_approvals (tenant_id, requested_at DESC);

CREATE TRIGGER order_approvals_set_updated_at
  BEFORE UPDATE ON order_approvals
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
