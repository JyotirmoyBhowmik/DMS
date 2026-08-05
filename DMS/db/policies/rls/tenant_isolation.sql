ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON "users"
  FOR ALL
  USING ("tenant_id" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));
