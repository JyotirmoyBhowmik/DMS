# Living Compliance Evidence Mapping (SOC 2, India DPDP Act 2023, GDPR)

This document formalizes system controls and automated evidence mappings for **SOC 2 Type II (Trust Services Criteria)**, **India Digital Personal Data Protection (DPDP) Act 2023**, and **EU GDPR**.

---

## 1. Compliance Matrix Overview

| Standard / Mandate | Control Area | Technical Implementation | Code Base Evidence & Files |
| :--- | :--- | :--- | :--- |
| **SOC 2 CC6.1** | Logical Access Control | Host & JWT claim-based tenant isolation with RBAC guards | [`tenant_resolver.ts`](file:///c:/Users/TEST/DMS/services/api-gateway/src/middleware/tenant_resolver.ts), `pkg-rbac` |
| **SOC 2 CC6.3** | Network Boundary Protection | Istio mTLS STRICT PeerAuthentication & Kubernetes NetworkPolicies | [`network-policies.yaml`](file:///c:/Users/TEST/DMS/infrastructure/k8s/network-policies.yaml) |
| **SOC 2 CC6.6** | Encryption at Rest | Envelope Encryption (DEK/KEK in Vault) & AES-256-GCM column encryption | [`envelope_encryption.ts`](file:///c:/Users/TEST/DMS/packages/pkg-crypto/src/envelope/envelope_encryption.ts) |
| **SOC 2 CC7.2** | Audit Trail Completeness | Immutable outbox event logging on all mutating endpoints | [`V047__enforce_rls_all_tables.sql`](file:///c:/Users/TEST/DMS/db/migrations/dms/V047__enforce_rls_all_tables.sql) |
| **DPDP Act §6** | Personal Data Redaction | Runtime PII classifier & masking for phone numbers, PAN, GSTIN | [`pii_classifier.ts`](file:///c:/Users/TEST/DMS/packages/pkg-crypto/src/pii/pii_classifier.ts) |
| **DPDP Act §9** | Data Residency | Region-pinned Postgres & S3 storage routing (`ap-south-1`) | [`data_residency.ts`](file:///c:/Users/TEST/DMS/services/identity-service/src/domain/services/data_residency.ts) |
| **GDPR Art. 32** | Security of Processing | Database-wide Row-Level Security (RLS) enforcement on all tables | [`V047__enforce_rls_all_tables.sql`](file:///c:/Users/TEST/DMS/db/migrations/dms/V047__enforce_rls_all_tables.sql) |
| **GDPR Art. 25** | Data Protection by Default | Tenant-aware Redis sliding window rate limiting | [`tenant_rate_limiter.ts`](file:///c:/Users/TEST/DMS/services/api-gateway/src/middleware/tenant_rate_limiter.ts) |

---

## 2. Technical Control Details

### 2.1 Multi-Tenant Row-Level Security (RLS)
Every database query executes inside a transaction bound by:
```sql
SET LOCAL app.tenant_id = '<tenant_uuid>';
```
Row Level Security policies prevent cross-tenant reads or writes regardless of SQL injection attempts.

### 2.2 Per-Tenant Envelope Encryption (DEK/KEK)
Data Encryption Keys (DEKs) are generated per tenant and wrapped using the platform Key Encryption Key (KEK) stored in HashiCorp Vault at `secret/data/kek`.

### 2.3 Zero-Trust Service Mesh & NetworkPolicies
Services accept incoming TCP traffic ONLY on internal port bindings from `api-gateway` pods. All unencrypted or unauthorized pod-to-pod connections are dropped at the ingress layer.

### 2.4 Audit & Secrets Rotation Standard
Secrets (`PLATFORM_KEK_SECRET`, `JWT_SECRET`, database passwords) are supplied dynamically at runtime via environment variables and HashiCorp Vault. Zero plaintext secrets exist in version control.
