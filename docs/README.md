<![CDATA[# 🏢 Enterprise DMS & SFA Platform

> **Distributor Management System (DMS)** + **Sales Force Automation (SFA)** — A production-grade, multi-tenant, event-driven TypeScript monorepo powering end-to-end FMCG distribution operations.

[![CI Pipeline](https://github.com/JyotirmoyBhowmik/DMS/actions/workflows/ci.yml/badge.svg)](https://github.com/JyotirmoyBhowmik/DMS/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)

---

## Table of Contents

1.  [Platform Overview](#1-platform-overview)
2.  [Architecture & Design Principles](#2-architecture--design-principles)
3.  [Codebase Structure — Full Tree](#3-codebase-structure--full-tree)
4.  [Microservices — Low-Level Design (LLD)](#4-microservices--low-level-design-lld)
    - [4.1 api-gateway](#41-api-gateway)
    - [4.2 identity-service](#42-identity-service)
    - [4.3 sfa-service](#43-sfa-service)
    - [4.4 dms-core-service](#44-dms-core-service)
    - [4.5 claims-service](#45-claims-service)
    - [4.6 schemes-service](#46-schemes-service)
    - [4.7 pricing-service](#47-pricing-service)
    - [4.8 finance-service](#48-finance-service)
    - [4.9 Supporting Services](#49-supporting-services)
5.  [Shared Packages — Function-Level Detail](#5-shared-packages--function-level-detail)
6.  [SQL Migrations — Execution Sequence & Purpose](#6-sql-migrations--execution-sequence--purpose)
7.  [Event & Contract Registry](#7-event--contract-registry)
8.  [Quick Start — Local Development](#8-quick-start--local-development)
9.  [Free Deployment Guide — Online & Server](#9-free-deployment-guide--online--server)
10. [Scaling, Load & Compute Requirements](#10-scaling-load--compute-requirements)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Security & Compliance](#12-security--compliance)
13. [Contributing](#13-contributing)

---

## 1. Platform Overview

This platform manages the entire **distribution supply chain** for FMCG companies:

| Capability | Description |
|---|---|
| **Distributor Lifecycle** | Onboarding, KYC verification, hierarchy management, credit limits |
| **Inventory & Warehousing** | Stock ledger, batch tracking, stock transfers, goods receipt |
| **Order Management** | Primary/secondary sales, purchase orders, returns, replacements |
| **Sales Force Automation** | Beat routes, journey plans, visits, geo-check-ins, attendance |
| **Pricing Engine** | Multi-tier price lists, geographic/channel rules, slabs, discounts |
| **Schemes & Promotions** | Scheme creation, eligibility rules, payouts, promotions |
| **Claims & Settlements** | Damage claims, scheme claims, reconciliation, settlements |
| **Finance & Ledger** | Double-entry ledger, postings, period close, reversals |
| **Audit & Compliance** | Blockchain-style immutable audit trail, tamper detection |
| **AI/ML** | Demand forecasting, product recommendations, AI inference gateway |
| **Notifications** | Multi-channel (SMS, email, push) templated notifications |
| **Offline-First Mobile** | Bi-directional sync protocol for field agents on unreliable networks |

### Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.3 (strict mode) |
| Runtime | Node.js ≥ 18 |
| Package Manager | pnpm 8.15 (workspaces) |
| Build System | Turborepo 1.12 (topological + cached builds) |
| Database | PostgreSQL 15 (with RLS, optimistic locking) |
| Message Broker | RabbitMQ 3 (AMQP, management UI) |
| Cache | Redis 7 |
| Secret Store | HashiCorp Vault |
| API Protocols | REST (OpenAPI 3.1), gRPC (Protobuf), GraphQL |
| Frontend | React (web-admin), React Native (mobile-rn), Flutter (mobile-flutter) |
| CI/CD | GitHub Actions |
| Container | Docker + Docker Compose |
| Orchestration | Kubernetes (K8s manifests included) |
| Linting | ESLint + Prettier + Commitlint |

---

## 2. Architecture & Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│  ┌─────────┐  ┌──────────────┐  ┌───────────────┐               │
│  │Web Admin│  │Mobile RN/SFA │  │Mobile Flutter │               │
│  └────┬────┘  └──────┬───────┘  └───────┬───────┘               │
│       │              │                   │                       │
│       └──────────────┼───────────────────┘                       │
│                      ▼                                           │
│             ┌────────────────┐                                   │
│             │  API Gateway   │  ← Auth, Rate-Limit, Routing      │
│             └───────┬────────┘                                   │
│                     │                                            │
│    ┌────────┬───────┼───────┬────────┬────────┬────────┐        │
│    ▼        ▼       ▼       ▼        ▼        ▼        ▼        │
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐      │
│ │ SFA  ││ DMS  ││Claims││Scheme││Price ││Finance││Identi│      │
│ │ Svc  ││ Core ││ Svc  ││ Svc  ││ Svc  ││  Svc ││ty Svc│      │
│ └──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘      │
│    │       │       │       │       │       │       │            │
│    └───────┴───────┴───┬───┴───────┴───────┴───────┘            │
│                        ▼                                         │
│              ┌──────────────────┐                                │
│              │    RabbitMQ      │  ← Transactional Outbox        │
│              │  (Event Bus)    │                                 │
│              └────────┬─────────┘                                │
│                       ▼                                          │
│    ┌─────────────────────────────────────────┐                   │
│    │           PostgreSQL 15                  │                   │
│    │  (RLS per tenant, version columns,       │                   │
│    │   outbox table, deduplication table)     │                   │
│    └──────────────────┬──────────────────────┘                   │
│                       │                                          │
│              ┌────────┴─────────┐                                │
│              │     Redis 7      │  ← Session cache, rate limits  │
│              └──────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

### Core Patterns

| Pattern | Implementation |
|---|---|
| **Domain-Driven Design** | Each service has `domain/entities`, `domain/aggregates`, `domain/repositories`, `domain/value-objects`, `domain/policies` |
| **Hexagonal Architecture** | Application layer (use cases) depends only on domain ports/interfaces; infrastructure adapters implement them |
| **Transactional Outbox** | Domain events written to an `outbox_events` table within the business transaction; a background dispatcher polls and publishes to RabbitMQ |
| **Idempotent Consumer** | A `processed_events` table deduplicates incoming messages via correlation ID |
| **Row-Level Security (RLS)** | Every data table has an RLS policy filtering on `tenant_id`; the app sets `SET app.current_tenant = ?` per session |
| **Optimistic Concurrency** | Every aggregate has a `version` column; UPDATE uses `WHERE version = $expected` |
| **CQRS (Light)** | Write path goes through aggregates; read path uses lean queries/projections |

---

## 3. Codebase Structure — Full Tree

```
enterprise-dms-monorepo/
│
├── .github/workflows/
│   └── ci.yml                          # GitHub Actions CI pipeline
│
├── apps/                               # Frontend applications
│   ├── web-admin/                      # React admin portal (Vite)
│   ├── mobile-rn/                      # React Native field agent app
│   ├── mobile-flutter/                 # Flutter field agent app
│   └── mobile-sfa/                     # SFA-specific mobile shell
│
├── services/                           # Backend microservices (19 total)
│   ├── api-gateway/                    # Central API gateway + auth + routing
│   ├── identity-service/               # IAM: users, roles, tenants, MFA, JWT
│   ├── sfa-service/                    # Sales Force Automation core
│   ├── dms-core-service/               # Distributor Management core
│   ├── claims-service/                 # Claims lifecycle (raise→settle)
│   ├── schemes-service/                # Scheme engine + promotions
│   ├── pricing-service/                # Multi-tier pricing engine
│   ├── finance-service/                # Double-entry ledger
│   ├── audit-service/                  # Immutable audit trail
│   ├── config-service/                 # Feature flags + tenant config
│   ├── notification-service/           # Multi-channel notifications
│   ├── file-service/                   # File upload/storage
│   ├── report-service/                 # Analytics & reporting
│   ├── ai-gateway-service/             # AI model inference proxy
│   ├── ai-service/                     # ML model hosting
│   ├── forecasting-service/            # Demand forecasting
│   ├── recommendation-service/         # Product recommendations
│   ├── integration-service/            # ERP/SAP integration
│   └── sync-service/                   # Mobile offline sync
│
├── packages/                           # Shared libraries (14 packages)
│   ├── pkg-database/                   # PG pool, query builder, RLS, UoW
│   ├── pkg-events/                     # Outbox, RabbitMQ broker, codecs
│   ├── pkg-validation/                 # Zod schemas + business rules
│   ├── pkg-rbac/                       # Role-Based Access Control engine
│   ├── pkg-logger/                     # Structured JSON logger + PII redaction
│   ├── pkg-crypto/                     # AES encryption, hashing, key mgmt
│   ├── pkg-http/                       # HTTP client with retries & timeouts
│   ├── pkg-config/                     # Config loader (env, Vault)
│   ├── pkg-config-client/              # Remote config service client
│   ├── pkg-testing/                    # Test fixtures, builders, mocks
│   ├── pkg-analytics/                  # Analytics event tracking
│   ├── pkg-integrations/               # ERP & tax compliance adapters
│   ├── pkg-mobile-sync/                # Offline-first sync protocol
│   └── pkg-ui-shared/                  # Shared UI components/hooks
│
├── contracts/                          # API & event contracts
│   ├── openapi/                        # OpenAPI 3.1 specs (11 services)
│   ├── proto/                          # Protobuf definitions (gRPC)
│   ├── graphql/                        # GraphQL schemas
│   ├── events/                         # JSON Schema event payloads (19 events)
│   └── registry.md                     # Central contract index
│
├── db/                                 # Database layer
│   ├── migrations/                     # Versioned SQL migrations (6 schemas)
│   │   ├── system/   (V001–V004)       # System tables, migration tracking
│   │   ├── identity/ (V1–V2)          # Users, roles, tenants, tokens
│   │   ├── sfa/      (V001–V022)      # Orders, visits, agents, beat routes...
│   │   ├── dms/      (V001–V013)      # Products, inventory, outlets, pricing
│   │   ├── claims/   (V001)           # Claims lifecycle
│   │   ├── schemes/  (V001–V002)      # Scheme definitions + outbox
│   │   ├── pricing/  (V001)           # Price lists + entries
│   │   └── finance/  (V001)           # Ledger accounts + entries + postings
│   ├── policies/                       # RLS policy definitions
│   └── seeds/                          # Development seed data
│
├── infrastructure/                     # Deployment infrastructure
│   ├── docker-compose.yml              # Extended compose for infra services
│   ├── pgbouncer.ini                   # Connection pooler config
│   ├── nginx/                          # Reverse proxy config
│   └── k8s/                            # Kubernetes manifests
│       ├── api-gateway.yaml
│       ├── sfa-service.yaml
│       ├── identity-service.yaml
│       └── audit-service.yaml
│
├── k8s/base/                           # K8s base manifests
│   ├── namespace.yaml
│   ├── network-policy.yaml
│   ├── api-gateway-deployment.yaml
│   ├── api-gateway-service.yaml
│   ├── postgres-deployment.yaml
│   └── postgres-service.yaml
│
├── scripts/
│   └── backup-db.sh                    # Database backup utility
│
├── ai-ml/                              # ML feature stores & models
├── docs/                               # Additional documentation
│
├── docker-compose.yml                  # Dev environment (PG, RabbitMQ, Redis)
├── package.json                        # Root workspace config
├── pnpm-workspace.yaml                 # Workspace member definitions
├── turbo.json                          # Turborepo pipeline config
├── tsconfig.base.json                  # Shared TypeScript compiler options
├── .eslintrc.js                        # ESLint rules
├── .prettierrc                         # Code formatting
├── commitlint.config.js                # Conventional commit enforcement
├── .env.example                        # Environment variable template
├── .nvmrc                              # Node version pinning
├── CHANGELOG.md                        # Release changelog
├── CONTRIBUTING.md                     # Contribution guidelines
├── SECURITY.md                         # Security policy
└── LICENSE                             # License file
```

---

## 4. Microservices — Low-Level Design (LLD)

Each microservice follows a **four-layer DDD architecture**:

```
service/src/
├── domain/                 # Pure business logic (zero framework deps)
│   ├── entities/           # Domain entities + aggregates
│   ├── aggregates/         # Aggregate roots with invariant enforcement
│   ├── value-objects/      # Immutable value types
│   ├── repositories/       # Repository interfaces (ports)
│   ├── policies/           # Domain policies & business rules
│   └── errors/             # Domain-specific exceptions
├── application/            # Use cases (orchestration layer)
│   ├── usecases/           # Command/Query handlers
│   ├── ports/              # Port interfaces for infra adapters
│   └── queries/            # Read-optimized query handlers
├── infrastructure/         # Framework & external adapters
│   ├── database/
│   │   ├── repositories/   # Postgres repository implementations
│   │   └── transactional-client.ts  # TX wrapper with RLS context
│   ├── providers/          # External API adapters
│   └── routing/            # Custom router implementations
└── presentation/           # Entry points
    ├── rest/controllers/   # HTTP REST controllers
    ├── events/             # Event consumers (RabbitMQ)
    └── grpc/               # gRPC service implementations
```

### 4.1 api-gateway

> Central entry point for all client requests. Handles authentication, rate limiting, request validation, and upstream routing.

| Layer | File | Function/Class | Purpose | Connects To |
|---|---|---|---|---|
| **Domain** | `entities/api_key.ts` | `ApiKey` | API key entity with hashed secret | — |
| | `entities/rate_limit_entry.ts` | `RateLimitEntry` | Sliding-window rate limit state | — |
| | `entities/route.ts` | `Route` | Dynamic route definitions | — |
| | `aggregates/gateway.aggregate.ts` | `GatewayAggregate` | Route matching + request lifecycle | Route, RateLimitEntry |
| | `value-objects/api_version.ts` | `ApiVersion` | Semantic version parsing | — |
| | `value-objects/route_match.ts` | `RouteMatch` | Matched route + extracted params | Route |
| | `errors/gateway.errors.ts` | `GatewayError` | Domain exceptions | — |
| **Application** | `usecases/route_request.usecase.ts` | `RouteRequestUseCase` | Route incoming request to upstream | GatewayAggregate |
| | `usecases/manage_routes.usecase.ts` | `ManageRoutesUseCase` | CRUD for route configuration | Route repo |
| | `usecases/manage_api_keys.usecase.ts` | `ManageApiKeysUseCase` | Issue/revoke API keys | ApiKey repo |
| | `usecases/health_check.usecase.ts` | `HealthCheckUseCase` | Liveness + readiness probes | All upstreams |
| | `ports/route.repository.ts` | `RouteRepository` | Port: route persistence | — |
| | `ports/api_key.repository.ts` | `ApiKeyRepository` | Port: API key persistence | — |
| | `ports/rate_limit.store.ts` | `RateLimitStore` | Port: rate limit state (Redis) | — |
| | `ports/upstream.adapter.ts` | `UpstreamAdapter` | Port: HTTP proxy to services | — |
| **Infrastructure** | `routing/trie_router.ts` | `TrieRouter` | O(log n) prefix-trie route matcher | — |
| **Presentation** | `controllers/gateway.controller.ts` | `GatewayController` | Main reverse-proxy endpoint | RouteRequestUseCase |
| | `controllers/ai.controller.ts` | `AiController` | AI inference proxy | ai-gateway-service |
| | `controllers/analytics.controller.ts` | `AnalyticsController` | Analytics event ingestion | pkg-analytics |
| | `controllers/sync.controller.ts` | `SyncController` | Mobile sync endpoint | sync-service |
| **Middleware** | `middleware/auth.ts` | `authMiddleware` | JWT verification + tenant extraction | identity-service |
| | `middleware/cors.ts` | `corsMiddleware` | CORS policy enforcement | — |
| | `middleware/rate_limiter.ts` | `rateLimiterMiddleware` | Per-IP/per-tenant rate limiting | Redis |
| | `middleware/request_validator.ts` | `requestValidatorMiddleware` | Zod schema validation | pkg-validation |
| **Tests** | `gateway_auth.test.ts` | — | Auth flow integration tests | — |
| | `gateway_attendance.test.ts` | — | Attendance API gateway tests | — |
| | `gateway_geo_checkin.test.ts` | — | Geo check-in API tests | — |
| | `gateway_identity.test.ts` | — | Identity API gateway tests | — |
| | `gateway_outlet_census.test.ts` | — | Outlet census API tests | — |

---

### 4.2 identity-service

> Full IAM service: multi-tenant user management, RBAC, JWT token issuance/verification, MFA device management, key rotation.

| Layer | File | Function/Class | Purpose | Connects To |
|---|---|---|---|---|
| **Domain Entities** | `entities/user.ts` | `User` | User aggregate with password hash, lockout | Role, Tenant |
| | `entities/role.ts` | `Role` | Named role with permission set | Permission |
| | `entities/permission.ts` | `Permission` | Granular permission (resource:action) | — |
| | `entities/tenant.ts` | `Tenant` | Tenant configuration + billing | — |
| | `entities/refresh_token.ts` | `RefreshToken` | Opaque refresh token with expiry | User |
| | `entities/mfa_device.ts` | `MfaDevice` | TOTP/WebAuthn device registration | User |
| **Repositories (Ports)** | `repositories/user.repository.ts` | `UserRepository` | User CRUD + search | — |
| | `repositories/role.repository.ts` | `RoleRepository` | Role CRUD | — |
| | `repositories/permission.repository.ts` | `PermissionRepository` | Permission CRUD | — |
| | `repositories/tenant.repository.ts` | `TenantRepository` | Tenant CRUD | — |
| | `repositories/refresh_token.repository.ts` | `RefreshTokenRepository` | Token lifecycle | — |
| | `repositories/mfa_device.repository.ts` | `MfaDeviceRepository` | MFA device CRUD | — |
| **Use Cases** | `usecases/issue_token.usecase.ts` | `IssueTokenUseCase` | Authenticate + issue JWT/refresh pair | User, RefreshToken |
| | `usecases/verify_token.usecase.ts` | `VerifyTokenUseCase` | Validate JWT, extract claims | KeyManager |
| | `usecases/refresh_token.usecase.ts` | `RefreshTokenUseCase` | Rotate refresh token | RefreshToken repo |
| | `usecases/assign_role.usecase.ts` | `AssignRoleUseCase` | Assign role to user | User, Role repos |
| | `usecases/key_manager.ts` | `KeyManager` | RSA key pair rotation + JWKS | pkg-crypto |
| | `usecases/user.usecases.ts` | `UserUseCases` | User CRUD operations | User repo |
| | `usecases/role.usecases.ts` | `RoleUseCases` | Role management | Role repo |
| | `usecases/permission.usecases.ts` | `PermissionUseCases` | Permission management | Permission repo |
| | `usecases/tenant.usecases.ts` | `TenantUseCases` | Tenant onboarding/config | Tenant repo |
| | `usecases/mfa_device.usecases.ts` | `MfaDeviceUseCases` | MFA enrollment/verification | MfaDevice repo |
| **Infra (PG Repos)** | `repositories/user.pg-repository.ts` | `UserPgRepository` | Parameterized queries + RLS | PostgreSQL |
| | `repositories/role.pg-repository.ts` | `RolePgRepository` | — | PostgreSQL |
| | `repositories/permission.pg-repository.ts` | `PermissionPgRepository` | — | PostgreSQL |
| | `repositories/tenant.pg-repository.ts` | `TenantPgRepository` | — | PostgreSQL |
| | `repositories/refresh_token.pg-repository.ts` | `RefreshTokenPgRepository` | — | PostgreSQL |
| | `repositories/mfa_device.pg-repository.ts` | `MfaDevicePgRepository` | — | PostgreSQL |
| **Presentation** | `controllers/auth.controller.ts` | `AuthController` | Login, logout, token refresh | IssueToken, VerifyToken |
| | `controllers/user.controller.ts` | `UserController` | User CRUD endpoints | UserUseCases |
| | `controllers/role.controller.ts` | `RoleController` | Role CRUD endpoints | RoleUseCases |
| | `controllers/permission.controller.ts` | `PermissionController` | Permission CRUD | PermissionUseCases |
| | `controllers/tenant.controller.ts` | `TenantController` | Tenant management | TenantUseCases |
| | `controllers/mfa_device.controller.ts` | `MfaDeviceController` | MFA enrollment | MfaDeviceUseCases |
| | `grpc/token_service.grpc.ts` | `TokenServiceGrpc` | gRPC token verification | VerifyTokenUseCase |

---

### 4.3 sfa-service

> The largest service. Manages field sales operations: orders, visits, journey plans, attendance, geo-check-ins, outlet management, beat routes, surveys, competitor capture, delivery confirmations, order approvals, sales targets.

| Domain Entity | File | Key Methods | Business Rule |
|---|---|---|---|
| `Order` | `entities/order.ts` | `create()`, `addLine()`, `cancel()` | Status machine: DRAFT→PLACED→PROCESSING→DELIVERED→CANCELLED |
| `OrderAggregate` | `aggregates/order.aggregate.ts` | `placeOrder()`, `processOrder()` | Validates stock, credit limit, applies scheme discounts |
| `Visit` | `entities/visit.ts` | `create()`, `complete()`, `addNote()` | Must have geo-check-in before completion |
| `JourneyPlan` | `entities/journey-plan.ts` | `create()`, `assignOutlets()` | Enforces max outlets per day via JourneyPolicy |
| `BeatRoute` | `entities/beat-route.ts` | `create()`, `update()` | Links outlets to weekly schedule |
| `Attendance` | `entities/attendance.ts` | `checkIn()`, `checkOut()` | GPS-validated check-in within geofence radius |
| `GeoCheckin` | `entities/geo-checkin.ts` | `create()`, `validate()` | Must be within 200m of outlet coordinates |
| `OutletCensus` | `entities/outlet-census.ts` | `create()`, `update()` | Captures outlet audit data (shelving, competition) |
| `OutletProfile` | `entities/outlet-profile.ts` | `create()`, `update()`, `classify()` | Outlet classification (A/B/C/D by revenue) |
| `CompetitorCapture` | `entities/competitor-capture.ts` | `create()` | Captures competitor product/price intel |
| `DeliveryConfirmation` | `entities/delivery-confirmation.ts` | `create()`, `confirm()` | Proof of delivery with photo evidence |
| `OrderApproval` | `entities/order-approval.ts` | `create()`, `approve()`, `reject()` | Multi-level approval workflow |
| `SalesTarget` | `entities/sales-target.ts` | `set()`, `track()` | Monthly/quarterly target tracking |
| `Survey` | `entities/survey.ts` | `create()`, `submit()` | Custom survey forms for outlets |
| `VanSale` | `entities/van-sale.ts` | `create()` | Direct van-to-outlet sales |
| `MerchandisingAudit` | `entities/merchandising-audit.ts` | `create()` | In-store merchandising compliance |
| `Agent` | `entities/agent.ts` | `create()` | Sales rep profile + territory assignment |

**Use Cases (44 total):**

| Use Case Group | Files | Count | Purpose |
|---|---|---|---|
| Attendance | `create`, `get`, `update`, `list` | 4 | Track field agent clock-in/out |
| Beat Route | `create`, `get`, `update`, `list` | 4 | Manage weekly outlet visit schedules |
| Visit | `create`, `get`, `update`, `list` | 4 | Track outlet visits with duration/notes |
| Geo Check-in | `create`, `get`, `update`, `list` | 4 | GPS-validated location check-ins |
| Journey Plan | `create`, `get`, `update`, `list` | 4 | Daily route planning for agents |
| Outlet Census | `create`, `get`, `update`, `list` | 4 | Outlet data capture campaigns |
| Outlet Profile | `create`, `get`, `update`, `list` | 4 | Outlet master data management |
| Order Approval | `create`, `update`, `list` | 3 | Multi-level order approval workflow |
| Order | `place_order`, `process_order` | 2 | Full order lifecycle |
| Competitor Capture | `create` | 1 | Competitor intelligence capture |
| Delivery Confirmation | `create` | 1 | Proof of delivery |
| Sales Target | `sales-target.usecases` | 1 | Target CRUD |
| Survey | `survey.usecases` | 1 | Survey management |
| Enterprise | `enterprise_sfa.usecases` | 1 | Cross-cutting SFA operations |
| Journey Query | `get_agent_journey`, `complete_visit`, `create_journey_plan` | 3 | Legacy journey handlers |

**Value Objects:**

| VO | File | Purpose |
|---|---|---|
| `GeoPoint` | `value-objects/geo-point.ts` | Lat/lng with distance calculation |
| `Money` | `value-objects/money.ts` | Currency-safe arithmetic |
| `OrderLine` | `value-objects/order-line.ts` | Immutable product + qty + price |
| `TimeWindow` | `value-objects/time-window.ts` | Start/end time range |

**Postgres Repositories (16):** Each domain repository interface has a `.pg-repository.ts` implementation with parameterized queries, RLS context setting, optimistic concurrency.

**REST Controllers (17):** `attendance`, `beat_route`, `competitor-capture`, `delivery-confirmation`, `enterprise_sfa`, `geo_checkin`, `journey_plan`, `order`, `order_approval`, `outlet-profile`, `outlet_census`, `sales-target`, `survey`, `visit` + index barrel.

**Event Consumers:** `event_consumer.ts` (generic handler), `order_placed_consumer.ts` (triggers inventory reservation).

---

### 4.4 dms-core-service

> Distributor management: products, inventory, outlets, credit limits, KYC, pricing, invoices, stock ledger, batch tracking.

| Layer | File | Purpose |
|---|---|---|
| **Domain Entities** | `product.ts` | Product catalog with SKU, HSN, tax codes |
| | `product-category.ts` | Hierarchical category tree |
| | `inventory.ts` | Warehouse stock per product per location |
| | `inventory_aggregate.ts` | Aggregate: stock adjustment, reservation, release |
| | `outlet.ts` | Distributor outlet (retail point) |
| | `credit-limit.ts` | Per-distributor credit ceiling with utilization tracking |
| | `kyc-document.ts` | KYC document (PAN, GST, FSSAI) with verification status |
| | `invoice.ts` | Tax invoice generation with line items |
| | `batch.ts` | Batch/lot tracking with expiry dates |
| | `stock-ledger-entry.ts` | Immutable stock movement journal entry |
| | `stock-transfer.ts` | Inter-warehouse transfer with approval |
| | `price-list.ts` | Price list assignment to distributors |
| | `claim_aggregate.ts` | Legacy claim aggregate (now in claims-service) |
| **Domain Repositories** | 11 interfaces | `save()`, `findById()`, `list()`, `delete()` for each entity |
| **Domain Policies** | `pricing_policy.ts` | Multi-tier pricing rule evaluation |
| **PG Repositories** | 11 implementations | Parameterized SQL, RLS, optimistic locking |
| **Use Cases** | `enterprise_dms.usecases.ts` | Cross-cutting DMS operations |
| **Queries** | `queries/index.ts` | Read-optimized query handlers |
| **Controllers** | `dms.controller.ts` | Standard CRUD endpoints |
| | `enterprise_dms.controller.ts` | Enterprise-level aggregated operations |
| **Event Consumers** | `event_consumer.ts` | Generic domain event handler |
| | `order_placed_consumer.ts` | Inventory reservation on order placed |
| **Worker** | `worker.ts` | Background job runner (outbox dispatcher) |

---

### 4.5 claims-service

> Manages the full claims lifecycle: raise → validate → approve/reject → settle.

| Layer | File | Purpose |
|---|---|---|
| **Domain** | `entities/claim.entity.ts` | Claim with state machine (RAISED→VALIDATED→APPROVED→REJECTED→SETTLED) |
| | `aggregates/claim.aggregate.ts` | Invariant enforcement: can't approve already-rejected |
| | `repositories/claim.repository.ts` | Port interface |
| **Use Cases** | `raise_claim.usecase.ts` | Create new claim with evidence |
| | `validate_claim.usecase.ts` | Business validation rules |
| | `approve_claim.usecase.ts` | Manager approval with audit trail |
| | `reject_claim.usecase.ts` | Rejection with reason |
| | `settle_claim.usecase.ts` | Financial settlement + ledger posting |
| | `get_claim.usecase.ts` | Tenant-scoped detail view |
| | `list_claims.usecase.ts` | Paginated list with filters |
| **Infrastructure** | `claim.pg-repository.ts` | PG repo with RLS, optimistic locking |
| | `transactional-client.ts` | Transaction wrapper |
| **Presentation** | `claim.controller.ts` | REST endpoints for all use cases |

---

### 4.6 schemes-service

> Scheme engine: create schemes with eligibility rules, evaluate orders against active schemes, manage payouts and promotions.

| Layer | File | Purpose |
|---|---|---|
| **Domain** | `entities/scheme.entity.ts` | Scheme definition: type, validity, rules, benefits |
| | `aggregates/scheme.aggregate.ts` | Validates scheme invariants |
| | `repositories/scheme.repository.ts` | Port interface |
| **Use Cases** | `create_scheme.usecase.ts` | Create scheme with validation |
| | `get_scheme.usecase.ts` | Tenant-scoped detail |
| | `update_scheme.usecase.ts` | Update with optimistic lock |
| | `list_schemes.usecase.ts` | Paginated listing |
| | `evaluate_schemes.usecase.ts` | Match order against active schemes |
| **Infrastructure** | `scheme.pg-repository.ts` | PG repo with RLS |
| | `transactional-client.ts` | TX wrapper |
| **Presentation** | `scheme.controller.ts` | REST CRUD + evaluation endpoint |
| **Events** | `event_consumer.ts` | Listen for order events to auto-evaluate |
| | `order_placed_consumer.ts` | Scheme evaluation on order placement |
| **Worker** | `worker.ts` | Outbox dispatcher |

---

### 4.7 pricing-service

> Multi-tier pricing engine supporting price lists, geo/channel rules, slabs, discounts, and tax calculation.

| Layer | File | Purpose |
|---|---|---|
| **Domain** | `entities/price-list.entity.ts` | Price list header (name, currency, validity) |
| | `entities/price-list-entry.entity.ts` | Per-product price within a list |
| | `entities/price-list-assignment.entity.ts` | List-to-distributor/region mapping |
| | `entities/tax-rule.entity.ts` | Tax rate rules (GST/VAT) |
| | `aggregates/pricing.aggregate.ts` | Price calculation with waterfall: base → slab → channel → geo → discount |
| | `repositories/price-list.repository.ts` | Port interface |
| **Use Cases** | `create_price_list.usecase.ts` | Create new price list |
| | `update_price_list.usecase.ts` | Update with versioning |
| | `add_price_list_entry.usecase.ts` | Add product entries to a list |
| | `calculate_price.usecase.ts` | Real-time price calculation |
| **Infrastructure** | `price-list.pg-repository.ts` | PG repo |
| | `transactional-client.ts` | TX wrapper |
| **Presentation** | `pricing.controller.ts` | REST endpoints |
| **Worker** | `worker.ts` | Background price recomputation |

---

### 4.8 finance-service

> Double-entry accounting ledger: journal entries, postings, period management, reversals.

| Layer | File | Purpose |
|---|---|---|
| **Domain** | `entities/ledger-account.entity.ts` | Chart of accounts (assets, liabilities, revenue, expense) |
| | `entities/ledger-entry.entity.ts` | Journal entry header |
| | `entities/ledger-posting.entity.ts` | Debit/credit posting lines |
| | `entities/ledger-period.entity.ts` | Accounting period (open/closed) |
| | `aggregates/ledger-entry.aggregate.ts` | Enforces balanced entries (sum(debits) == sum(credits)) |
| | `repositories/ledger.repository.ts` | Port interface |
| **Use Cases** | `post-ledger-entry.usecase.ts` | Create balanced journal entry |
| | `reverse-ledger-entry.usecase.ts` | Reversal with contra postings |
| **Infrastructure** | `ledger.pg-repository.ts` | PG repo |
| | `transactional-client.ts` | TX wrapper |
| **Events** | `finance-event-consumer.ts` | Auto-post on claim settlement, order invoicing |

---

### 4.9 Supporting Services

| Service | Key Files | Purpose |
|---|---|---|
| **audit-service** | `audit-block.ts`, `record_audit.usecase.ts`, `verify_chain.usecase.ts` | Blockchain-style immutable audit trail. Each block has previous hash → tamper detection |
| **config-service** | `entities.ts`, `evaluate_flag.usecase.ts`, `update_flag.usecase.ts` | Feature flag evaluation with tenant/user targeting. Percentage rollouts |
| **notification-service** | `notification.ts`, `template.ts` | Multi-channel notifications (SMS, email, push) with Handlebars templates |
| **file-service** | `file.controller.ts` | Signed URL upload/download to S3-compatible storage |
| **report-service** | `report.controller.ts` | Analytics dashboards, scheduled report generation |
| **ai-gateway-service** | `inference.aggregate.ts`, `run_inference.usecase.ts` | Unified AI inference proxy with provider abstraction (OpenAI, Vertex, internal) |
| **forecasting-service** | `forecast.controller.ts` | Demand forecasting API (connects to Python ML models) |
| **recommendation-service** | `recommendation.controller.ts` | Product recommendation engine |
| **integration-service** | `erp-sync.job.ts` | SAP BAPI integration for master data sync |
| **sync-service** | `sync.controller.ts` | Bi-directional offline sync for mobile apps |

---

## 5. Shared Packages — Function-Level Detail

### 5.1 pkg-database

> PostgreSQL connection pooling, query building, RLS enforcement, Unit of Work, and optimistic concurrency.

| File | Exports | Purpose |
|---|---|---|
| `connection/pool.ts` | `createPool()`, `Pool` | PG connection pool with health checks and configurable limits |
| `connection/config.ts` | `DatabaseConfig` | Typed config from env vars |
| `queries/query_builder.ts` | `QueryBuilder` | Fluent parameterized query builder (prevents SQL injection) |
| `queries/pagination.ts` | `PaginationOptions`, `paginate()` | Cursor/offset pagination helpers |
| `migrations/migration_runner.ts` | `MigrationRunner` | Run versioned migrations in sequence |
| `rls/tenant_context.ts` | `setTenantContext()` | Sets `SET app.current_tenant = $1` per connection |
| `rls/policy_builder.ts` | `PolicyBuilder` | Fluent API for building RLS policies |
| `unit-of-work/uow.ts` | `UnitOfWork` | Transaction wrapper with commit/rollback |

### 5.2 pkg-events

> Transactional outbox pattern, RabbitMQ broker, message codecs, and idempotent consumption.

| File | Exports | Purpose |
|---|---|---|
| `outbox/outbox.repository.ts` | `OutboxRepository` | Persist events within business TX |
| `outbox/dispatcher.ts` | `OutboxDispatcher` | Poll outbox, publish to RabbitMQ, mark dispatched |
| `broker/rabbitmq.ts` | `RabbitMQBroker` | AMQP connection management, publish/subscribe |
| `consumers/idempotent_consumer.ts` | `IdempotentConsumer` | Deduplication via `processed_events` table |
| `codecs/json.ts` | `JsonCodec` | JSON serialization/deserialization |
| `codecs/avro.ts` | `AvroCodec` | Avro binary serialization |
| `codecs/protobuf.ts` | `ProtobufCodec` | Protobuf serialization |
| `envelope/envelope.ts` | `EventEnvelope` | Standard wrapper: event_id, correlation_id, timestamp, payload |
| `schemas/order/order.placed.v1.ts` | `OrderPlacedV1` | Typed event schema |
| `schemas/order/order.placed.v2.ts` | `OrderPlacedV2` | V2 with breaking changes |
| `schemas/order/order.cancelled.v1.ts` | `OrderCancelledV1` | — |
| `schemas/visit/visit.completed.v1.ts` | `VisitCompletedV1` | — |
| `schemas/delivery/delivery.completed.v1.ts` | `DeliveryCompletedV1` | — |

### 5.3 pkg-validation

> Zod schemas for input validation and business rule enforcement.

| File | Exports | Purpose |
|---|---|---|
| `schemas/order.schema.ts` | `CreateOrderSchema`, `UpdateOrderSchema` | Order payload validation |
| `schemas/auth.schema.ts` | `LoginSchema`, `RegisterSchema` | Auth request validation |
| `schemas/attendance.schema.ts` | `CreateAttendanceSchema` | Attendance check-in validation |
| `schemas/beat_route.schema.ts` | `CreateBeatRouteSchema` | Beat route validation |
| `schemas/geo_checkin.schema.ts` | `CreateGeoCheckinSchema` | Geo-check-in with lat/lng bounds |
| `schemas/journey_plan.schema.ts` | `CreateJourneyPlanSchema` | Journey plan validation |
| `schemas/outlet_census.schema.ts` | `CreateOutletCensusSchema` | Outlet census validation |
| `schemas/outlet_profile.schema.ts` | `CreateOutletProfileSchema` | Outlet profile validation |
| `schemas/order_approval.schema.ts` | `CreateOrderApprovalSchema` | Order approval validation |
| `schemas/visit.schema.ts` | `CreateVisitSchema` | Visit validation |
| `schemas/common.schema.ts` | `UuidSchema`, `PaginationSchema`, `TenantIdSchema` | Shared validators |
| `rules/business.rules.ts` | `validateCreditLimit()`, `validateStockAvailability()` | Cross-entity business rules |
| `rules/order.rules.ts` | `validateOrderLines()`, `validateMinOrderValue()` | Order-specific rules |
| `errors.ts` | `ValidationError` | Structured validation error type |

### 5.4 pkg-rbac

> Role-Based Access Control engine with hierarchical permissions.

| File | Exports | Purpose |
|---|---|---|
| `index.ts` | `RbacEngine`, `hasPermission()`, `requirePermission()` | Permission checking against user roles |
| | `Permission`, `Role` | Type definitions for RBAC model |
| | `PERMISSIONS` | Constant map of all platform permissions |

### 5.5 pkg-logger

> Structured JSON logging with PII redaction and distributed tracing.

| File | Exports | Purpose |
|---|---|---|
| `logger.ts` | `Logger`, `createLogger()` | JSON structured logger with levels |
| `formatters/json.ts` | `JsonFormatter` | Formats log entries as JSON |
| `correlation/context.ts` | `CorrelationContext`, `withCorrelationId()` | AsyncLocalStorage for trace propagation |
| `redaction/redactor.ts` | `Redactor`, `redactPII()` | Masks passwords, tokens, credit cards in logs |

### 5.6 pkg-crypto

> Encryption, hashing, and key management.

| File | Exports | Purpose |
|---|---|---|
| `index.ts` | `encrypt()`, `decrypt()`, `hash()`, `verifyHash()` | AES-256-GCM encryption, bcrypt hashing |
| | `generateKeyPair()`, `signJWT()`, `verifyJWT()` | RSA key pair ops + JWT signing |

### 5.7 Other Packages

| Package | Purpose |
|---|---|
| **pkg-http** | HTTP client with exponential backoff, circuit breaker, configurable timeouts |
| **pkg-config** | Loads config from `.env`, environment, and HashiCorp Vault |
| **pkg-config-client** | Remote config service client for feature flags |
| **pkg-testing** | Test fixtures, entity builders, mock repositories, test DB helpers |
| **pkg-analytics** | Analytics event tracking and batch submission |
| **pkg-integrations** | ERP adapters (SAP BAPI) and tax compliance (India NIC GST) |
| **pkg-mobile-sync** | Bi-directional sync protocol for offline-first mobile apps |
| **pkg-ui-shared** | Shared React components and hooks for frontend apps |

---

## 6. SQL Migrations — Execution Sequence & Purpose

Migrations are organized by **database schema** (one logical DB per bounded context). Each runs in order within its schema.

### 6.1 System Schema

| # | Migration | Purpose | Tables Created/Modified |
|---|---|---|---|
| 1 | `V001__create_system_tables.sql` | Core system metadata tables | `system_config`, `system_health` |
| 2 | `V002__create_migration_tracking.sql` | Track which migrations have run | `schema_migrations` |
| 3 | `V003__create_identity_tables.sql` | Base identity tables at system level | `system_users`, `system_tenants` |
| 4 | `V004__add_outbox_backoff.sql` | Exponential backoff columns for outbox dispatcher | ALTER `outbox_events` ADD `retry_count`, `next_retry_at` |

### 6.2 Identity Schema

| # | Migration | Purpose | Tables Created/Modified |
|---|---|---|---|
| 1 | `V1__init.sql` | Users, roles, permissions, tenants, refresh tokens, MFA | `users`, `roles`, `permissions`, `user_roles`, `tenants`, `refresh_tokens`, `mfa_devices` |
| 2 | `V2__identity_outbox_and_deduplication.sql` | Event infrastructure for identity domain | `identity_outbox_events`, `identity_processed_events` |

### 6.3 SFA Schema (22 migrations)

| # | Migration | Purpose | Key Details |
|---|---|---|---|
| 1 | `V001__create_orders.sql` | Order management | `orders` + `order_lines` with FK, CHECK constraints |
| 2 | `V002__create_visits.sql` | Visit tracking | `visits` with `tenant_id`, `agent_id`, timestamps |
| 3 | `V003__create_agents.sql` | Sales agent profiles | `agents` with territory, manager FK |
| 4 | `V004__create_journey_plans.sql` | Journey planning | `journey_plans` + `journey_plan_outlets` |
| 5 | `V005__create_sfa_outbox.sql` | Transactional outbox | `sfa_outbox_events` |
| 6 | `V006__create_sfa_processed_events.sql` | Idempotent consumer | `sfa_processed_events` |
| 7 | `V007__create_beat_routes.sql` | Beat route schedules | `beat_routes` + `beat_route_outlets` |
| 8 | `V008__create_attendance.sql` | Attendance tracking | `attendance` with check_in/out, GPS coords |
| 9 | `V009__create_geo_checkins.sql` | GPS check-ins | `geo_checkins` with lat, lng, accuracy |
| 10 | `V010__create_outlet_census.sql` | Outlet audit data | `outlet_censuses` with structured survey data |
| 11 | `V011__create_van_sales.sql` | Van sales | `van_sales` + `van_sale_lines` |
| 12 | `V012__create_order_approvals.sql` | Approval workflow | `order_approvals` with approval_level, status |
| 13 | `V013__create_merchandising_audits.sql` | Store audits | `merchandising_audits` |
| 14 | `V014__create_sfa_metrics.sql` | Performance metrics | `sfa_metrics` for dashboards |
| 15 | `V015__create_sfa_audits.sql` | SFA audit trail | `sfa_audit_log` |
| 16 | `V016__rls_order_approvals.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `order_approvals` |
| 17 | `V017__rls_beat_routes.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `beat_routes` |
| 18 | `V018__rls_visits.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `visits` |
| 19 | `V019__rls_attendance.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `attendance` |
| 20 | `V020__rls_geo_checkins.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `geo_checkins` |
| 21 | `V021__rls_outlet_census.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `outlet_censuses` |
| 22 | `V022__create_outlet_profiles.sql` | Outlet profiles | `outlet_profiles` with classification |

### 6.4 DMS Schema (13 migrations)

| # | Migration | Purpose | Key Details |
|---|---|---|---|
| 1 | `V001__create_dms_tables.sql` | Core DMS: products, outlets, inventory | `products`, `outlets`, `inventory`, `distributors` |
| 2 | `V002__dms_outbox_and_deduplication.sql` | Event infrastructure | `dms_outbox_events`, `dms_processed_events` |
| 3 | `V003__create_distributor_hierarchy.sql` | Distributor org tree | `distributor_hierarchy` with parent_id, level |
| 4 | `V004__create_kyc_documents.sql` | KYC document storage | `kyc_documents` with doc_type, verification_status |
| 5 | `V005__create_credit_limits.sql` | Credit management | `credit_limits` with limit, utilized, available |
| 6 | `V006__create_stock_ledger.sql` | Stock movement journal | `stock_ledger_entries` (immutable append-only) |
| 7 | `V007__create_stock_transfers.sql` | Inter-warehouse moves | `stock_transfers` with from/to warehouse |
| 8 | `V008__create_product_categories.sql` | Category hierarchy | `product_categories` with parent_id |
| 9 | `V009__create_batches.sql` | Batch/lot tracking | `batches` with mfg_date, expiry_date |
| 10 | `V010__create_invoices.sql` | Invoice generation | `invoices` + `invoice_lines` |
| 11 | `V011__create_price_lists.sql` | Price list tables | `price_lists` + `price_list_entries` |
| 12 | `V012__distributor_lifecycle_rls_and_workflows.sql` | RLS + status workflows | RLS on distributor tables, status state machine |
| 13 | `V013__inventory_rls_and_concurrency.sql` | Inventory RLS + versioning | RLS on inventory, `version` column for optimistic locking |

### 6.5 Other Schemas

| Schema | Migration | Purpose |
|---|---|---|
| **claims** | `V001__create_claims.sql` | Claims table with state machine, evidence, amounts |
| **schemes** | `V001__create_schemes.sql` | Scheme definitions, eligibility rules, benefits |
| | `V002__schemes_outbox_and_deduplication.sql` | Event infrastructure for schemes |
| **pricing** | `V001__create_pricing_tables.sql` | Price lists, entries, assignments, tax rules |
| **finance** | `V001__create_ledger_tables.sql` | Ledger accounts, entries, postings, periods |

### Migration Execution Order

```
1. system/V001 → V002 → V003 → V004         (foundation)
2. identity/V1 → V2                           (IAM, needed by all)
3. dms/V001 → V002 → ... → V013              (core distributor data)
4. sfa/V001 → V002 → ... → V022              (field operations)
5. schemes/V001 → V002                        (scheme engine)
6. claims/V001                                (claims lifecycle)
7. pricing/V001                               (pricing engine)
8. finance/V001                               (ledger)
```

> **Why this order?** System tables are foundation. Identity is needed by every service for RLS context. DMS creates product/outlet master data that SFA references via FKs. Schemes depend on product data. Claims depend on orders. Pricing is standalone. Finance is the last consumer.

---

## 7. Event & Contract Registry

### Domain Events (19 event types)

| Event | Schema | Producer | Consumers |
|---|---|---|---|
| `order.placed.v1` | `events/order/` | sfa-service | dms-core (inventory), schemes (evaluation), finance |
| `order.placed.v2` | `events/order/` | sfa-service | Same + extended payload |
| `order.cancelled.v1` | `events/order/` | sfa-service | dms-core (release stock), finance (reversal) |
| `visit.completed.v1` | `events/visit/` | sfa-service | report-service (analytics) |
| `delivery.completed.v1` | `events/delivery/` | sfa-service | dms-core (stock confirmation) |
| `claim.settled.v1` | `events/claim/` | claims-service | finance (ledger posting) |
| `settlement.posted.v1` | `events/settlement/` | claims-service | finance-service |
| `inventory.adjusted.v1` | `events/inventory/` | dms-core | report-service |
| `user.created.v1` | `events/user/` | identity-service | notification (welcome email) |
| `role.assigned.v1` | `events/user/` | identity-service | audit-service |
| `audit.recorded.v1` | `events/audit/` | audit-service | — (terminal) |
| `notification.sent.v1` | `events/notification/` | notification-service | audit-service |
| `file.uploaded.v1` | `events/file/` | file-service | audit-service |
| `inference.completed.v1` | `events/inference/` | ai-gateway | report-service |
| `flag.changed.v1` | `events/config/` | config-service | all services (refresh cache) |
| `tenant.config.updated.v1` | `events/config/` | config-service | all services |
| `sync.completed.v1` | `events/sync/` | sync-service | audit-service |
| `conflict.detected.v1` | `events/sync/` | sync-service | notification (alert admin) |
| `delivery.scheduled.v1` | `events/delivery/` | sfa-service | notification (delivery SMS) |

### API Contracts (OpenAPI)

11 OpenAPI specs in `contracts/openapi/`: one per service.

### gRPC Contracts

| Proto | Purpose |
|---|---|
| `proto/sync/sync.proto` | Mobile sync bidirectional streaming |
| `proto/identity/token.proto` | Internal token verification (service-to-service) |

### GraphQL Schemas

| Schema | Purpose |
|---|---|
| `graphql/sfa.graphql` | SFA query operations for mobile clients |
| `graphql/reporting.graphql` | Analytical queries for dashboards |

---

## 8. Quick Start — Local Development

### Prerequisites

- Node.js ≥ 18 ([download](https://nodejs.org/))
- pnpm 8 (`npm install -g pnpm@8`)
- Docker Desktop ([download](https://www.docker.com/products/docker-desktop/))

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/JyotirmoyBhowmik/DMS.git
cd DMS

# 2. Copy environment config
cp .env.example .env

# 3. Start infrastructure (Postgres, RabbitMQ, Redis)
docker-compose up -d

# 4. Install dependencies
pnpm install

# 5. Run database migrations
# (migrations auto-run on service startup in dev mode)

# 6. Build all packages and services
pnpm build

# 7. Run tests
pnpm test

# 8. Start individual services (in separate terminals)
cd services/api-gateway && pnpm dev
cd services/identity-service && pnpm dev
cd services/sfa-service && pnpm dev
# ... repeat for other services

# 9. Start web admin
cd apps/web-admin && pnpm dev
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `user` | Database username |
| `DB_PASSWORD` | `password` | Database password |
| `DB_NAME` | `dms` | Database name |
| `DB_SSL` | `false` | Enable SSL for DB connections |
| `DB_TIMEOUT` | `30000` | Query timeout in ms |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ AMQP port |
| `RABBITMQ_USER` | `guest` | RabbitMQ username |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `VAULT_ADDR` | `http://127.0.0.1:8200` | HashiCorp Vault address |
| `JWT_ISSUER` | `dms-identity-service` | JWT issuer claim |
| `JWT_AUDIENCE` | `dms-enterprise` | JWT audience claim |
| `LOCKOUT_THRESHOLD` | `5` | Failed login attempts before lockout |
| `RATE_LIMIT_MAX_REQUESTS` | `10` | Max requests per rate limit window |
| `LOG_LEVEL` | `DEBUG` | Logging level |

---

## 9. Free Deployment Guide — Online & Server

### 9.1 Free Cloud Deployment (Zero Cost)

You can deploy the entire platform for free using these services:

| Component | Free Service | Free Tier Limits |
|---|---|---|
| **PostgreSQL** | [Supabase](https://supabase.com/) or [Neon](https://neon.tech/) | 500 MB storage, 2 compute units |
| **PostgreSQL (alt)** | [ElephantSQL](https://www.elephantsql.com/) | 20 MB (dev only) |
| **Application Hosting** | [Railway](https://railway.app/) | $5/mo free credit, auto-deploy from Git |
| **Application Hosting (alt)** | [Render](https://render.com/) | Free tier web services (spin down on idle) |
| **Application Hosting (alt)** | [Fly.io](https://fly.io/) | 3 shared-cpu VMs free, 3 GB persistent storage |
| **RabbitMQ** | [CloudAMQP](https://www.cloudamqp.com/) | Little Lemur: 1M messages/month |
| **Redis** | [Upstash](https://upstash.com/) | 10K commands/day free |
| **Redis (alt)** | [Redis Cloud](https://redis.com/try-free/) | 30 MB free |
| **Frontend** | [Vercel](https://vercel.com/) or [Netlify](https://netlify.com/) | Unlimited free for personal projects |
| **Container Registry** | [GitHub Container Registry](https://ghcr.io/) | Free for public repos |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) | 2,000 min/month free |
| **Secrets** | [Doppler](https://www.doppler.com/) | Free for 5 users |
| **Monitoring** | [Grafana Cloud](https://grafana.com/products/cloud/) | 10K metrics, 50 GB logs free |

### Step-by-Step Free Deployment (Railway + Neon + CloudAMQP + Upstash)

```bash
# 1. Set up Neon PostgreSQL (free)
# → Go to https://neon.tech, create project, get connection string
# → Update DATABASE_URL in env

# 2. Set up CloudAMQP RabbitMQ (free)
# → Go to https://www.cloudamqp.com, create "Little Lemur" instance
# → Get AMQP URL

# 3. Set up Upstash Redis (free)
# → Go to https://upstash.com, create Redis database
# → Get connection string

# 4. Deploy to Railway
npm install -g @railway/cli
railway login
railway init

# Create services for each microservice
railway up --service api-gateway
railway up --service identity-service
railway up --service sfa-service
# ... etc.

# 5. Set environment variables in Railway dashboard
# Copy all values from .env.example with production URLs

# 6. Deploy frontend to Vercel
cd apps/web-admin
npx vercel --prod
```

### 9.2 Self-Hosted Server Deployment

For on-premise or VPS deployment:

```bash
# 1. Install Docker and Docker Compose on your server
curl -fsSL https://get.docker.com | sh
sudo apt install docker-compose-plugin

# 2. Clone and configure
git clone https://github.com/JyotirmoyBhowmik/DMS.git
cd DMS
cp .env.example .env
# Edit .env with production values

# 3. Build all Docker images
docker-compose -f docker-compose.yml \
               -f infrastructure/docker-compose.yml \
               build

# 4. Start everything
docker-compose -f docker-compose.yml \
               -f infrastructure/docker-compose.yml \
               up -d

# 5. Run migrations
docker exec dms-api-gateway pnpm run migrate

# 6. Verify health
curl http://localhost:3000/health
```

### 9.3 Kubernetes Deployment

```bash
# 1. Create namespace
kubectl apply -f k8s/base/namespace.yaml

# 2. Apply network policies
kubectl apply -f k8s/base/network-policy.yaml

# 3. Deploy Postgres
kubectl apply -f k8s/base/postgres-deployment.yaml
kubectl apply -f k8s/base/postgres-service.yaml

# 4. Deploy API Gateway
kubectl apply -f k8s/base/api-gateway-deployment.yaml
kubectl apply -f k8s/base/api-gateway-service.yaml

# 5. Deploy remaining services
kubectl apply -f infrastructure/k8s/

# 6. Verify pods
kubectl get pods -n dms
```

### Dependency Graph for Deployment

```
PostgreSQL 15 ──────► All Services
RabbitMQ 3 ─────────► All Services (event bus)
Redis 7 ────────────► api-gateway (rate limits, sessions)
                      config-service (flag cache)
HashiCorp Vault ────► identity-service (JWT keys)
                      pkg-crypto (encryption keys)

┌─── api-gateway ◄── All client traffic
│
├─── identity-service (MUST start first — provides JWT verification)
├─── config-service (SHOULD start early — provides feature flags)
│
├─── dms-core-service
├─── sfa-service
├─── claims-service
├─── schemes-service
├─── pricing-service
├─── finance-service
│
├─── audit-service (event consumer, can start anytime)
├─── notification-service (event consumer)
├─── file-service
├─── report-service
├─── ai-gateway-service
├─── forecasting-service
├─── recommendation-service
├─── integration-service
└─── sync-service
```

**Startup Order:**
1. Infrastructure: PostgreSQL → RabbitMQ → Redis
2. Foundation: identity-service → config-service
3. Core: dms-core-service, sfa-service (parallel)
4. Domain: claims, schemes, pricing, finance (parallel)
5. Support: audit, notification, file, report, AI, sync (parallel)

---

## 10. Scaling, Load & Compute Requirements

### 10.1 Compute Requirements by Scale

| Scale | Users | TPS | PostgreSQL | RabbitMQ | Redis | App Servers | Total RAM | Total vCPU |
|---|---|---|---|---|---|---|---|---|
| **Startup** | 1–50 | 5–20 | 1 vCPU, 2 GB RAM | Shared (CloudAMQP free) | 256 MB (Upstash free) | 1× (all services) | **4 GB** | **2 vCPU** |
| **Small** | 50–500 | 20–100 | 2 vCPU, 4 GB RAM | 1 vCPU, 1 GB RAM | 512 MB | 2× gateway, 1× each service | **16 GB** | **8 vCPU** |
| **Medium** | 500–5,000 | 100–500 | 4 vCPU, 16 GB RAM + read replica | 2 vCPU, 4 GB RAM (clustered) | 2 GB (clustered) | 3× gateway, 2× each core service | **64 GB** | **24 vCPU** |
| **Large** | 5,000–50,000 | 500–2,000 | 8 vCPU, 32 GB RAM + 2 replicas + PgBouncer | 4 vCPU, 8 GB RAM (HA cluster) | 8 GB (sentinel cluster) | 5× gateway, 3× each service, HPA | **256 GB** | **64 vCPU** |
| **Enterprise** | 50,000+ | 2,000+ | Managed (RDS/Cloud SQL) multi-AZ | Managed (Amazon MQ) | Managed (ElastiCache) | K8s auto-scaling, multi-region | **512+ GB** | **128+ vCPU** |

### 10.2 Service Resource Allocation

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas (Medium) |
|---|---|---|---|---|---|
| api-gateway | 250m | 1000m | 256 Mi | 512 Mi | 3 |
| identity-service | 250m | 500m | 256 Mi | 512 Mi | 2 |
| sfa-service | 500m | 1000m | 512 Mi | 1 Gi | 2 |
| dms-core-service | 500m | 1000m | 512 Mi | 1 Gi | 2 |
| claims-service | 250m | 500m | 256 Mi | 512 Mi | 1 |
| schemes-service | 250m | 500m | 256 Mi | 512 Mi | 1 |
| pricing-service | 250m | 500m | 256 Mi | 512 Mi | 1 |
| finance-service | 250m | 500m | 256 Mi | 512 Mi | 1 |
| Other services | 100m | 250m | 128 Mi | 256 Mi | 1 each |

### 10.3 Database Scaling Strategy

```
                    ┌────────────────┐
                    │   PgBouncer    │  ← Connection pooling (600→30 connections)
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
    ┌──────────────┐ ┌───────────┐ ┌───────────┐
    │   Primary    │ │ Read      │ │ Read      │
    │   (Writes)   │ │ Replica 1 │ │ Replica 2 │
    └──────────────┘ └───────────┘ └───────────┘
```

| Scale | Strategy |
|---|---|
| **< 500 users** | Single PG instance, no pooler needed |
| **500–5K users** | PgBouncer (configured at `infrastructure/pgbouncer.ini`) + 1 read replica |
| **5K–50K users** | PgBouncer + 2 read replicas + table partitioning (by tenant_id) |
| **50K+ users** | Managed DB (RDS Multi-AZ) + read replicas + Citus or tenant-per-schema |

### 10.4 Load Impact Analysis

| Operation | Latency Target | DB Queries | Events Emitted | Bottleneck |
|---|---|---|---|---|
| Place Order | < 200ms | 5 (stock check, credit check, insert order, insert lines, outbox) | `order.placed.v1` | DB transaction size |
| Login + JWT | < 100ms | 2 (user lookup, refresh token insert) | `user.authenticated` | bcrypt hash verification |
| Geo Check-in | < 150ms | 2 (insert check-in, outbox) | `checkin.recorded` | GPS validation |
| Price Calculation | < 50ms | 3 (price list, rules, tax) | None | Rule evaluation complexity |
| List Orders (paginated) | < 300ms | 1 (cursor-paginated query) | None | Index quality |
| Scheme Evaluation | < 500ms | 4 (active schemes, eligibility rules, order data, payout calc) | `scheme.matched` | Number of active schemes |
| Generate Report | < 5s | N (aggregation query) | None | Data volume |

### 10.5 Free Tier Capacity Estimate

With free tier services (Neon + CloudAMQP + Upstash + Railway):

| Metric | Free Tier Limit | Estimated Capacity |
|---|---|---|
| Concurrent Users | — | **~10–30** |
| Daily Orders | — | **~200–500** |
| Monthly Events | 1M (CloudAMQP) | **~30K events/day** |
| Database Storage | 500 MB (Neon) | **~50K orders** before cleanup |
| Redis Commands | 10K/day (Upstash) | Enough for ~500 API calls/day with caching |
| Railway Compute | $5 credit/month | **2 services running** continuously |

> **Recommendation for free deployment:** Run api-gateway + identity-service + one core service (sfa-service OR dms-core-service) on Railway. Use Supabase for Postgres (more generous free tier than Neon). Deploy web-admin on Vercel.

---

## 11. CI/CD Pipeline

The CI pipeline runs on every push to `main` and on all pull requests:

```yaml
# .github/workflows/ci.yml
Stages:
  1. Checkout code
  2. Install pnpm 8
  3. Setup Node.js 20
  4. Install dependencies (pnpm install)
  5. Build all packages and services (pnpm build → turbo)
  6. Run all test suites (pnpm test → turbo)
  7. Generate SBOM (Software Bill of Materials)
```

### Build Pipeline (Turborepo)

```
turbo.json pipeline:
  build → dependsOn: [^build]     # Build dependencies first (topological)
  test  → dependsOn: [build]      # Tests run after build
  lint  → (no dependencies)       # Lint runs in parallel
  typecheck → dependsOn: [^build] # Type-check with built deps
  codegen → (no dependencies)     # API code generation
```

Turborepo caches build outputs (`dist/**`, `build/**`) so unchanged packages skip rebuild entirely.

---

## 12. Security & Compliance

| Security Layer | Implementation |
|---|---|
| **Authentication** | JWT (RS256) with key rotation via `KeyManager` |
| **Authorization** | RBAC with hierarchical permissions via `pkg-rbac` |
| **Multi-Factor Auth** | TOTP support via `MfaDevice` entity |
| **Tenant Isolation** | PostgreSQL RLS on every data table |
| **SQL Injection Prevention** | Parameterized queries only; no string concatenation |
| **XSS Prevention** | Input sanitization via Zod schemas; output encoding |
| **Rate Limiting** | Per-IP and per-tenant sliding window (Redis-backed) |
| **Account Lockout** | Configurable threshold (default: 5 attempts, 15 min lockout) |
| **PII Protection** | Automatic log redaction via `pkg-logger/redactor` |
| **Secrets Management** | HashiCorp Vault integration for production keys |
| **Encryption** | AES-256-GCM for data at rest via `pkg-crypto` |
| **Audit Trail** | Immutable blockchain-style audit blocks with tamper detection |
| **CORS** | Configurable CORS middleware at gateway level |
| **SBOM** | Automated Software Bill of Materials in CI |
| **Network Policy** | Kubernetes NetworkPolicy restricting inter-service traffic |

---

## 13. Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines. Key points:

- **Commit Convention:** Conventional Commits enforced by `commitlint`
- **Code Style:** ESLint + Prettier (run `pnpm lint`)
- **Testing:** All changes require unit tests; integration tests for repos
- **PR Process:** All PRs require CI green + code review

```bash
# Development workflow
pnpm install          # Install deps
pnpm build            # Build everything
pnpm test             # Run all tests
pnpm lint             # Check code style
pnpm typecheck        # TypeScript strict mode verification
```

---

## License

See [LICENSE](./LICENSE) for details.

---

> **Built with ❤️ using Domain-Driven Design, Event-Driven Architecture, and TypeScript.**
]]>
