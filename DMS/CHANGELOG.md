# DMS & SFA Monorepo Changelog

This monorepo adheres to Semantic Versioning (SemVer 2.0.0).

## 🛡️ Versioning Policy
* **Stable Packages**: Major version changes (`x.0.0`) are reserved for breaking API changes. Patch versions are for bugfixes, and minor versions are for additive features.
* **Additive-Only Rule**: To maintain backward compatibility with offline mobile clients, stable message and event schemas MUST be additive-only. Removing fields or changing types on existing schemas requires a new version payload definition (e.g. migrating from `order.placed.v1` to `order.placed.v2`).
* **Independent Package Releases**: Packages in `packages/` and services in `services/` are versioned independently, tracked via Git tags in the format `<package-name>@v<version>` (e.g., `@dms/pkg-crypto@v1.0.0`).

---

## [1.0.0] - 2026-06-02
Initial release of the multi-tenant Distributor Management System (DMS) & Sales Force Automation (SFA) monorepo.

### Added
* **Packages**:
  - `@dms/pkg-crypto`: AES-256-GCM symmetric ciphers, HMAC, KDF, RSA/ECC envelope encryption, and Vault transit integration.
  - `@dms/pkg-events`: Timestamp-ordered UUIDv7 event envelopes, JSON codecs, high-density Varint/TLV Protobuf codecs, and positional Avro codecs.
  - `@dms/pkg-http`: Resilient HTTP Client with circuit breakers, exponential backoffs, and jitter retry rules.
  - `@dms/pkg-rbac`: Fine-grained wildcard matching RBAC checks with reflect decorators.
  - `@dms/pkg-validation`: Common Zod schemas (Money, GeoPoint, TenantId), ValidationError class, and credit/journey window rules.
  - `@dms/pkg-logger`: Structured JSON logging with context correlation and PII redactor.
  - `@dms/pkg-database`: ORM encryption decorators, Row-Level Security (RLS) helpers, and Unit of Work.
  - `@dms/pkg-testing`: Generic test factories for user, distributor, product, and order entities.
* **Services**:
  - `identity-service`, `sfa-service`, `dms-core-service`, `sync-service`, `audit-service`, `ai-gateway-service`, `forecasting-service`, `recommendation-service`, `config-service`, `notification-service`, `file-service`, `report-service`, and `api-gateway`.
* **Contracts**:
  - Versioned OpenAPI YAML, gRPC Protobufs, GraphQL schemas, and JSON schema events cataloged in `contracts/registry.md`.
