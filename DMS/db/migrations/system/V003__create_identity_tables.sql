-- ==========================================
-- Identity & Access Management Schema
-- V003__create_identity_tables.sql
-- ==========================================

-- 1. Tenants
CREATE TABLE "tenants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Users
CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "email" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  "last_login_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1,
  UNIQUE("tenant_id", "email")
);

-- 3. Roles
CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(255),
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1,
  UNIQUE("tenant_id", "name")
);

-- 4. Permissions (Global lookup table)
CREATE TABLE "permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL UNIQUE,
  "resource" VARCHAR(100) NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "description" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. User Roles Mapping
CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("user_id", "role_id")
);

-- 6. Role Permissions Mapping
CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("role_id", "permission_id")
);

-- 7. MFA Devices
CREATE TABLE "mfa_devices" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL, -- e.g., TOTP, SMS
  "secret_encrypted" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT FALSE,
  "last_used_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "version" INTEGER NOT NULL DEFAULT 1
);

-- 8. Refresh Tokens
CREATE TABLE "refresh_tokens" (
  "token" VARCHAR(255) PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "family_id" VARCHAR(255) NOT NULL,
  "is_used" BOOLEAN NOT NULL DEFAULT FALSE,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens"("family_id");
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- RLS Enforcement (except tenants and permissions which might be global or tenant-specific depending on context)
-- For identity, we will enable RLS explicitly in the repository layer using the policy builder, but we can do it here for users:
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_users" ON "users" FOR ALL USING ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_roles" ON "roles" FOR ALL USING ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_mfa_devices" ON "mfa_devices" FOR ALL USING ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_refresh_tokens" ON "refresh_tokens" FOR ALL USING ("tenant_id" = current_setting('app.tenant_id')::uuid);
