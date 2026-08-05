# Enterprise DMS & SFA Platform — Master Roadmap Task List

This master task list serves as the technical checklist for transitioning the platform from a simulated/mock setup to a real-world enterprise production deployment.

---

## 📅 Master Implementation Matrix

| Epic / Workstream | Component / Service | Task | Layer | Priority | Dependencies | Current Status | Phase | Owner |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Data & Persistence** | `pkg-database` | Build real Postgres connection pool, config, health checks | Backend | P0 | - | Stub | P1 Foundation | |
| **Data & Persistence** | All services | Replace in-memory Map repositories with Postgres repositories | Backend | P0 | `pkg-database` | Mock | P1 Foundation | |
| **Data & Persistence** | `db` | Migration runner + CI gating + rollback strategy | DB | P0 | - | Good | P1 Foundation | |
| **Data & Persistence** | All services | Remove hardcoded/mock IDs; real UUID + FK integrity | Backend | P0 | Postgres repos | Mock | P1 Foundation | |
| **Eventing & Messaging**| `pkg-events` | Provision message broker (Kafka/RabbitMQ) + topics | Infra | P0 | - | Missing | P1 Foundation | |
| **Eventing & Messaging**| All services | Transactional outbox dispatcher (poller -> broker) | Backend | P0 | Broker, Postgres | Missing | P1 Foundation | |
| **Eventing & Messaging**| All services | Idempotent consumers + dead-letter handling | Backend | P0 | Broker | Missing | P1 Foundation | |
| **Identity & Security** | `identity-service` | OAuth2 / OIDC + JWT issuance & refresh | Backend | P0 | Postgres repos | Partial | P1 Foundation | |
| **Identity & Security** | `pkg-rbac` | RBAC enforcement middleware across all services | Backend | P0 | OAuth2 | Stub | P1 Foundation | |
| **Identity & Security** | `db/policies` | Wire RLS tenant isolation at runtime (set tenant context) | Backend | P0 | Postgres repos | Designed | P1 Foundation | |
| **Identity & Security** | `pkg-crypto` | Secrets management (vault) + column encryption at runtime | Security | P0 | - | Partial | P1 Foundation | |
| **Identity & Security** | `api-gateway` | Gateway auth, rate limiting, request validation, CORS | Backend | P0 | OAuth2 | Scaffold | P1 Foundation | |
| **Vertical Slice** | `sfa-service` | Real PlaceOrder use case: persist + publish order.placed | Backend | P0 | Postgres repos, outbox | Mock | P2 Vertical Slice | |
| **Vertical Slice** | `dms-core-service` | Consume order.placed -> reserve inventory -> update stock | Backend | P0 | Consumers | Mock | P2 Vertical Slice | |
| **Vertical Slice** | `mobile-flutter` | Auth + order capture screen calling real API | Mobile | P0 | Gateway auth | Empty | P2 Vertical Slice | |
| **Vertical Slice** | `web-admin` | Replace simulated state with real gateway API calls | Web | P0 | Gateway auth | Simulation | P2 Vertical Slice | |
| **Vertical Slice** | All | End-to-end test of the order vertical (mobile->DMS->admin) | QA | P0 | Above 4 | Missing | P2 Vertical Slice | |
| **DMS Modules** | `dms-core-service` | Distributor lifecycle: onboarding, KYC, hierarchy, credit limits | Backend | P0 | Postgres repos | Mock | P3 DMS/SFA | |
| **DMS Modules** | `dms-core-service` | Inventory: batch, expiry, FEFO, near-expiry alerts, stock ledger | Backend | P0 | Postgres repos | Mock | P3 DMS/SFA | |
| **DMS Modules** | `pricing-service` (new) | Pricing engine: price lists, slabs, geo/channel rules | Backend | P0 | Postgres repos | Missing | P3 DMS/SFA | |
| **DMS Modules** | `finance-service` (new) | Invoicing + tax/GST + e-invoice / e-way bill compliance | Backend | P0 | Pricing | Missing | P3 DMS/SFA | |
| **SFA Modules** | `sfa-service` | Journey/beat plan (PJP) + adherence tracking | Backend | P0 | Postgres repos | Scaffold | P3 DMS/SFA | |
| **SFA Modules** | `sfa-service` | Geo-tagged attendance + check-in/out + GPS trail | Backend+Mobile | P0 | Mobile app | Scaffold | P3 DMS/SFA | |
| **Mobile Field App** | `mobile-flutter` | Offline-first local DB (SQLite/Drift) schema | Mobile | P0 | - | Empty | P3 DMS/SFA | |
| **Mobile Field App** | `sync-service` | Bidirectional sync engine + conflict resolution | Mobile+Backend | P0 | Offline DB, Eventing | Stub | P3 DMS/SFA | |
| **Mobile Field App** | `mobile-flutter` | GPS, geofence check-in, background location | Mobile | P0 | Offline DB | Empty | P3 DMS/SFA | |
| **Mobile Field App** | `mobile-flutter` | Order booking, catalog browsing, cart, draft orders | Mobile | P0 | Offline DB | Empty | P3 DMS/SFA | |
| **Mobile Field App** | `apps` | Decide mobile stack (consolidate Flutter vs RN) | Mobile | P0 | - | Empty | P2 Vertical Slice | |
| **DevOps & Infra** | `infrastructure` | CI/CD pipelines (build, test, scan, deploy) | DevOps | P0 | - | Partial | P1 Foundation | |
| **DevOps & Infra** | `infrastructure` | Containerization + image registry + SBOM | DevOps | P0 | - | Partial | P1 Foundation | |
| **DevOps & Infra** | `infrastructure` | Secrets/KMS, network policy, backup & DR | DevOps | P0 | IaC | Missing | P5 Hardening | |
| **Compliance & Localization** | `finance-service` | Tax/e-invoice compliance (Nepal IRD / region rules) | Backend | P0 | Invoicing | Missing | P3 DMS/SFA | |

---

## 🔐 Epic 1 — Identity, Access Control & Core Security

### 1.1 Multi-Factor Authentication & SSO
- [ ] Connect `identity-service` to an OAuth2/OpenID Connect provider (e.g., Keycloak, Okta, AWS Cognito).
- [ ] Implement TOTP-based Multi-Factor Authentication (MFA) endpoints and backup code generation.
- [ ] Integrate SMS OTP gateway service providers for mobile-native login fallback flows.
- [ ] Implement mobile-device biometric bindings (FaceID/Fingerprint) during authentication checks.

### 1.2 Access Policies & Segregation
- [x] Implement Role-Based Access Control (RBAC) authorization predicates in `pkg-rbac`.
- [x] Configure Postgres Row-Level Security (RLS) policies for multi-tenant data segregation.
- [x] Define automated database tests validating cross-tenant denial boundaries.
- [ ] Build tenant administration dashboard UI to create roles, customize permissions, and manage user memberships.

### 1.3 Cryptographic Ledger Audit Log
- [x] Implement block hash-chaining and tamper-detection verification sweeps in `audit-service`.
- [ ] Configure RabbitMQ/Kafka consumer to automatically capture core financial/inventory mutations and write audit blocks.
- [ ] Build SOC 2 compliant read-only views for external compliance auditors to search audit ledgers.

### 1.4 Cryptographic Primers & PII Redaction
- [x] Complete AES-256-GCM symmetric encryption/decryption utilities in `pkg-crypto` and mobile clients.
- [x] Define `@PII` database annotations and deep logger redactors in `pkg-logger` to strip PII in telemetry pipelines.
- [ ] Add static analysis checks in CI/CD pipeline blocking PRs containing unredacted log calls.

---

## 🎯 Epic 2 — Core Sales Force Automation (SFA)

### 2.1 Visit & Journey Enforcement
- [x] Implement beat-adherence criteria (`JourneyPolicy`) in SFA service.
- [x] Implement visit checkout geofence validation and detour suggestion engine.
- [ ] Connect SFA visit handlers to Mapbox/Google Maps Directions API to fetch road-distance metrics.
- [ ] Implement mobile native GPS spoofing check logic to block mock coordinates.
- [ ] Implement journey exceptions request workflows for sales reps requiring ad-hoc beat changes.

### 2.2 Order Capture & Schemes
- [x] Implement stackable slab scheme evaluation and volume break discounts (`SchemePolicy`).
- [x] Implement credit hold validations during processing (`ProcessOrderUseCase`).
- [x] Implement MOQ/MOV validation boundaries on cart submissions.
- [ ] Setup configurations dashboard for regional schemes management.

### 2.3 Off-line Synchronization Engine
- [x] Implement client-side OutboxStore and server-side idempotency consumer checks.
- [x] Implement differential data synchronization protocol to limit payload sync packet size.
- [ ] Deploy GZIP payload compression and connection recovery retry filters in the mobile apps.

### 2.4 Mobile User Extensions
- [ ] Build field force attendance tracking, shift schedules, and check-in rosters.
- [ ] Implement expense management log for travel, allowances, and receipt upload forms.
- [ ] Integrate mobile Bluetooth printing bindings (ESC/POS) for on-field thermal receipt issuance.
- [ ] Develop dynamic survey forms configuration schema and responsive mobile renderer.
- [ ] Add joint-working coaching visits flags to regional managers' check-in options.
- [ ] Incorporate in-app LMS training files, quiz questions, and score progress tracking.
- [ ] Implement mobile peer-to-peer social feeds and WebSockets notifications.
- [ ] Develop voice-to-text dictate order entry using mobile-native Speech API hooks.

---

## 📦 Epic 3 — Distributor Management System (DMS Core)

### 3.1 Primary & Secondary Sales Engine
- [x] Define secondary sales aggregates and invoicing formulas.
- [x] Implement warehouse stock adjustment, reserve, and release workflows in `InventoryAggregate`.
- [ ] Setup primary distributor order submission forms and invoice matching ledgers.

### 3.2 Inventory Management & FEFO
- [x] Implement FEFO batch evaluation logic sorting batch selection by expiration date.
- [x] Implement warehouse stock variance logs and reconciliation endpoints.
- [x] Implement digital stock quarantine transitions for defective/expired lots.
- [ ] Build warehouse visual layout mapping tools for bin and rack coordination.
- [ ] Develop wave-picking and zone-picking optimization paths for stock collectors.
- [ ] Build Serial Number and IMEI catalog matching fields for high-value distribution validation.

### 3.3 Claims, Returns & Accounting
- [x] Implement Claim Aggregate state machine (`DRAFT` to `SETTLED`) and verification tolerances.
- [x] Complete reverse logistics return assessment and refund claim generation.
- [ ] Set up automated Month-End Close (MEC) lock crons preventing backdated ledger modifications.
- [ ] Integrate TDS / TCS calculation rules during B2B invoicing.
- [ ] Add supply chain finance/working capital loan application forms inside the distributor portal.
- [ ] Develop Returnable Transport Packaging (RTP) balances tracking matrices.

### 3.4 Portals & Self-Service
- [~] Design distributor portal web dashboards mockups.
- [ ] Build distributor ledger query screens, invoice downloads, and credit balance trackers.
- [ ] Build new retailer KYC document uploads validation workflows (linking GSTIN/PAN APIs).
- [ ] Implement multi-tier hierarchy mappings resolving Super-Stockist, C&F, and Sub-Distributors.
- [ ] Standardize local currencies and i18n translations dynamically resolved from user profile flags.

---

## 🔌 Epic 4 — Enterprise Integrations & Government Systems

### 4.1 ERP Bi-directional Sync
- [ ] Setup ESB (Enterprise Service Bus) adapter connecting RabbitMQ/Kafka events to SAP RFC.
- [ ] Develop bi-directional sync interfaces for Oracle Fusion and Microsoft Dynamics Web Services.
- [ ] Build conflict resolution queue panels to handle data mismatch reports between DMS and ERP.

### 4.2 E-Invoicing & Compliance
- [ ] Implement government-registered e-invoicing sandboxes APIs adapters.
- [ ] Integrate e-way bill portals authentication APIs for automated transportation document signing.
- [ ] Develop automated compliance tracking warning schedulers alert notifications on expired drug/FSSAI certificates.

---

## 📈 Epic 5 — Analytics, BI & Observability

### 5.1 Reporting & BI Tools
- [ ] Setup read-replica Postgres databases schemas optimized for complex analytics reporting.
- [ ] Integrate embedded BI frames (PowerBI Embedded, Apache Superset) inside the admin dashboards.
- [ ] Build ad-hoc reporting SQL builder with schema exploration boundaries.
- [ ] Implement geospatial sales density overlays (Mapbox GL Heatmaps).

### 5.2 Performance & Carbon Telemetry
- [ ] Connect travel mileage records to greenhouse emissions factor libraries for carbon footprint reports.
- [ ] Build distributor gross-margin/profitability calculators linking sales and operational expense matrices.

---

## 🤖 Epic 6 — AI & Forecasting Platform

### 6.1 Prediction & Conversational Engines
- [~] Setup AI Gateway LLM inference endpoint schemas and prompt templates.
- [ ] Train recommender model utilizing regression networks and deploy prediction server.
- [ ] Connect conversational NLP queries with SQL generators querying reporting read-replicas.
- [ ] Build predictive retailer churn alerts flag engines in `forecasting-service`.

### 6.2 Computer Vision
- [ ] Train Planogram compliance computer vision models to identify SKU shelf-share percentages.
- [ ] Implement planogram photo audit validation endpoints in `ai-gateway-service`.

---

## 🛠️ Detailed SFA & DMS Domain Module Sub-tasks

Each of the core aggregate modules follows a strict development checklist covering database, domain models, persistence, use cases, eventing, API routes, security validation, and mobile offline syncing.

### 1. SFA Module Components

```carousel
#### 📑 SalesOrder
- [ ] SalesOrder: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] SalesOrder: domain entity / aggregate model (`Backend` · P0)
- [ ] SalesOrder: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] SalesOrder: Create use case (`Backend` · P0 · Dep: SalesOrder repo)
- [ ] SalesOrder: Get / detail use case (`Backend` · P0 · Dep: SalesOrder repo)
- [ ] SalesOrder: Update use case (`Backend` · P0 · Dep: SalesOrder repo)
- [ ] SalesOrder: List / search use case (pagination, filters) (`Backend` · P0 · Dep: SalesOrder repo)
- [ ] SalesOrder: domain validation rules (`Backend` · P0)
- [ ] SalesOrder: business rules & state transitions (`Backend` · P0)
- [ ] SalesOrder: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] SalesOrder: event consumer / projection handler (`Backend` · P0 · Dep: Broker)
- [ ] SalesOrder: API controller & routes (`Backend` · P0 · Dep: SalesOrder use cases)
- [ ] SalesOrder: DTOs & request/response mapping (`Backend` · P0)
- [ ] SalesOrder: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] SalesOrder: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 OrderApproval
- [ ] OrderApproval: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] OrderApproval: domain entity / aggregate model (`Backend` · P0)
- [ ] OrderApproval: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] OrderApproval: Create use case (`Backend` · P0 · Dep: OrderApproval repo)
- [ ] OrderApproval: Get / detail use case (`Backend` · P0 · Dep: OrderApproval repo)
- [ ] OrderApproval: Update use case (`Backend` · P0 · Dep: OrderApproval repo)
- [ ] OrderApproval: List / search use case (pagination, filters) (`Backend` · P0 · Dep: OrderApproval repo)
- [ ] OrderApproval: domain validation rules (`Backend` · P0)
- [ ] OrderApproval: business rules & state transitions (`Backend` · P0)
- [ ] OrderApproval: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] OrderApproval: event consumer / projection handler (`Backend` · P0 · Dep: Broker)
- [ ] OrderApproval: API controller & routes (`Backend` · P0 · Dep: OrderApproval use cases)
- [ ] OrderApproval: DTOs & request/response mapping (`Backend` · P0)
- [ ] OrderApproval: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
<!-- slide -->
#### 📑 JourneyPlan (PJP)
- [ ] JourneyPlan (PJP): DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] JourneyPlan (PJP): domain entity / aggregate model (`Backend` · P0)
- [ ] JourneyPlan (PJP): Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] JourneyPlan (PJP): Create use case (`Backend` · P0 · Dep: JourneyPlan repo)
- [ ] JourneyPlan (PJP): Get / detail use case (`Backend` · P0 · Dep: JourneyPlan repo)
- [ ] JourneyPlan (PJP): Update use case (`Backend` · P0 · Dep: JourneyPlan repo)
- [ ] JourneyPlan (PJP): List / search use case (pagination, filters) (`Backend` · P0 · Dep: JourneyPlan repo)
- [ ] JourneyPlan (PJP): domain validation rules (`Backend` · P0)
- [ ] JourneyPlan (PJP): business rules & state transitions (`Backend` · P0)
- [ ] JourneyPlan (PJP): publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] JourneyPlan (PJP): API controller & routes (`Backend` · P0 · Dep: JourneyPlan use cases)
- [ ] JourneyPlan (PJP): DTOs & request/response mapping (`Backend` · P0)
- [ ] JourneyPlan (PJP): RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] JourneyPlan (PJP): mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 BeatRoute
- [ ] BeatRoute: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] BeatRoute: domain entity / aggregate model (`Backend` · P0)
- [ ] BeatRoute: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] BeatRoute: Create use case (`Backend` · P0 · Dep: BeatRoute repo)
- [ ] BeatRoute: Get / detail use case (`Backend` · P0 · Dep: BeatRoute repo)
- [ ] BeatRoute: Update use case (`Backend` · P0 · Dep: BeatRoute repo)
- [ ] BeatRoute: List / search use case (pagination, filters) (`Backend` · P0 · Dep: BeatRoute repo)
- [ ] BeatRoute: domain validation rules (`Backend` · P0)
- [ ] BeatRoute: business rules & state transitions (`Backend` · P0)
- [ ] BeatRoute: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] BeatRoute: API controller & routes (`Backend` · P0 · Dep: BeatRoute use cases)
- [ ] BeatRoute: DTOs & request/response mapping (`Backend` · P0)
- [ ] BeatRoute: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] BeatRoute: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 Visit
- [ ] Visit: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] Visit: domain entity / aggregate model (`Backend` · P0)
- [ ] Visit: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] Visit: Create use case (`Backend` · P0 · Dep: Visit repo)
- [ ] Visit: Get / detail use case (`Backend` · P0 · Dep: Visit repo)
- [ ] Visit: Update use case (`Backend` · P0 · Dep: Visit repo)
- [ ] Visit: List / search use case (pagination, filters) (`Backend` · P0 · Dep: Visit repo)
- [ ] Visit: domain validation rules (`Backend` · P0)
- [ ] Visit: business rules & state transitions (`Backend` · P0)
- [ ] Visit: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] Visit: event consumer / projection handler (`Backend` · P0 · Dep: Broker)
- [ ] Visit: API controller & routes (`Backend` · P0 · Dep: Visit use cases)
- [ ] Visit: DTOs & request/response mapping (`Backend` · P0)
- [ ] Visit: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] Visit: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 Attendance
- [ ] Attendance: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] Attendance: domain entity / aggregate model (`Backend` · P0)
- [ ] Attendance: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] Attendance: Create use case (`Backend` · P0 · Dep: Attendance repo)
- [ ] Attendance: Get / detail use case (`Backend` · P0 · Dep: Attendance repo)
- [ ] Attendance: Update use case (`Backend` · P0 · Dep: Attendance repo)
- [ ] Attendance: List / search use case (pagination, filters) (`Backend` · P0 · Dep: Attendance repo)
- [ ] Attendance: domain validation rules (`Backend` · P0)
- [ ] Attendance: business rules & state transitions (`Backend` · P0)
- [ ] Attendance: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] Attendance: API controller & routes (`Backend` · P0 · Dep: Attendance use cases)
- [ ] Attendance: DTOs & request/response mapping (`Backend` · P0)
- [ ] Attendance: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] Attendance: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 GeoCheckIn
- [ ] GeoCheckIn: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] GeoCheckIn: domain entity / aggregate model (`Backend` · P0)
- [ ] GeoCheckIn: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] GeoCheckIn: Create use case (`Backend` · P0 · Dep: GeoCheckIn repo)
- [ ] GeoCheckIn: Get / detail use case (`Backend` · P0 · Dep: GeoCheckIn repo)
- [ ] GeoCheckIn: Update use case (`Backend` · P0 · Dep: GeoCheckIn repo)
- [ ] GeoCheckIn: List / search use case (pagination, filters) (`Backend` · P0 · Dep: GeoCheckIn repo)
- [ ] GeoCheckIn: domain validation rules (`Backend` · P0)
- [ ] GeoCheckIn: business rules & state transitions (`Backend` · P0)
- [ ] GeoCheckIn: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] GeoCheckIn: API controller & routes (`Backend` · P0 · Dep: GeoCheckIn use cases)
- [ ] GeoCheckIn: DTOs & request/response mapping (`Backend` · P0)
- [ ] GeoCheckIn: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] GeoCheckIn: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 OutletCensus & Onboarding
- [ ] OutletCensus: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] OutletCensus: domain entity / aggregate model (`Backend` · P0)
- [ ] OutletCensus: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] OutletCensus: Create use case (`Backend` · P0 · Dep: OutletCensus repo)
- [ ] OutletCensus: Get / detail use case (`Backend` · P0 · Dep: OutletCensus repo)
- [ ] OutletCensus: Update use case (`Backend` · P0 · Dep: OutletCensus repo)
- [ ] OutletCensus: List / search use case (pagination, filters) (`Backend` · P0 · Dep: OutletCensus repo)
- [ ] OutletCensus: domain validation rules (`Backend` · P0)
- [ ] OutletCensus: business rules & state transitions (`Backend` · P0)
- [ ] OutletCensus: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] OutletCensus: API controller & routes (`Backend` · P0 · Dep: OutletCensus use cases)
- [ ] OutletCensus: DTOs & request/response mapping (`Backend` · P0)
- [ ] OutletCensus: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] OutletCensus: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 VanSale / Route Accounting
- [ ] VanSale: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] VanSale: domain entity / aggregate model (`Backend` · P0)
- [ ] VanSale: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] VanSale: Create use case (`Backend` · P0 · Dep: VanSale repo)
- [ ] VanSale: Get / detail use case (`Backend` · P0 · Dep: VanSale repo)
- [ ] VanSale: Update use case (`Backend` · P0 · Dep: VanSale repo)
- [ ] VanSale: List / search use case (pagination, filters) (`Backend` · P0 · Dep: VanSale repo)
- [ ] VanSale: domain validation rules (`Backend` · P0)
- [ ] VanSale: business rules & state transitions (`Backend` · P0)
- [ ] VanSale: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] VanSale: event consumer / projection handler (`Backend` · P0 · Dep: Broker)
- [ ] VanSale: API controller & routes (`Backend` · P0 · Dep: VanSale use cases)
- [ ] VanSale: DTOs & request/response mapping (`Backend` · P0)
- [ ] VanSale: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] VanSale: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
<!-- slide -->
#### 📑 MerchandisingAudit
- [ ] MerchandisingAudit: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] MerchandisingAudit: domain entity / aggregate model (`Backend` · P0)
- [ ] MerchandisingAudit: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] MerchandisingAudit: Create use case (`Backend` · P0 · Dep: MerchandisingAudit repo)
- [ ] MerchandisingAudit: Get / detail use case (`Backend` · P0 · Dep: MerchandisingAudit repo)
- [ ] MerchandisingAudit: Update use case (`Backend` · P0 · Dep: MerchandisingAudit repo)
- [ ] MerchandisingAudit: List / search use case (pagination, filters) (`Backend` · P0 · Dep: MerchandisingAudit repo)
- [ ] MerchandisingAudit: domain validation rules (`Backend` · P0)
- [ ] MerchandisingAudit: business rules & state transitions (`Backend` · P0)
- [ ] MerchandisingAudit: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] MerchandisingAudit: API controller & routes (`Backend` · P0 · Dep: MerchandisingAudit use cases)
- [ ] MerchandisingAudit: DTOs & request/response mapping (`Backend` · P0)
- [ ] MerchandisingAudit: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] MerchandisingAudit: mobile screen + offline cache (`Mobile` · P0 · Dep: Offline DB, Gateway auth)
```

### 2. DMS Module Components

```carousel
#### 📑 Distributor Master
- [ ] Distributor: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] Distributor: domain entity / aggregate model (`Backend` · P0)
- [ ] Distributor: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] Distributor: Create use case (`Backend` · P0 · Dep: Distributor repo)
- [ ] Distributor: Get / detail use case (`Backend` · P0 · Dep: Distributor repo)
- [ ] Distributor: Update use case (`Backend` · P0 · Dep: Distributor repo)
- [ ] Distributor: List / search use case (pagination, filters) (`Backend` · P0 · Dep: Distributor repo)
- [ ] Distributor: domain validation rules (`Backend` · P0)
- [ ] Distributor: business rules & state transitions (`Backend` · P0)
- [ ] Distributor: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] Distributor: event consumer / projection handler (`Backend` · P0 · Dep: Broker)
- [ ] Distributor: API controller & routes (`Backend` · P0 · Dep: Distributor use cases)
- [ ] Distributor: DTOs & request/response mapping (`Backend` · P0)
- [ ] Distributor: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
<!-- slide -->
#### 📑 DistributorHierarchy
- [ ] DistributorHierarchy: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] DistributorHierarchy: domain entity / aggregate model (`Backend` · P0)
- [ ] DistributorHierarchy: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] DistributorHierarchy: Create use case (`Backend` · P0 · Dep: DistributorHierarchy repo)
- [ ] DistributorHierarchy: Get / detail use case (`Backend` · P0 · Dep: DistributorHierarchy repo)
- [ ] DistributorHierarchy: Update use case (`Backend` · P0 · Dep: DistributorHierarchy repo)
- [ ] DistributorHierarchy: List / search use case (pagination, filters) (`Backend` · P0 · Dep: DistributorHierarchy repo)
- [ ] DistributorHierarchy: domain validation rules (`Backend` · P0)
- [ ] DistributorHierarchy: business rules & state transitions (`Backend` · P0)
- [ ] DistributorHierarchy: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] DistributorHierarchy: API controller & routes (`Backend` · P0 · Dep: DistributorHierarchy use cases)
- [ ] DistributorHierarchy: DTOs & request/response mapping (`Backend` · P0)
- [ ] DistributorHierarchy: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
<!-- slide -->
#### 📑 CreditLimit
- [ ] CreditLimit: DB migration, indexes & constraints (`DB` · P0 · Dep: Migration runner)
- [ ] CreditLimit: domain entity / aggregate model (`Backend` · P0)
- [ ] CreditLimit: Postgres repository implementation (`Backend` · P0 · Dep: pkg-database)
- [ ] CreditLimit: Create use case (`Backend` · P0 · Dep: CreditLimit repo)
- [ ] CreditLimit: Get / detail use case (`Backend` · P0 · Dep: CreditLimit repo)
- [ ] CreditLimit: Update use case (`Backend` · P0 · Dep: CreditLimit repo)
- [ ] CreditLimit: List / search use case (pagination, filters) (`Backend` · P0 · Dep: CreditLimit repo)
- [ ] CreditLimit: domain validation rules (`Backend` · P0)
- [ ] CreditLimit: business rules & state transitions (`Backend` · P0)
- [ ] CreditLimit: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] CreditLimit: event consumer / projection handler (`Backend` · P0 · Dep: Broker)
- [ ] CreditLimit: API controller & routes (`Backend` · P0 · Dep: CreditLimit use cases)
- [ ] CreditLimit: DTOs & request/response mapping (`Backend` · P0)
- [ ] CreditLimit: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
<!-- slide -->
#### 📑 Product & SKU
- [ ] Product: Postgres repository, use cases, validation rules, API routes (`Backend` · P0)
- [ ] Product: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] Product: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
- [ ] SKU: Postgres repository, use cases, validation rules, API routes (`Backend` · P0)
- [ ] SKU: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] SKU: RBAC permissions & policy (`Security` · P0 · Dep: OAuth2/RBAC)
<!-- slide -->
#### 📑 Inventory & Batch
- [ ] Inventory: Postgres repository, use cases, validation rules, API routes (`Backend` · P0)
- [ ] Inventory: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] Inventory: event consumer / projection handler (`Backend` · P0 · Dep: Broker)
- [ ] Batch: Postgres repository, use cases, validation rules, API routes (`Backend` · P0)
- [ ] Batch: publish domain events (outbox) (`Backend` · P0 · Dep: Outbox, Broker)
- [ ] StockLedger: DB migration, indexes, repository, and validation rules (`Backend` · P0)
```
