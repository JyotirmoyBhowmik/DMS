-- Migration V002: Monthly range partitioning & cold storage retention structure for Audit Logs
-- Domain: Audit Service (P4 Integrations)

-- Function to dynamically create monthly audit log partitions
CREATE OR REPLACE FUNCTION create_audit_logs_monthly_partition(p_year INT, p_month INT)
RETURNS VOID AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_partition_name := format('audit_logs_y%sm%s', p_year, lpad(p_month::text, 2, '0'));
    v_start_date := make_date(p_year, p_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month')::DATE;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L);',
        v_partition_name, v_start_date, v_end_date
    );
END;
$$ LANGUAGE plpgsql;

/*
-- REVERSIBLE DOWN MIGRATION:
DROP FUNCTION IF EXISTS create_audit_logs_monthly_partition(INT, INT);
*/
