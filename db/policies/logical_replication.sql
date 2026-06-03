-- =============================================================================
# Logical Replication Publications and Subscriptions
# Configures transaction publications on the primary databases and subscriptions
# on the read-replicas/reporting services.
# =============================================================================

-- 1. Create Publication on Primary (SFA/DMS)
-- Publishes updates to inventory and transactions for the sync and report services
CREATE PUBLICATION dms_sfa_publication FOR TABLE 
  distributors, 
  products_skus, 
  inventory_records, 
  retail_outlets,
  orders,
  visits,
  journey_plans;

-- 2. Create Audit Publication
-- Distinct publication for append-only SOC 2 compliance logging
CREATE PUBLICATION dms_audit_publication FOR TABLE tamper_evident_audit_log;

-- 3. Subscription Boilerplate Template (for replica databases)
-- This setup is executed on the target read-replica or warehouse server:
/*
CREATE SUBSCRIPTION dms_sfa_subscription
  CONNECTION 'host=postgres port=5432 dbname=dms_db user=replicator password=replicator_password'
  PUBLICATION dms_sfa_publication
  WITH (copy_data = true, create_slot = true, enabled = true);

CREATE SUBSCRIPTION dms_audit_subscription
  CONNECTION 'host=postgres port=5432 dbname=dms_db user=replicator password=replicator_password'
  PUBLICATION dms_audit_publication
  WITH (copy_data = true, create_slot = true, enabled = true);
*/
