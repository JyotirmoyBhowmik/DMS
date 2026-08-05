# Customer Tenant Onboarding Runbook (< 30 Minutes)

This operational runbook details step-by-step instructions for onboarding a new enterprise or self-service customer tenant into the Distribution Management System (DMS) platform.

---

## 1. Prerequisites
- Access to production deployment shell with `terraform`, `kubectl`, `helm`, and `pnpm` CLI tools.
- `VAULT_TOKEN` with write permissions to `secret/tenants/`.
- Cloudflare API token for DNS record creation.

---

## 2. Automated Onboarding Execution (< 15 Minutes)

Run the single-command automated onboarding script:
```bash
./scripts/provision-tenant.sh <tenant_code> <plan_tier> <admin_email>
```

Example:
```bash
./scripts/provision-tenant.sh apex STARTER admin@apexdistributors.com
```

### What the Automated Script Executes:
1. **Terraform Ingress & Vault Engine**: Provisions `secret/tenants/<tenant_code>` in Vault and creates CNAME record `<tenant_code>.dmsenterprise.com` pointing to API Gateway ingress.
2. **Database Isolation Setup**: Enables Row-Level Security policies and creates default price schemes and warehouses.
3. **Provisioning API**: Triggers `/api/v1/identity/tenants/provision` creating the tenant aggregate entity, assigning default channel modules, and issuing a welcome token for `tenant_admin`.

---

## 3. Post-Onboarding Verification Checklist

- [ ] **DNS Resolution**: `nslookup <tenant_code>.dmsenterprise.com` resolves to Cloudflare proxy.
- [ ] **Host-Based Tenant Resolution**: Test request with Host header returns correct tenant context:
  ```bash
  curl -I https://<tenant_code>.dmsenterprise.com/api/v1/health
  ```
- [ ] **Admin Login**: Welcome email sent to customer admin with initial password reset link.
- [ ] **ERP & Channel Module Handshake**: Log in as `tenant_admin` and test ERP connector handshake under Tenant Self-Service Portal.
