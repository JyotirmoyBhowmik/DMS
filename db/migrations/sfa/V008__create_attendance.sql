-- =============================================================================
-- V008: Create attendance table for Sales Force Automation (SFA)
-- Tracks daily agent attendance with check-in/out, geolocation, and overtime.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS attendance (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID           NOT NULL,
  agent_id              UUID           NOT NULL,
  date                  DATE           NOT NULL,
  shift_start           TIMESTAMPTZ,
  shift_end             TIMESTAMPTZ,
  check_in_time         TIMESTAMPTZ,
  check_out_time        TIMESTAMPTZ,
  check_in_lat          NUMERIC(10,7),
  check_in_lng          NUMERIC(10,7),
  check_out_lat         NUMERIC(10,7),
  check_out_lng         NUMERIC(10,7),
  status                VARCHAR(20)    NOT NULL DEFAULT 'absent'
                          CHECK (status IN ('absent','checked_in','checked_out','approved')),
  leave_type            VARCHAR(30),
  total_hours_worked    NUMERIC(5,2)   NOT NULL DEFAULT 0 CHECK (total_hours_worked >= 0),
  overtime_hours        NUMERIC(5,2)   NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  version               INTEGER        NOT NULL DEFAULT 1,

  -- Business rule: max 1 attendance per agent per day per tenant
  UNIQUE(tenant_id, agent_id, date)
);

COMMENT ON TABLE attendance IS 'Daily attendance records for field agents with geolocation and overtime tracking';
COMMENT ON COLUMN attendance.total_hours_worked IS 'Total hours worked, computed from check-in/out times';
COMMENT ON COLUMN attendance.overtime_hours IS 'Hours exceeding 8h standard shift';
COMMENT ON COLUMN attendance.leave_type IS 'Optional leave type when agent is absent';

-- Tenant-scoped indexes
CREATE INDEX idx_attendance_tenant      ON attendance (tenant_id);
CREATE INDEX idx_attendance_agent       ON attendance (tenant_id, agent_id);
CREATE INDEX idx_attendance_date        ON attendance (tenant_id, date DESC);
CREATE INDEX idx_attendance_agent_date  ON attendance (tenant_id, agent_id, date DESC);
CREATE INDEX idx_attendance_status      ON attendance (tenant_id, status);

CREATE TRIGGER attendance_set_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
