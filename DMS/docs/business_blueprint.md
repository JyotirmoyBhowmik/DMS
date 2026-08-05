# Enterprise DMS & SFA Platform — Business Blueprint (BBP)

**Document version:** 1.0.0 · **Release train:** Phase 1 (Platform v1.0.0) · **Status:** Draft for sign-off
**Companion docs:** `DMS-SFA-Repository-Structure.md` (tree), `DMS-SFA-Files-Detail.md` (file manifest), `DMS-SFA-Phase1-Task-List.md` (build plan)

> A **version-based application**: every contract, schema, API, mobile build, database migration, ML model, and config snapshot carries an explicit, enforced version. Backward compatibility and controlled deprecation are non-negotiable acceptance criteria, not afterthoughts. See §3.

---

## Table of Contents
1. Document Control & Coverage Confirmation
2. Scope, Objectives & Guiding Principles
3. **Versioning Strategy (Version-Based Application)** — cross-cutting
4. Module Map (Bounded Contexts ↔ Services ↔ App Slices)
5. Per-Module Business Blueprint
6. New-Feature Deep-Dive (★ extended)
7. Cross-Cutting Non-Functional Requirements
8. Integration & Event Choreography
9. Phase-1 Delivery Model (Module-Based, Single Phase)
10. RACI, Risks & Assumptions

---

## 1. Document Control & Coverage Confirmation

### 1.1 Coverage — nothing removed
This blueprint is **additive** to the existing repository structure. Confirmation matrix:

| Original area | Status in plan |
|---------------|----------------|
| `apps/` (flutter, rn, web-admin) | Retained + extended (all 16 Flutter slices preserved) |
| `services/` (all 13) | Retained; each mapped to a module |
| `ai-ml/`, `packages/` (10), `contracts/` | Retained in full |
| `infrastructure/`, `observability/`, `db/`, `docs/`, `tools/`, `tests/`, `config/`, `.github/` | Retained in full |
| Root files | Retained + 2 added (`tsconfig.base.json`, `pnpm-workspace.yaml`) |

**No directory, service, package, or feature slice from the baseline was deleted, merged away, or renamed.** New items are explicitly marked **★ NEW**.

### 1.2 Document versioning
This BBP follows SemVer for documents: MAJOR = scope change, MINOR = module added, PATCH = clarification. Changes tracked in `docs/adr/` and the doc footer changelog.

---

## 2. Scope, Objectives & Guiding Principles

**Objective:** A multi-tenant, offline-first DMS (distributor side) + SFA (field side) platform with embedded AI, delivered as one coherent, versioned monorepo.

**Phase-1 scope:** ALL modules in §4 are in scope for Phase 1, organised as parallel **module workstreams** rather than sequential phases. Phase 1 ships **Platform v1.0.0** = the first fully versioned, production-grade release.

**Guiding principles:**
1. **Offline-first** — field app must function with zero connectivity; sync reconciles later.
2. **Contract-first** — `contracts/` is the source of truth; code is generated, never hand-drifted.
3. **DDD per service** — domain/application/infrastructure/presentation layering everywhere.
4. **Security & compliance by default** — PII encryption, RBAC, tamper-evident audit (SOC 2).
5. **Everything versioned** — see §3.
6. **Tenant isolation** — row-level security + tenant context on every request.

---

## 3. Versioning Strategy (Version-Based Application)

This is the central non-negotiable requirement. Each layer has an explicit versioning scheme and an enforcement gate.

### 3.1 Platform release versioning
- **Scheme:** SemVer `MAJOR.MINOR.PATCH`; Phase 1 target = **`1.0.0`**.
- **Source of truth:** Git tags `vMAJOR.MINOR.PATCH`, trunk-based development, Conventional Commits drive automated version bumps (commitlint + changesets/semantic-release).
- **Release train:** monthly minor, ad-hoc patch; each release produces an immutable, signed artifact set + SBOM.

### 3.2 API versioning (REST / GraphQL / gRPC)
- **REST:** URI-versioned — `/api/v1/...`. New breaking version = `/api/v2/...`. The version is part of the OpenAPI file name (`sfa-service.v1.yaml`).
- **Policy:** support **N and N-1** concurrently. Deprecation = `Deprecation` + `Sunset` response headers, minimum 90-day window.
- **GraphQL:** additive evolution; `@deprecated` directive on fields; no field removal within a major.
- **gRPC:** package-versioned protos (`identity.v1`); never renumber fields; reserve removed tags.
- **Gate:** `contract-checks.yml` CI fails on any backward-incompatible change without a major bump.

### 3.3 Event/schema versioning
- **Scheme:** suffix `vN` per event (`order.placed.v1.json`). Additive changes → same version; breaking → new `vN` with a **dual-publish overlap window** (v1 + v2 emitted until all consumers migrate, as the baseline already shows with `order.placed.v2`).
- **Registry:** `contracts/registry.md` lists every schema, owner, version, status (active/deprecated/retired).
- **Envelope:** `pkg-events/envelope` carries `schemaVersion`, `eventId`, `correlationId`, `occurredAt`.
- **Gate:** consumers validate against the pinned schema version; CI runs schema-compat checks.

### 3.4 Package versioning (`packages/*`)
- **Scheme:** independent SemVer per package, `CHANGELOG.md` per package, managed by changesets.
- **Consumers pin exact or caret ranges; breaking package change = major bump + migration note.**

### 3.5 Mobile app versioning (Flutter + RN)
- **Scheme:** `versionName` (SemVer) + monotonic `versionCode`/`buildNumber`.
- **Min-supported-version gate:** `config-service` publishes `minSupportedAppVersion` per platform/tenant; the app enforces **soft-nudge** then **hard force-update** below the floor (protects API/schema compatibility).
- **Feature gating** by version + flag so a new API isn't called by an app build that can't handle it.

### 3.6 Database & migration versioning
- **Scheme:** forward-only, timestamped migrations `V20260101120000__description.sql` per bounded context.
- **No destructive in-place edits;** expand-then-contract pattern for column changes.
- **Local mobile DB** (Drift/Isar/WatermelonDB) has its own monotonic schema version + migration chain.

### 3.7 ML model versioning (`ai-ml/`)
- **Scheme:** registry version `model:vN` + stage (`staging`/`production`/`archived`) + data/feature lineage hash.
- **Promotion:** shadow → canary → production; rollback to prior `vN` is one config change.
- **Prediction contracts** in `ai-ml/contracts/predictions/*.json` are versioned like events.

### 3.8 Config / feature-flag versioning
- **Scheme:** every tenant config + flag set is an immutable, versioned snapshot with rollback.
- **Rollout strategies** (percentage, ring, tenant-targeted) are versioned alongside the flag.

### 3.9 Versioning enforcement summary
| Layer | Scheme | Enforced by |
|-------|--------|-------------|
| Platform | SemVer git tags | semantic-release + commitlint |
| REST/GraphQL/gRPC | URI `/vN`, proto pkg `vN`, `@deprecated` | `contract-checks.yml` |
| Events | `eventname.vN.json` + dual-publish | schema-compat CI |
| Packages | per-pkg SemVer + changesets | release CI |
| Mobile app | versionName + min-version gate | `config-service` runtime gate |
| Database | forward-only timestamped migrations | migration runner |
| ML models | registry `vN` + stage | model-promote pipeline |
| Config/flags | versioned snapshots + rollback | `config-service` |

---

## 4. Module Map (Bounded Contexts ↔ Services ↔ App Slices)

| # | Module | Owning service(s) | App surface |
|---|--------|-------------------|-------------|
| M1 | Identity & Access | identity-service ★ | flutter `auth`, rn, web-admin guards |
| M2 | Tenant & Config | config-service ★ | all (feature-flag clients) |
| M3 | Journey Planning | sfa-service | flutter `journey-plan` |
| M4 | Visit Execution | sfa-service | flutter `visit`, rn `visit` |
| M5 | Order Capture | sfa-service | flutter `order` |
| M6 | Inventory Check | sfa-service | flutter `inventory-check` |
| M7 ★ | Merchandising | sfa-service + ai-ml vision | flutter `merchandising` |
| M8 | Survey & Audit | sfa-service | flutter `survey` |
| M9 | Payment Collection | sfa-service + finance | flutter `payment-collection` |
| M10 ★ | Van Sales | sfa-service + dms-core | flutter `van-sales` |
| M11 ★ | Outlet Onboarding & MDM | dms-core (mdm) | flutter `outlet-onboarding`, web `mdm`/`outlets` |
| M12 ★ | Competitor Intelligence | sfa-service | flutter `competitor-intel` |
| M13 ★ | Target & Incentive | dms-core + recommendation | flutter `target-incentive`, web `targets` |
| M14 ★ | Expense Management | sfa-service | flutter `expense` |
| M15 ★ | Attendance | sfa-service | flutter `attendance` |
| M16 ★ | AI Coaching / Next-Best-Action | recommendation-service + ai-gateway | flutter `coaching` |
| M17 | Distributor Management | dms-core-service | web `distributors` |
| M18 ★ | Pricing & Tax Engine | dms-core-service | web `pricing` |
| M19 ★ | Schemes & Trade Promotions | dms-core-service | web `schemes` |
| M20 ★ | Claims & Settlement | dms-core-service | web `claims` |
| M21 ★ | Returns Management | dms-core-service | web `returns` |
| M22 ★ | Delivery / Dispatch / POD | dms-core-service + ai-ml routing | web `delivery` |
| M23 ★ | Finance & Receivables | dms-core-service | web `finance` |
| M24 ★ | Distributor Self-Service Portal | dms-core-service | web `distributor-portal` |
| M25 ★ | Sync & Offline | sync-service | all mobile `sync` |
| M26 ★ | Notifications | notification-service | all |
| M27 ★ | File / Media | file-service | all |
| M28 ★ | Audit & Compliance | audit-service | web (audit views) |
| M29 | Reporting | report-service | web `reports`/`dashboards` |
| M30 ★ | AI/ML Platform | ai-ml + ai-gateway + forecasting | web `forecasting` |
| M31 | API Gateway & Mesh | api-gateway | n/a |
| M32 ★ | Observability | observability/ | n/a |
| M33 ★ | Infrastructure & DevSecOps | infrastructure/ | n/a |

---

## 5. Per-Module Business Blueprint

> Format per module: **Process** · **Scope items** · **Key entities** · **APIs/Events (versioned)** · **Acceptance** · **Initial version**.

### M1 — Identity & Access
- **Process:** Login (password/OTP/SSO) → device binding → token issue → biometric unlock → RBAC enforcement → refresh/revoke.
- **Scope:** users, roles, permissions, tenants, sessions, tokens, device registry, JWT/JWKS.
- **Entities:** User, Role, Permission, Tenant, Session, Device, Token.
- **APIs/Events:** `identity-service.v1.yaml` (`/api/v1/auth/*`), `token.proto` (`identity.v1`); events `user.created.v1`, `role.assigned.v1`.
- **Acceptance:** RBAC denies by default; token rotation works; tenant claims present in every token.
- **Version:** API v1, events v1.

### M2 — Tenant & Config
- **Process:** Resolve tenant → load versioned config snapshot → evaluate flags by ring/percentage → enforce min-app-version.
- **Scope:** tenant templates, feature flags, rollout strategies, min-supported-app-version.
- **Entities:** Tenant, TenantConfig, FeatureFlag, RolloutStrategy.
- **APIs/Events:** `/api/v1/config`, `/api/v1/flags`; `flag.changed.v1`, `tenant.config.updated.v1`.
- **Acceptance:** config rollback restores prior snapshot; force-update triggers below floor version.
- **Version:** config snapshots versioned; API v1.

### M3 — Journey Planning
- **Process:** Define PJP/beat → assign to agent → dynamic re-route → beat-adherence tracking.
- **Scope:** permanent journey plans, beats, coverage, re-route.
- **Entities:** JourneyPlan, Beat, RoutePoint.
- **APIs/Events:** `/api/v1/journey-plans`; `journey.assigned.v1`.
- **Acceptance:** offline-available plan; adherence computed from geo check-ins.
- **Version:** API v1.

### M4 — Visit Execution
- **Process:** Geo check-in → mandatory steps → notes/photos → check-out (offline-capable).
- **Scope:** visit lifecycle, mandatory-step config, geo-fencing.
- **Entities:** Visit (aggregate), VisitStep, GeoPoint (VO).
- **APIs/Events:** `/api/v1/visits`; `visit.completed.v1`.
- **Acceptance:** visit completes fully offline and reconciles on sync.
- **Version:** API v1, event v1.

### M5 — Order Capture
- **Process:** Build cart → live pricing/scheme application → credit validation → place (offline) → sync.
- **Scope:** secondary order capture, pricing/scheme integration, credit check.
- **Entities:** Order (aggregate), OrderLine, Money/Quantity/Discount (VOs).
- **APIs/Events:** `/api/v1/orders`; `order.placed.v1` **and** `order.placed.v2` (dual-publish during migration).
- **Acceptance:** prices computed offline match server; idempotent on replay.
- **Version:** API v1, events v1+v2.

### M6 — Inventory Check
- **Process:** Stock audit → near-expiry/batch capture → variance report.
- **Entities:** StockCount, Batch, ExpiryRecord.
- **APIs/Events:** `/api/v1/inventory-checks`; `inventory.counted.v1`.
- **Version:** API v1.

### M7 ★ — Merchandising
- See §6.1.

### M8 — Survey & Audit
- **Process:** Render configurable form → capture responses/photos → submit.
- **Entities:** SurveyDefinition (versioned), SurveyResponse.
- **APIs/Events:** `/api/v1/surveys`; `survey.submitted.v1`. **Survey definitions are versioned** so historical responses map to the form version answered.
- **Version:** API v1; survey definition vN.

### M9 — Payment Collection
- **Process:** Record field collection → issue receipt → reconcile against receivables.
- **Entities:** Collection, Receipt, ReconciliationEntry.
- **APIs/Events:** `/api/v1/collections`; `payment.collected.v1`.
- **Version:** API v1.

### M10–M16 ★ — see §6.2–§6.8.

### M17 — Distributor Management
- **Process:** Distributor master, hierarchy, primary order, stock visibility.
- **Entities:** Distributor, DistributorHierarchy, PrimaryOrder.
- **APIs/Events:** `dms-core-service.v1.yaml`; `distributor.created.v1`.
- **Version:** API v1.

### M18 ★ — see §6.9 (Pricing & Tax). M19 ★ Schemes — §6.10. M20 ★ Claims — §6.11. M21 ★ Returns — §6.12. M22 ★ Delivery/POD — §6.13. M23 ★ Finance — §6.14. M24 ★ Distributor Portal — §6.15.

### M25 ★ — Sync & Offline
- **Process:** Outbox → ordered replay (idempotency keys) → conflict detection/resolution → status.
- **Entities:** SyncSession, Mutation, ConflictResolution.
- **APIs/Events:** `sync.proto` (`sync.v1`); `sync.completed.v1`, `conflict.detected.v1`.
- **Acceptance:** no data loss across airplane-mode→reconnect; conflicts resolved per policy.
- **Version:** proto v1.

### M26 ★ — Notifications
- **Process:** Trigger → template render → channel fan-out (push/SMS/email/in-app) → preference honoring.
- **Entities:** Notification, Template (versioned), Channel, Preference.
- **APIs/Events:** `/api/v1/notifications`; `notification.sent.v1`.
- **Version:** API v1; templates vN.

### M27 ★ — File / Media
- **Process:** Signed-URL upload → virus scan → object-store persist → CDN serve.
- **Entities:** FileObject, UploadSession.
- **APIs/Events:** `/api/v1/files`; `file.uploaded.v1`.
- **Version:** API v1.

### M28 ★ — Audit & Compliance
- **Process:** Consume all domain events → append-only hash-chained audit log → tamper-evidence verification.
- **Entities:** AuditEvent (append-only), HashChainAnchor.
- **APIs/Events:** consumes all; `audit.recorded.v1`.
- **Acceptance:** chain verification detects any tampering; SOC 2 evidence exportable.
- **Version:** API v1.

### M29 — Reporting
- **Process:** Read-replica queries → report builder → role-aware dashboards.
- **Entities:** ReportDefinition (versioned), read models.
- **APIs/Events:** `report-service.v1.yaml`, `reporting.graphql`; consumes events, publishes none.
- **Version:** API v1.

### M30 ★ — AI/ML Platform
- See §6.16.

### M31 — API Gateway & Mesh
- **Process:** mTLS termination → rate limiting → JWT verify → route to service version.
- **Scope:** Nginx/Envoy config, rate-limit policies, route maps, version routing.
- **Acceptance:** `/api/v1` and `/api/v2` route correctly; mTLS enforced mesh-wide.
- **Version:** routes per API version.

### M32 ★ — Observability
- **Process:** OTel traces/metrics/logs → collector → dashboards + SLO burn alerts; PII scrubbed before export.
- **Acceptance:** every request traceable by correlationId; security alerts fire on anomalous unmask.

### M33 ★ — Infrastructure & DevSecOps
- **Process:** Terraform per cloud → Helm deploy → vault secrets → cert-manager mTLS → security scan gates.
- **Acceptance:** reproducible env from code; secrets never in git; scans block release on critical findings.

---

## 6. New-Feature Deep-Dive (★ extended)

> Each new feature is expanded into: business process, sub-features (extension), data model, integrations, AI hooks, edge cases, and version baseline.

### 6.1 Merchandising (M7)
- **Process:** Capture shelf photo → detect planogram compliance → compute share-of-shelf → flag gaps → corrective task.
- **Sub-features (extended):** planogram template library (versioned), shelf-share % by brand/SKU, out-of-stock detection, competitor adjacency, before/after photo pairing, auto-task creation for non-compliance.
- **Data model:** PlanogramTemplate(v), ShelfCapture, ComplianceScore, ShareOfShelf.
- **Integrations:** `file-service` (photos), `ai-ml/models/vision` (planogram model `vN`), `notification-service` (gap alerts), `sfa-service` visit.
- **AI hook:** vision model returns compliance + SoS; prediction contract `planogram.compliance.v1`.
- **Edge cases:** poor lighting/blur (quality gate), offline capture queued, partial shelf.
- **Version:** API v1, vision model v1, planogram templates vN.

### 6.2 Van Sales (M10)
- **Process:** Load van stock → travel beat → immediate invoice/sale at outlet → cash/credit → end-of-day unload reconciliation.
- **Sub-features (extended):** van load/unload sheets, on-vehicle live inventory, immediate GST/VAT invoice, cash drawer reconciliation, stock transfer between vans, damage/return-to-warehouse, settlement at day close.
- **Data model:** VanStock, LoadSheet, VanInvoice, CashReconciliation.
- **Integrations:** `dms-core` inventory + pricing/tax (M18) for compliant invoices, `payment-collection`, `file-service` (signed invoice).
- **Edge cases:** stock-out mid-route, negative reconciliation, offline invoicing with sequential invoice numbering.
- **Version:** API v1; invoice numbering scheme versioned per tenant.

### 6.3 Outlet Onboarding & MDM (M11)
- **Process:** Geo-tagged registration → KYC document capture → dedup against MDM golden records → approval → golden-record creation.
- **Sub-features (extended):** KYC OCR, GST/PAN validation, duplicate/fuzzy-match detection, hierarchy assignment, approval workflow, golden-record survivorship rules, change governance/audit.
- **Data model:** OutletApplication, GoldenRecord, MatchCandidate, KycDocument.
- **Integrations:** `file-service` (KYC docs), `ai-ml/models/anomaly` (dedup/fuzzy match), `audit-service`, external GST/PAN API adapter.
- **Edge cases:** near-duplicate outlets, offline registration, KYC rejection re-submit.
- **Version:** API v1; survivorship ruleset versioned.

### 6.5 Target & Incentive (M13)
- See §6.5 in supplied text (volume/value/coverage targets, slab-based incentives).

### 6.9 Pricing & Tax Engine (M18)
- See §6.9 in supplied text (price list resolution, GST/VAT rules, versioned price lists).

---
*BBP v1.0.0 — Phase 1 / Platform v1.0.0. Changelog tracked in `docs/adr/`.*
