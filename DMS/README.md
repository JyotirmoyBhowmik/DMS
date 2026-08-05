# 🏢 Enterprise DMS & SFA Platform

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
5.  [Web Admin — Frontend LLD](#5-web-admin--frontend-lld)
6.  [AI/ML Feature Store](#6-aiml-feature-store)
7.  [Shared Packages — Function-Level Detail](#7-shared-packages--function-level-detail)
8.  [SQL Migrations — Execution Sequence & Purpose](#8-sql-migrations--execution-sequence--purpose)
9.  [Event & Contract Registry](#9-event--contract-registry)
10. [API Endpoint Summary](#10-api-endpoint-summary)
11. [Error Response Standards](#11-error-response-standards)
12. [Testing Strategy](#12-testing-strategy)
13. [Quick Start — Local Development](#13-quick-start--local-development)
14. [Free Deployment Guide — Online & Server](#14-free-deployment-guide--online--server)
15. [Infrastructure Deep Dive](#15-infrastructure-deep-dive)
16. [Scaling, Load & Compute Requirements](#16-scaling-load--compute-requirements)
17. [CI/CD Pipeline](#17-cicd-pipeline)
18. [Monitoring & Observability](#18-monitoring--observability)
19. [Database Backup & Disaster Recovery](#19-database-backup--disaster-recovery)
20. [Security & Compliance](#20-security--compliance)
21. [Versioning Policy](#21-versioning-policy)
22. [Contributing](#22-contributing)
23. [Troubleshooting](#23-troubleshooting)
24. [Glossary](#24-glossary)
25. [Changelog](#25-changelog)

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
| **ERP Integration** | SAP BAPI adapter for master data sync, India NIC GST tax compliance |
| **Feature Flags** | Dynamic feature toggles with percentage-based rollouts per tenant |

### Tech Stack

| Layer | Technology | Why Chosen |
|---|---|---|
| Language | TypeScript 5.3 (strict mode) | Type safety, shared contracts between front/back |
| Runtime | Node.js ≥ 18 | Non-blocking I/O ideal for high-concurrency API services |
| Package Manager | pnpm 8.15 (workspaces) | Hard-link deduplication saves ~60% disk vs npm |
| Build System | Turborepo 1.12 | Topological build ordering + remote caching |
| Database | PostgreSQL 15 | RLS for multi-tenancy, JSONB for flexible schemas, mature ecosystem |
| Message Broker | RabbitMQ 3 (AMQP) | Reliable delivery, dead-letter queues, management UI |
| Cache | Redis 7 | Sub-ms reads for sessions, rate limits, feature flags |
| Secret Store | HashiCorp Vault 1.15 | Dynamic secrets, transit encryption, audit logging |
| Object Storage | MinIO (S3-compatible) | File uploads, invoice PDFs, KYC document storage |
| API Protocols | REST (OpenAPI 3.1), gRPC (Protobuf), GraphQL | REST for CRUD, gRPC for service-to-service, GraphQL for mobile |
| Frontend | React 18 (Vite), React Native, Flutter | Web admin, cross-platform mobile apps |
| CI/CD | GitHub Actions | Integrated with repo, free for public projects |
| Container | Docker + Docker Compose | Reproducible builds, consistent dev/prod parity |
| Orchestration | Kubernetes | Auto-scaling, rolling updates, network policies |
| Connection Pooling | PgBouncer | Transaction-mode pooling, 2000→100 connection multiplexing |
| Linting | ESLint + Prettier + Commitlint + Husky | Automated code quality gates on every commit |
| ML Feature Store | Feast | Online/offline feature serving for ML models |

---

## 2. Architecture & Design Principles

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
│  ┌──────────┐  ┌───────────────┐  ┌────────────────┐                │
│  │Web Admin │  │Mobile RN/SFA  │  │Mobile Flutter  │                │
│  │(React)   │  │(React Native) │  │(Dart)          │                │
│  └────┬─────┘  └──────┬────────┘  └───────┬────────┘                │
│       │               │                    │                         │
│       └───────────────┼────────────────────┘                         │
│                       ▼                                              │
│        ┌─────────────────────────┐                                   │
│        │      NGINX Reverse      │  ← SSL termination, static files  │
│        │         Proxy           │                                   │
│        └───────────┬─────────────┘                                   │
│                    ▼                                                  │
│        ┌─────────────────────────┐                                   │
│        │     API Gateway         │  ← Auth, Rate-Limit, CORS,       │
│        │   (Trie-based Router)   │    Request Validation, Routing    │
│        └───────────┬─────────────┘                                   │
│                    │                                                  │
│   ┌────────┬───────┼───────┬────────┬────────┬────────┬────────┐    │
│   ▼        ▼       ▼       ▼        ▼        ▼        ▼        ▼    │
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐  │
│ │ SFA  ││ DMS  ││Claims││Scheme││Price ││Finance││Identi││Config│  │
│ │ Svc  ││ Core ││ Svc  ││ Svc  ││ Svc  ││  Svc ││ty Svc││ Svc  │  │
│ └──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘  │
│    │       │       │       │       │       │       │       │        │
│    └───────┴───────┴───┬───┴───────┴───────┴───────┴───────┘        │
│                        ▼                                             │
│              ┌──────────────────┐                                    │
│              │    RabbitMQ      │  ← Transactional Outbox pattern    │
│              │  (Event Bus)    │    Dead-letter queues for retries   │
│              └────────┬─────────┘                                    │
│                       ▼                                              │
│    ┌─────────────────────────────────────────┐                       │
│    │           PostgreSQL 15                  │                       │
│    │  ┌──────────────────────────────────┐   │                       │
│    │  │  RLS per tenant                   │   │                       │
│    │  │  Version columns (optimistic lock)│   │                       │
│    │  │  Outbox table (reliable events)   │   │                       │
│    │  │  Deduplication table (idempotent)  │   │                       │
│    │  └──────────────────────────────────┘   │                       │
│    └──────────────┬──────────────────────────┘                       │
│                   │                                                   │
│    ┌──────────────┼──────────────────┐                                │
│    │              │                   │                                │
│    ▼              ▼                   ▼                                │
│ ┌──────┐  ┌────────────┐    ┌─────────────┐                         │
│ │Redis │  │ PgBouncer  │    │   MinIO      │                         │
│ │Cache │  │ Pool (6432)│    │ Object Store │                         │
│ └──────┘  └────────────┘    └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Design Patterns

| Pattern | Implementation | Why |
|---|---|---|
| **Domain-Driven Design** | `domain/entities`, `domain/aggregates`, `domain/repositories`, `domain/value-objects`, `domain/policies` | Encapsulates complex business logic; protects invariants |
| **Hexagonal Architecture** | Application layer (use cases) depends only on ports; infra adapters implement them | Swappable infrastructure; testable without DB |
| **Transactional Outbox** | Domain events written to `outbox_events` table within business TX; background dispatcher publishes to RabbitMQ | Guarantees at-least-once delivery without 2PC |
| **Idempotent Consumer** | `processed_events` table deduplicates by correlation ID | Prevents duplicate processing on redelivery |
| **Row-Level Security** | Every table has RLS policy on `tenant_id`; app sets `SET app.current_tenant = ?` | Zero-trust tenant isolation at DB layer |
| **Optimistic Concurrency** | Every aggregate has `version` column; UPDATE uses `WHERE version = $expected` | Prevents lost updates without pessimistic locks |
| **CQRS (Light)** | Write path through aggregates; read path uses lean projections | Optimized reads without polluting domain model |
| **Circuit Breaker** | `pkg-http` wraps external calls with circuit breaker + exponential backoff | Prevents cascade failures from slow dependencies |
| **Saga Pattern** | Cross-service workflows (order→inventory→invoice) use choreography via events | Maintains eventual consistency without distributed TX |

### Data Flow: Order Placement (End-to-End)

```
Agent Mobile App
    │
    ▼ POST /api/v1/orders
API Gateway ──► Auth Middleware (JWT verify)
    │              ──► Rate Limiter (Redis)
    │              ──► Request Validator (Zod)
    │
    ▼ Forward to SFA Service
SFA Service
    │
    ├── 1. PlaceOrderUseCase.execute()
    │   ├── Validate order lines (pkg-validation)
    │   ├── Check credit limit (dms-core query)
    │   ├── Check stock availability (dms-core query)
    │   ├── Apply scheme discounts (schemes-service query)
    │   ├── Calculate final price (pricing-service)
    │   └── OrderAggregate.placeOrder()
    │       ├── Set status = PLACED
    │       ├── Record domain event: OrderPlaced
    │       └── Increment version
    │
    ├── 2. Transaction: BEGIN
    │   ├── INSERT INTO orders (...)
    │   ├── INSERT INTO order_lines (...)
    │   ├── INSERT INTO outbox_events (OrderPlaced)
    │   └── COMMIT
    │
    └── 3. Return 201 Created
            │
            ▼ (Background) OutboxDispatcher polls
RabbitMQ ◄── Publish OrderPlaced event
    │
    ├──► DMS Core: Reserve inventory
    ├──► Schemes: Evaluate scheme eligibility
    ├──► Finance: Create receivable
    ├──► Notification: Send SMS confirmation
    └──► Audit: Record audit block
```

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
│   │   ├── src/main.tsx                # 3,500-line SPA with tabs: Overview, Telemetry,
│   │   │                              #   DMS, SFA, AI Sandbox, Audit, Identity
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── index.html
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
│   ├── file-service/                   # File upload/storage (MinIO)
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
│   │   ├── src/connection/pool.ts      # Connection pool with health checks
│   │   ├── src/connection/config.ts    # Typed DB config from env
│   │   ├── src/queries/query_builder.ts # Fluent parameterized query builder
│   │   ├── src/queries/pagination.ts   # Cursor/offset pagination
│   │   ├── src/migrations/migration_runner.ts # Versioned migration runner
│   │   ├── src/rls/tenant_context.ts   # SET app.current_tenant per session
│   │   ├── src/rls/policy_builder.ts   # Fluent RLS policy builder
│   │   └── src/unit-of-work/uow.ts     # Transaction wrapper
│   ├── pkg-events/                     # Outbox, RabbitMQ broker, codecs
│   │   ├── src/outbox/outbox.repository.ts # Persist events in business TX
│   │   ├── src/outbox/dispatcher.ts    # Poll + publish + mark dispatched
│   │   ├── src/broker/rabbitmq.ts      # AMQP connection management
│   │   ├── src/consumers/idempotent_consumer.ts # Dedup via processed_events
│   │   ├── src/codecs/json.ts          # JSON serialization
│   │   ├── src/codecs/avro.ts          # Avro binary serialization
│   │   ├── src/codecs/protobuf.ts      # Protobuf serialization
│   │   ├── src/envelope/envelope.ts    # Standard event wrapper
│   │   └── src/schemas/               # Typed event schemas (order, visit, delivery)
│   ├── pkg-validation/                 # Zod schemas + business rules
│   │   ├── src/schemas/               # 11 schema files (order, auth, attendance...)
│   │   ├── src/rules/business.rules.ts # Credit limit, stock availability checks
│   │   ├── src/rules/order.rules.ts    # Order-specific validation
│   │   └── src/errors.ts              # Structured ValidationError type
│   ├── pkg-rbac/                       # Role-Based Access Control engine
│   ├── pkg-logger/                     # Structured JSON logger + PII redaction
│   │   ├── src/logger.ts              # JSON logger with levels
│   │   ├── src/correlation/context.ts  # AsyncLocalStorage trace propagation
│   │   ├── src/formatters/json.ts      # JSON log formatter
│   │   └── src/redaction/redactor.ts   # PII masking (passwords, tokens, cards)
│   ├── pkg-crypto/                     # AES-256-GCM, bcrypt, RSA, JWT signing
│   ├── pkg-http/                       # HTTP client: retries, circuit breaker, timeouts
│   ├── pkg-config/                     # Config loader (env, Vault)
│   ├── pkg-config-client/              # Remote config service client
│   ├── pkg-testing/                    # Test fixtures, builders, mocks
│   ├── pkg-analytics/                  # Analytics event tracking
│   ├── pkg-integrations/               # ERP (SAP BAPI) & tax (India NIC GST) adapters
│   │   ├── src/erp/erp-port.interface.ts   # ERP port interface
│   │   ├── src/erp/sap-bapi.adapter.ts     # SAP BAPI implementation
│   │   ├── src/tax/tax-compliance-port.interface.ts # Tax port interface
│   │   └── src/tax/india-nic-gst.adapter.ts # India GST adapter
│   ├── pkg-mobile-sync/                # Offline-first sync protocol
│   └── pkg-ui-shared/                  # Shared UI components/hooks
│
├── contracts/                          # API & event contracts
│   ├── openapi/                        # OpenAPI 3.1 specs (11 services)
│   │   ├── sfa-service.yaml (24 KB)   # Largest spec: orders, visits, etc.
│   │   ├── identity-service.yaml
│   │   ├── dms-core-service.yaml
│   │   ├── audit-service.yaml
│   │   ├── config-service.yaml
│   │   ├── notification-service.yaml
│   │   ├── file-service.yaml
│   │   ├── ai-gateway-service.yaml
│   │   ├── forecasting-service.yaml
│   │   ├── recommendation-service.yaml
│   │   └── report-service.yaml
│   ├── proto/                          # Protobuf definitions (gRPC)
│   │   ├── sync/sync.proto             # Mobile sync bidirectional streaming
│   │   └── identity/token.proto        # Service-to-service token verification
│   ├── graphql/                        # GraphQL schemas
│   │   ├── sfa.graphql                 # SFA queries for mobile clients
│   │   └── reporting.graphql           # Analytical queries for dashboards
│   ├── events/                         # JSON Schema event payloads (14 domains)
│   │   ├── order/                      # order.placed.v1, v2, cancelled.v1
│   │   ├── visit/                      # visit.completed.v1
│   │   ├── delivery/                   # delivery.scheduled.v1, completed.v1
│   │   ├── claim/                      # claim.settled.v1
│   │   ├── settlement/                 # settlement.posted.v1
│   │   ├── inventory/                  # inventory.adjusted.v1
│   │   ├── user/                       # user.created.v1, role.assigned.v1
│   │   ├── audit/                      # audit.recorded.v1
│   │   ├── notification/               # notification.sent.v1
│   │   ├── file/                       # file.uploaded.v1
│   │   ├── inference/                  # inference.completed.v1
│   │   ├── config/                     # flag.changed.v1, tenant.config.updated.v1
│   │   ├── sync/                       # sync.completed.v1, conflict.detected.v1
│   │   └── distributor/                # distributor events
│   └── registry.md                     # Central contract index
│
├── db/                                 # Database layer
│   ├── migrations/                     # Versioned SQL migrations (7 schemas, 46 files)
│   │   ├── system/   (V001–V004)       # System tables, migration tracking, outbox backoff
│   │   ├── identity/ (V1–V2)          # Users, roles, tenants, tokens, outbox
│   │   ├── sfa/      (V001–V022)      # Orders, visits, agents, beat routes, RLS policies
│   │   ├── dms/      (V001–V013)      # Products, inventory, outlets, pricing, RLS
│   │   ├── claims/   (V001)           # Claims lifecycle
│   │   ├── schemes/  (V001–V002)      # Scheme definitions + outbox
│   │   ├── pricing/  (V001)           # Price lists + entries
│   │   └── finance/  (V001)           # Ledger accounts + entries + postings
│   ├── policies/                       # Standalone RLS policy definitions
│   └── seeds/                          # Development seed data
│
├── infrastructure/                     # Deployment infrastructure
│   ├── docker-compose.yml              # Extended infra: PG, Redis, Vault, MinIO
│   ├── pgbouncer.ini                   # Connection pooler (2000 clients → 100 PG conns)
│   ├── nginx/                          # Reverse proxy / SSL termination config
│   └── k8s/                            # Kubernetes manifests (4 services)
│       ├── api-gateway.yaml
│       ├── sfa-service.yaml
│       ├── identity-service.yaml
│       └── audit-service.yaml
│
├── k8s/base/                           # K8s base manifests
│   ├── namespace.yaml                  # dms-prod namespace
│   ├── network-policy.yaml             # Pod-to-pod traffic restrictions
│   ├── api-gateway-deployment.yaml     # Gateway deployment + replicas
│   ├── api-gateway-service.yaml        # ClusterIP / LoadBalancer service
│   ├── postgres-deployment.yaml        # StatefulSet for PostgreSQL
│   └── postgres-service.yaml           # Headless service for PG
│
├── ai-ml/                              # ML Feature Store
│   └── feature-store/
│       ├── feature_store.yaml          # Feast project config (Redis online store)
│       └── definitions/entities.py     # Feature entities: outlet, agent
│
├── scripts/
│   └── backup-db.sh                    # Automated PG backup → S3 upload
│
├── docs/                               # Additional documentation
│
├── docker-compose.yml                  # Dev environment (PG, PG replica, RabbitMQ, Redis)
├── package.json                        # Root workspace config
├── pnpm-workspace.yaml                 # Workspace: apps/*, services/*, packages/*
├── turbo.json                          # Turborepo pipeline config
├── tsconfig.base.json                  # Shared TypeScript compiler (ES2022, strict)
├── .eslintrc.js                        # ESLint rules
├── .prettierrc                         # Code formatting
├── commitlint.config.js                # Conventional commit enforcement (38 scopes)
├── .editorconfig                       # Editor settings (indent, EOL)
├── .env.example                        # Environment variable template (52 vars)
├── .nvmrc                              # Node version pinning
├── .tool-versions                      # asdf version manager
├── CHANGELOG.md                        # Release changelog
├── CONTRIBUTING.md                     # Contribution guidelines
├── SECURITY.md                         # Security vulnerability reporting policy
└── LICENSE                             # License file
```

---

## 4. Microservices — Low-Level Design (LLD)

Each microservice follows a **four-layer DDD architecture**:

```
service/src/
├── domain/                 # Pure business logic (zero framework deps)
│   ├── entities/           # Domain entities with business methods
│   ├── aggregates/         # Aggregate roots with invariant enforcement
│   ├── value-objects/      # Immutable value types (Money, GeoPoint)
│   ├── repositories/       # Repository interfaces (ports)
│   ├── policies/           # Domain policies & business rules
│   └── errors/             # Domain-specific typed exceptions
├── application/            # Use cases (orchestration layer)
│   ├── usecases/           # Command/Query handlers
│   ├── ports/              # Port interfaces for infra adapters
│   └── queries/            # Read-optimized query handlers
├── infrastructure/         # Framework & external adapters
│   ├── database/
│   │   ├── repositories/   # Postgres implementations (parameterized SQL)
│   │   └── transactional-client.ts  # TX wrapper with RLS context
│   ├── providers/          # External API adapters (OpenAI, Vertex)
│   └── routing/            # Custom router implementations
└── presentation/           # Entry points (HTTP, gRPC, Events)
    ├── rest/controllers/   # HTTP REST controllers
    ├── events/             # RabbitMQ event consumers
    └── grpc/               # gRPC service implementations
```

### 4.1 api-gateway

> Central entry point for all client requests. Handles authentication, rate limiting, request validation, and upstream routing via a O(log n) prefix-trie router.

| Layer | File | Function/Class | Purpose | Connects To |
|---|---|---|---|---|
| **Domain** | `entities/api_key.ts` | `ApiKey` | API key with hashed secret, scope, expiry | — |
| | `entities/rate_limit_entry.ts` | `RateLimitEntry` | Sliding-window rate limit state per IP/tenant | — |
| | `entities/route.ts` | `Route` | Dynamic route definition (method, path, upstream) | — |
| | `aggregates/gateway.aggregate.ts` | `GatewayAggregate` | Route matching + request lifecycle orchestration | Route, RateLimitEntry |
| | `value-objects/api_version.ts` | `ApiVersion` | Semantic version parsing (v1, v2) | — |
| | `value-objects/route_match.ts` | `RouteMatch` | Matched route + extracted path params | Route |
| | `errors/gateway.errors.ts` | `GatewayError`, `RouteNotFoundError`, `RateLimitExceededError` | Domain exceptions | — |
| **Application** | `usecases/route_request.usecase.ts` | `RouteRequestUseCase.execute()` | Match route → check rate limit → proxy to upstream | GatewayAggregate, UpstreamAdapter |
| | `usecases/manage_routes.usecase.ts` | `ManageRoutesUseCase` | CRUD for route configuration | RouteRepository |
| | `usecases/manage_api_keys.usecase.ts` | `ManageApiKeysUseCase` | Issue/revoke API keys | ApiKeyRepository |
| | `usecases/health_check.usecase.ts` | `HealthCheckUseCase` | Liveness + readiness probes for all upstreams | All upstream services |
| | `ports/route.repository.ts` | `IRouteRepository` | Port: route persistence | — |
| | `ports/api_key.repository.ts` | `IApiKeyRepository` | Port: API key persistence | — |
| | `ports/rate_limit.store.ts` | `IRateLimitStore` | Port: rate limit state (Redis-backed) | — |
| | `ports/upstream.adapter.ts` | `IUpstreamAdapter` | Port: HTTP proxy to downstream services | — |
| **Infrastructure** | `routing/trie_router.ts` | `TrieRouter.match()` | O(log n) prefix-trie route matcher | — |
| **Presentation** | `controllers/gateway.controller.ts` | `GatewayController` | Main reverse-proxy endpoint | RouteRequestUseCase |
| | `controllers/ai.controller.ts` | `AiController` | AI inference proxy | ai-gateway-service |
| | `controllers/analytics.controller.ts` | `AnalyticsController` | Analytics event ingestion | pkg-analytics |
| | `controllers/sync.controller.ts` | `SyncController` | Mobile sync endpoint | sync-service |
| **Middleware** | `middleware/auth.ts` | `authMiddleware()` | JWT verification → extracts tenant_id, user_id, roles | identity-service (gRPC) |
| | `middleware/cors.ts` | `corsMiddleware()` | CORS policy enforcement (allowed origins, methods) | — |
| | `middleware/rate_limiter.ts` | `rateLimiterMiddleware()` | Sliding-window per-IP/per-tenant rate limiting | Redis |
| | `middleware/request_validator.ts` | `requestValidatorMiddleware()` | Zod schema validation of request body | pkg-validation |
| **Tests** | `gateway_auth.test.ts` | — | Auth flow: valid JWT, expired JWT, missing token | — |
| | `gateway_attendance.test.ts` | — | Attendance API: create, list, permissions | — |
| | `gateway_geo_checkin.test.ts` | — | Geo check-in: valid coords, out-of-range | — |
| | `gateway_identity.test.ts` | — | Identity API: login, register, RBAC | — |
| | `gateway_outlet_census.test.ts` | — | Outlet census CRUD through gateway | — |

---

### 4.2 identity-service

> Full IAM service: multi-tenant user management, RBAC, JWT token issuance/verification, MFA device management, RSA key rotation.

| Layer | File | Function/Class | Purpose | Connects To |
|---|---|---|---|---|
| **Domain Entities** | `entities/user.ts` | `User` | User aggregate with password hash, lockout counter, status | Role, Tenant |
| | `entities/role.ts` | `Role` | Named role with permission set (admin, agent, distributor) | Permission |
| | `entities/permission.ts` | `Permission` | Granular permission (resource:action, e.g. `orders:create`) | — |
| | `entities/tenant.ts` | `Tenant` | Tenant config: name, billing, status (ACTIVE/SUSPENDED) | — |
| | `entities/refresh_token.ts` | `RefreshToken` | Opaque refresh token with expiry, rotation counter | User |
| | `entities/mfa_device.ts` | `MfaDevice` | TOTP/SMS device registration with last-used tracking | User |
| **Repositories (Ports)** | 6 interfaces | `save()`, `findById()`, `findByEmail()`, `list()`, `delete()` | Domain persistence contracts | — |
| **Use Cases** | `usecases/issue_token.usecase.ts` | `IssueTokenUseCase.execute(email, password)` | Authenticate → check lockout → verify hash → issue JWT+refresh | User repo, KeyManager |
| | `usecases/verify_token.usecase.ts` | `VerifyTokenUseCase.execute(token)` | Validate JWT signature, check expiry, extract claims | KeyManager |
| | `usecases/refresh_token.usecase.ts` | `RefreshTokenUseCase.execute(refreshToken)` | Rotate refresh token, issue new JWT | RefreshToken repo |
| | `usecases/assign_role.usecase.ts` | `AssignRoleUseCase.execute(userId, roleId)` | Assign role to user with permission inheritance | User, Role repos |
| | `usecases/key_manager.ts` | `KeyManager.sign()`, `.verify()`, `.rotate()` | RSA key pair rotation + JWKS endpoint support | pkg-crypto |
| | `usecases/user.usecases.ts` | `UserUseCases` | CRUD: create, get, update, list, delete, search | User repo |
| | `usecases/role.usecases.ts` | `RoleUseCases` | CRUD for roles | Role repo |
| | `usecases/permission.usecases.ts` | `PermissionUseCases` | CRUD for permissions | Permission repo |
| | `usecases/tenant.usecases.ts` | `TenantUseCases` | Tenant onboarding, suspend, reactivate | Tenant repo |
| | `usecases/mfa_device.usecases.ts` | `MfaDeviceUseCases` | Enroll, verify OTP, deactivate device | MfaDevice repo |
| **PG Repositories** | 6 implementations | `UserPgRepository`, `RolePgRepository`, etc. | Parameterized SQL + RLS context per query | PostgreSQL |
| **Presentation** | `controllers/auth.controller.ts` | `POST /login`, `POST /logout`, `POST /refresh` | Authentication endpoints | IssueToken, VerifyToken |
| | `controllers/user.controller.ts` | `GET/POST/PUT/DELETE /users` | User CRUD | UserUseCases |
| | `controllers/role.controller.ts` | `GET/POST/PUT/DELETE /roles` | Role CRUD | RoleUseCases |
| | `controllers/permission.controller.ts` | `GET/POST/PUT/DELETE /permissions` | Permission CRUD | PermissionUseCases |
| | `controllers/tenant.controller.ts` | `GET/POST/PUT/DELETE /tenants` | Tenant management | TenantUseCases |
| | `controllers/mfa_device.controller.ts` | `POST /mfa/enroll`, `POST /mfa/verify` | MFA enrollment/verification | MfaDeviceUseCases |
| | `grpc/token_service.grpc.ts` | `TokenServiceGrpc.Verify()` | Internal gRPC token verification (service-to-service) | VerifyTokenUseCase |

---

### 4.3 sfa-service

> The largest service (~100 files). Manages field sales operations: orders, visits, journey plans, attendance, geo-check-ins, outlet management, beat routes, surveys, competitor capture, delivery confirmations, order approvals, sales targets, merchandising audits.

| Domain Entity | File | Key Methods | Business Rule |
|---|---|---|---|
| `Order` | `entities/order.ts` | `create()`, `addLine()`, `cancel()` | Status: DRAFT→PLACED→PROCESSING→DELIVERED→CANCELLED |
| `OrderAggregate` | `aggregates/order.aggregate.ts` | `placeOrder()`, `processOrder()` | Validates stock, credit limit, applies scheme discounts |
| `Visit` | `entities/visit.ts` | `create()`, `complete()`, `addNote()` | Must have geo-check-in before completion |
| `JourneyPlan` | `entities/journey-plan.ts` | `create()`, `assignOutlets()` | Max outlets per day enforced by JourneyPolicy |
| `BeatRoute` | `entities/beat-route.ts` | `create()`, `update()` | Links outlets to weekly schedule |
| `Attendance` | `entities/attendance.ts` | `checkIn()`, `checkOut()` | GPS-validated within geofence radius |
| `GeoCheckin` | `entities/geo-checkin.ts` | `create()`, `validate()` | Must be within 200m of outlet coordinates |
| `OutletCensus` | `entities/outlet-census.ts` | `create()`, `update()` | Captures audit data (shelving, competition) |
| `OutletProfile` | `entities/outlet-profile.ts` | `create()`, `update()`, `classify()` | Classification: A/B/C/D by revenue tier |
| `CompetitorCapture` | `entities/competitor-capture.ts` | `create()` | Captures competitor product/price intel |
| `DeliveryConfirmation` | `entities/delivery-confirmation.ts` | `create()`, `confirm()` | Proof of delivery with photo evidence |
| `OrderApproval` | `entities/order-approval.ts` | `create()`, `approve()`, `reject()` | Multi-level approval workflow |
| `SalesTarget` | `entities/sales-target.ts` | `set()`, `track()` | Monthly/quarterly target tracking |
| `Survey` | `entities/survey.ts` | `create()`, `submit()` | Custom survey forms for outlets |
| `VanSale` | `entities/van-sale.ts` | `create()` | Direct van-to-outlet sales |
| `MerchandisingAudit` | `entities/merchandising-audit.ts` | `create()` | In-store merchandising compliance |
| `Agent` | `entities/agent.ts` | `create()` | Sales rep profile + territory assignment |

**Use Cases (44 total):**

| Use Case Group | CRUD Operations | Purpose |
|---|---|---|
| Attendance | Create, Get, Update, List | Track field agent clock-in/out with GPS |
| Beat Route | Create, Get, Update, List | Manage weekly outlet visit schedules |
| Visit | Create, Get, Update, List | Track outlet visits with duration/notes |
| Geo Check-in | Create, Get, Update, List | GPS-validated location check-ins |
| Journey Plan | Create, Get, Update, List | Daily route planning for agents |
| Outlet Census | Create, Get, Update, List | Outlet data capture campaigns |
| Outlet Profile | Create, Get, Update, List | Outlet master data management |
| Order Approval | Create, Update, List | Multi-level order approval workflow |
| Order | PlaceOrder, ProcessOrder | Full order lifecycle management |
| Competitor Capture | Create | Competitor intelligence capture |
| Delivery Confirmation | Create | Proof of delivery recording |
| Sales Target | CRUD via usecases file | Target CRUD and tracking |
| Survey | CRUD via usecases file | Survey management |
| Enterprise SFA | Cross-cutting operations | Aggregated SFA operations |

**Value Objects:** `GeoPoint` (lat/lng + distance calc), `Money` (currency-safe arithmetic), `OrderLine` (immutable product+qty+price), `TimeWindow` (start/end range).

**Domain Policies:** `JourneyPolicy` (max outlets/day, min visit duration), `SchemePolicy` (scheme eligibility evaluation).

**Postgres Repositories (16):** Each has `.pg-repository.ts` with parameterized queries, RLS context setting, optimistic concurrency control.

**REST Controllers (14):** attendance, beat_route, competitor-capture, delivery-confirmation, enterprise_sfa, geo_checkin, journey_plan, order, order_approval, outlet-profile, outlet_census, sales-target, survey, visit.

**Event Consumers:** `event_consumer.ts` (generic handler), `order_placed_consumer.ts` (triggers inventory reservation in dms-core).

---

### 4.4 dms-core-service

> Distributor management: products, inventory, outlets, credit limits, KYC, pricing, invoices, stock ledger, batch tracking.

| Layer | File | Purpose | Key Methods |
|---|---|---|---|
| **Domain Entities** | `product.ts` | Product catalog: SKU, HSN code, tax codes | `create()`, `updatePrice()`, `deactivate()` |
| | `product-category.ts` | Hierarchical category tree | `create()`, `moveToParent()` |
| | `inventory.ts` | Stock per product per location | `adjust()`, `reserve()`, `release()` |
| | `inventory_aggregate.ts` | Aggregate: stock operations | `adjustStock()`, `reserveForOrder()`, `releaseReservation()` |
| | `outlet.ts` | Retail outlet / distributor point | `create()`, `classify()`, `suspend()` |
| | `credit-limit.ts` | Credit ceiling with utilization | `setLimit()`, `utilize()`, `release()`, `checkAvailable()` |
| | `kyc-document.ts` | KYC docs (PAN, GST, FSSAI) | `upload()`, `verify()`, `reject()` |
| | `invoice.ts` | Tax invoice with line items | `generate()`, `addLine()`, `finalize()` |
| | `batch.ts` | Batch/lot tracking | `create()`, `isExpired()`, `getShelfLife()` |
| | `stock-ledger-entry.ts` | Immutable stock movement entry | `record()` (append-only) |
| | `stock-transfer.ts` | Inter-warehouse transfer | `create()`, `approve()`, `receive()` |
| | `price-list.ts` | Price list assignment | `assign()`, `revoke()` |
| **Domain Policies** | `pricing_policy.ts` | Multi-tier pricing evaluation | `evaluate(product, distributor, channel)` → final price |
| **PG Repositories** | 11 implementations | Parameterized SQL, RLS, optimistic locking | save, findById, list, delete |
| **Controllers** | `dms.controller.ts` | Standard CRUD for all entities | GET/POST/PUT/DELETE |
| | `enterprise_dms.controller.ts` | Aggregated operations (cross-entity) | Dashboard data, bulk operations |
| **Event Consumers** | `order_placed_consumer.ts` | Inventory reservation on order.placed | Reserves stock, decrements available qty |
| **Worker** | `worker.ts` | Background outbox dispatcher | Polls outbox_events, publishes to RabbitMQ |

---

### 4.5 claims-service

> Manages the full claims lifecycle: raise → validate → approve/reject → settle.

| Layer | File | Purpose | State Machine |
|---|---|---|---|
| **Domain** | `entities/claim.entity.ts` | Claim with state machine | RAISED → VALIDATED → APPROVED/REJECTED → SETTLED |
| | `aggregates/claim.aggregate.ts` | Invariant enforcement | Can't approve already-rejected; can't settle unapproved |
| | `repositories/claim.repository.ts` | Port interface | save, findById, list, delete |
| **Use Cases** | `raise_claim.usecase.ts` | Create new claim with evidence | Validates required fields, sets RAISED status |
| | `validate_claim.usecase.ts` | Business validation rules | Checks amount limits, document completeness |
| | `approve_claim.usecase.ts` | Manager approval | Creates audit trail, emits claim.approved event |
| | `reject_claim.usecase.ts` | Rejection with reason | Requires rejection_reason, emits claim.rejected |
| | `settle_claim.usecase.ts` | Financial settlement | Posts to finance-service ledger, emits claim.settled |
| | `get_claim.usecase.ts` | Tenant-scoped detail view | RLS-filtered, projects only authorized fields |
| | `list_claims.usecase.ts` | Paginated list with filters | Supports status, date range, amount range filters |
| **Infrastructure** | `claim.pg-repository.ts` | PG repo with RLS + optimistic locking | SET app.current_tenant, WHERE version = $n |
| **Presentation** | `claim.controller.ts` | REST endpoints for all use cases | POST /claims, PUT /claims/:id/approve, etc. |

---

### 4.6 schemes-service

> Scheme engine: create schemes with eligibility rules, evaluate orders against active schemes, manage payouts and promotions.

| File | Purpose |
|---|---|
| `entities/scheme.entity.ts` | Scheme definition: type (volume/value/combo), validity period, rules, benefits |
| `aggregates/scheme.aggregate.ts` | Validates scheme invariants (start < end, benefit > 0) |
| `usecases/create_scheme.usecase.ts` | Create with full validation |
| `usecases/get_scheme.usecase.ts` | Tenant-scoped detail with field projection |
| `usecases/update_scheme.usecase.ts` | Update with optimistic lock (146 lines of business logic) |
| `usecases/list_schemes.usecase.ts` | Paginated listing with status/type filters |
| `usecases/evaluate_schemes.usecase.ts` | Match order against active schemes → calculate benefits |
| `event_consumer.ts` + `order_placed_consumer.ts` | Auto-evaluate schemes on order placement |
| `worker.ts` | Outbox dispatcher for scheme events |

---

### 4.7 pricing-service

> Multi-tier pricing engine with waterfall calculation: base price → slab adjustment → channel rule → geo rule → discount.

| File | Purpose |
|---|---|
| `entities/price-list.entity.ts` | Price list header (name, currency, validity period) |
| `entities/price-list-entry.entity.ts` | Per-product price within a list |
| `entities/price-list-assignment.entity.ts` | List-to-distributor/region mapping |
| `entities/tax-rule.entity.ts` | Tax rate rules (GST/VAT by category) |
| `aggregates/pricing.aggregate.ts` | Price waterfall: base → slab → channel → geo → discount → tax |
| `usecases/calculate_price.usecase.ts` | Real-time price calculation for a product+distributor+channel |
| `worker.ts` | Background batch price recomputation on rule changes |

---

### 4.8 finance-service

> Double-entry accounting ledger. Every financial event produces balanced journal entries.

| File | Purpose |
|---|---|
| `entities/ledger-account.entity.ts` | Chart of accounts (assets, liabilities, revenue, expense) |
| `entities/ledger-entry.entity.ts` | Journal entry header (date, narration, correlation_id) |
| `entities/ledger-posting.entity.ts` | Debit/credit posting line (account, amount, direction) |
| `entities/ledger-period.entity.ts` | Accounting period (open/closed) — prevents posting to closed periods |
| `aggregates/ledger-entry.aggregate.ts` | **Enforces balanced entries**: sum(debits) == sum(credits) |
| `usecases/post-ledger-entry.usecase.ts` | Create balanced journal entry within open period |
| `usecases/reverse-ledger-entry.usecase.ts` | Reversal with contra postings (creates mirror entry) |
| `finance-event-consumer.ts` | Auto-post on: claim.settled → debit expense, credit payable |

---

### 4.9 Supporting Services

| Service | Key Files | Purpose | Key Detail |
|---|---|---|---|
| **audit-service** | `audit-block.ts`, `record_audit.usecase.ts`, `verify_chain.usecase.ts` | Blockchain-style immutable audit trail | Each block has `prevHash` → tamper detection via chain verification |
| **config-service** | `entities.ts`, `evaluate_flag.usecase.ts`, `update_flag.usecase.ts` | Feature flag evaluation | Supports tenant targeting, user targeting, percentage rollouts |
| **notification-service** | `notification.ts`, `template.ts` | Multi-channel notifications | SMS, email, push with Handlebars templates |
| **file-service** | `file.controller.ts` | File upload/download | Signed URL generation for MinIO/S3 |
| **report-service** | `report.controller.ts` | Analytics dashboards | Scheduled report generation, CSV/PDF export |
| **ai-gateway-service** | `inference.aggregate.ts`, `run_inference.usecase.ts` | Unified AI inference proxy | Provider abstraction: OpenAI, Vertex AI, internal models. Rate limiting per model. Token usage tracking |
| **forecasting-service** | `forecast.controller.ts` | Demand forecasting | Connects to Python ML models via HTTP |
| **recommendation-service** | `recommendation.controller.ts` | Product recommendations | Collaborative filtering, market basket analysis |
| **integration-service** | `erp-sync.job.ts` | SAP BAPI sync | Scheduled job for master data synchronization |
| **sync-service** | `sync.controller.ts` | Offline-first mobile sync | Bidirectional sync with conflict detection/resolution |

---

## 5. Web Admin — Frontend LLD

The web admin is a **3,500-line single-page React application** (`apps/web-admin/src/main.tsx`) built with Vite.

### Tab Architecture

| Tab | Features | State Management |
|---|---|---|
| **Overview** | KPI dashboard, distributor metrics, revenue charts | Simulated real-time data with intervals |
| **Telemetry** | System health, service status, latency metrics | Auto-refreshing telemetry feed |
| **DMS** | Inventory list with search/filter, stock alerts, product management | `inventoryFilter`, `inventorySearch` state |
| **SFA** | Order approvals (multi-level), journey plans, beat adherence | `orderApprovals`, `journeyPlans` state arrays |
| **AI Sandbox** | Prompt-based AI inference, model selection, response display | `aiPrompt`, `selectedModel`, `aiOutput` state |
| **Audit** | Blockchain-style audit ledger, chain verification button | `auditChain`, `auditVerdict` state |
| **Identity** | User CRUD, role management, tenant admin, permission editor, MFA devices | 5 sub-tabs with full form-based CRUD |

### Identity Sub-Tabs

| Sub-Tab | Entity | Operations |
|---|---|---|
| Users | `User` | Create, edit, suspend, activate, assign roles |
| Roles | `Role` | Create, edit, mark as system/custom |
| Tenants | `Tenant` | Create, suspend, reactivate |
| Permissions | `Permission` | Create, edit resource:action pairs |
| MFA | `MfaDevice` | View enrolled devices, activate/deactivate |

### Build Output

```
dist/index.html                  0.79 kB │ gzip:  0.47 kB
dist/assets/index-DiBhzLPS.js  238.49 kB │ gzip: 63.17 kB
✓ built in ~20s
```

---

## 6. AI/ML Feature Store

The platform includes a **Feast-based feature store** for ML model serving.

```
ai-ml/feature-store/
├── feature_store.yaml          # Project: enterprise_dms_features
│                               # Provider: local
│                               # Online store: Redis (localhost:6379)
└── definitions/
    └── entities.py             # Feature entities:
                                #   - outlet (join key: outlet_id)
                                #   - agent  (join key: agent_id)
```

| Entity | Join Key | Description | Used By |
|---|---|---|---|
| `outlet` | `outlet_id` | Retail outlet features (visit frequency, order history, revenue tier) | recommendation-service, forecasting-service |
| `agent` | `agent_id` | Sales agent features (conversion rate, beat adherence, avg order value) | forecasting-service |

The feature store feeds into the **ai-gateway-service** for real-time inference enrichment.

---

## 7. Shared Packages — Function-Level Detail

### 7.1 pkg-database

| File | Exports | Purpose |
|---|---|---|
| `connection/pool.ts` | `createPool()`, `Pool` | PG connection pool with health checks and configurable min/max |
| `connection/config.ts` | `DatabaseConfig` | Typed config from env vars with validation |
| `queries/query_builder.ts` | `QueryBuilder` | Fluent parameterized query builder — **prevents SQL injection** |
| `queries/pagination.ts` | `PaginationOptions`, `paginate()` | Cursor-based and offset pagination with configurable page size |
| `migrations/migration_runner.ts` | `MigrationRunner` | Runs versioned migrations in sequence, tracks in `schema_migrations` |
| `rls/tenant_context.ts` | `setTenantContext(pool, tenantId)` | Executes `SET app.current_tenant = $1` per session before queries |
| `rls/policy_builder.ts` | `PolicyBuilder` | Fluent API: `PolicyBuilder.table('orders').using('tenant_id = app.current_tenant')` |
| `unit-of-work/uow.ts` | `UnitOfWork` | Transaction wrapper: `uow.begin()` → operations → `uow.commit()` / `uow.rollback()` |

### 7.2 pkg-events

| File | Exports | Purpose |
|---|---|---|
| `outbox/outbox.repository.ts` | `OutboxRepository.save(event)` | Persist events within business TX (same DB transaction) |
| `outbox/dispatcher.ts` | `OutboxDispatcher.poll()`, `.dispatch()` | Poll outbox → publish to RabbitMQ → mark as dispatched |
| `broker/rabbitmq.ts` | `RabbitMQBroker.publish()`, `.subscribe()` | AMQP connection management with auto-reconnect |
| `consumers/idempotent_consumer.ts` | `IdempotentConsumer.process(event)` | Checks `processed_events` table → skip if already processed |
| `codecs/json.ts` | `JsonCodec.encode()`, `.decode()` | JSON serialization/deserialization |
| `codecs/avro.ts` | `AvroCodec.encode()`, `.decode()` | High-density Avro binary codec for large payloads |
| `codecs/protobuf.ts` | `ProtobufCodec.encode()`, `.decode()` | Positional Protobuf codec for gRPC payloads |
| `envelope/envelope.ts` | `EventEnvelope` | Wrapper: `{ event_id, correlation_id, timestamp, type, version, payload }` |
| `schemas/order/*.ts` | `OrderPlacedV1`, `OrderPlacedV2`, `OrderCancelledV1` | Typed event payload definitions |
| `schemas/visit/*.ts` | `VisitCompletedV1` | Visit completion event |
| `schemas/delivery/*.ts` | `DeliveryCompletedV1` | Delivery confirmation event |

### 7.3 pkg-validation

| File | Exports | Purpose |
|---|---|---|
| `schemas/order.schema.ts` | `CreateOrderSchema`, `UpdateOrderSchema` | Order payload validation with line item checks |
| `schemas/auth.schema.ts` | `LoginSchema`, `RegisterSchema`, `RefreshTokenSchema` | Auth request validation (email format, password strength) |
| `schemas/attendance.schema.ts` | `CreateAttendanceSchema` | Check-in/out validation with GPS coords |
| `schemas/beat_route.schema.ts` | `CreateBeatRouteSchema` | Beat route with outlet list validation |
| `schemas/geo_checkin.schema.ts` | `CreateGeoCheckinSchema` | Lat/lng bounds (-90/90, -180/180), accuracy > 0 |
| `schemas/journey_plan.schema.ts` | `CreateJourneyPlanSchema` | Journey plan with date and outlet list |
| `schemas/outlet_census.schema.ts` | `CreateOutletCensusSchema` | Census survey data validation |
| `schemas/outlet_profile.schema.ts` | `CreateOutletProfileSchema` | Profile with classification enum |
| `schemas/order_approval.schema.ts` | `CreateOrderApprovalSchema` | Approval level, threshold validation |
| `schemas/visit.schema.ts` | `CreateVisitSchema` | Visit with start/end time validation |
| `schemas/common.schema.ts` | `UuidSchema`, `PaginationSchema`, `TenantIdSchema` | Reusable validators |
| `rules/business.rules.ts` | `validateCreditLimit()`, `validateStockAvailability()` | Cross-entity business rules |
| `rules/order.rules.ts` | `validateOrderLines()`, `validateMinOrderValue()` | Order-specific rules |
| `errors.ts` | `ValidationError` | Structured error with field-level detail |

### 7.4 pkg-rbac

| Export | Purpose |
|---|---|
| `RbacEngine` | Permission evaluation engine with wildcard matching |
| `hasPermission(user, resource, action)` | Returns boolean — cosmetic check for UI |
| `requirePermission(user, resource, action)` | Throws `ForbiddenError` if denied — used in controllers |
| `Permission` type | `{ resource: string, action: string }` |
| `Role` type | `{ name: string, permissions: Permission[] }` |
| `PERMISSIONS` constant | Map of all platform permissions (orders:create, inventory:write, etc.) |

### 7.5 pkg-logger

| File | Export | Purpose |
|---|---|---|
| `logger.ts` | `Logger`, `createLogger(service)` | JSON logger: `{ level, timestamp, service, message, data }` |
| `formatters/json.ts` | `JsonFormatter` | Formats with service_name, function_name, correlation_id |
| `correlation/context.ts` | `CorrelationContext`, `withCorrelationId(fn)` | AsyncLocalStorage for automatic trace propagation across async calls |
| `redaction/redactor.ts` | `Redactor`, `redactPII(data)` | Masks: passwords → `***`, tokens → `tok_***`, credit cards → `****-****-****-1234` |

### 7.6 pkg-crypto

| Export | Purpose |
|---|---|
| `encrypt(plaintext, key)` | AES-256-GCM symmetric encryption with random IV |
| `decrypt(ciphertext, key)` | AES-256-GCM decryption with authentication tag verification |
| `hash(password)` | bcrypt hash with configurable salt rounds (default: 12) |
| `verifyHash(password, hash)` | Constant-time bcrypt comparison (prevents timing attacks) |
| `generateKeyPair()` | RSA 2048-bit key pair generation |
| `signJWT(payload, privateKey)` | RS256 JWT signing |
| `verifyJWT(token, publicKey)` | RS256 JWT verification + claims extraction |

### 7.7 Other Packages

| Package | Key Exports | Purpose |
|---|---|---|
| **pkg-http** | `ResilientHttpClient`, `CircuitBreaker` | HTTP client with exponential backoff (base: 1s, max: 30s), circuit breaker (threshold: 5 failures, reset: 60s), configurable timeouts |
| **pkg-config** | `loadConfig()`, `ConfigSchema` | Loads from `.env` → environment → HashiCorp Vault (cascading priority) |
| **pkg-config-client** | `ConfigClient.getFlag()`, `.getBool()` | Remote feature flag client with local cache (TTL: 60s) |
| **pkg-testing** | `UserBuilder`, `OrderBuilder`, `MockRepository` | Fluent test fixture builders: `UserBuilder.withEmail('test@test.com').withRole('admin').build()` |
| **pkg-analytics** | `AnalyticsTracker.track(event)` | Batch event submission to analytics pipeline |
| **pkg-integrations** | `SapBapiAdapter`, `IndiaNicGstAdapter` | ERP: SAP BAPI master data sync. Tax: India NIC GST e-invoicing |
| **pkg-mobile-sync** | `SyncProtocol`, `ConflictResolver` | Bi-directional sync with vector clocks, last-writer-wins conflict resolution |
| **pkg-ui-shared** | `DesignTokens`, shared hooks | Design system tokens (colors, spacing, typography) + shared React hooks |

---

## 8. SQL Migrations — Execution Sequence & Purpose

Migrations are organized by **database schema** (one logical DB per bounded context). Each runs in order within its schema.

### 8.1 System Schema (Foundation — Run First)

| # | Migration | Tables | Purpose |
|---|---|---|---|
| 1 | `V001__create_system_tables.sql` | `system_config`, `system_health` | Core system metadata and health-check tables |
| 2 | `V002__create_migration_tracking.sql` | `schema_migrations` | Tracks which migrations have run (prevents re-execution) |
| 3 | `V003__create_identity_tables.sql` | `system_users`, `system_tenants` | Base identity tables at system level (bootstrap) |
| 4 | `V004__add_outbox_backoff.sql` | ALTER `outbox_events` | Adds `retry_count`, `next_retry_at` for exponential backoff on failed dispatches |

### 8.2 Identity Schema (IAM — Run Second)

| # | Migration | Tables | Purpose |
|---|---|---|---|
| 1 | `V1__init.sql` | `users`, `roles`, `permissions`, `user_roles`, `tenants`, `refresh_tokens`, `mfa_devices` | Full IAM schema: users with bcrypt hash, roles with permissions, multi-tenant support, refresh token rotation, MFA device enrollment |
| 2 | `V2__identity_outbox_and_deduplication.sql` | `identity_outbox_events`, `identity_processed_events` | Event infrastructure: outbox for reliable publishing, processed_events for idempotent consumption |

### 8.3 SFA Schema (22 migrations — Field Operations)

| # | Migration | Tables / Changes | Purpose |
|---|---|---|---|
| 1 | `V001__create_orders.sql` | `orders`, `order_lines` | Order management with FK to products, CHECK on qty > 0 |
| 2 | `V002__create_visits.sql` | `visits` | Visit tracking with tenant_id, agent_id, timestamps |
| 3 | `V003__create_agents.sql` | `agents` | Sales agent profiles with territory, manager FK |
| 4 | `V004__create_journey_plans.sql` | `journey_plans`, `journey_plan_outlets` | Journey planning with M:N outlet assignment |
| 5 | `V005__create_sfa_outbox.sql` | `sfa_outbox_events` | Transactional outbox for SFA domain events |
| 6 | `V006__create_sfa_processed_events.sql` | `sfa_processed_events` | Idempotent consumer deduplication table |
| 7 | `V007__create_beat_routes.sql` | `beat_routes`, `beat_route_outlets` | Weekly beat route schedules with outlet assignments |
| 8 | `V008__create_attendance.sql` | `attendance` | Check-in/out with GPS coordinates and timestamps |
| 9 | `V009__create_geo_checkins.sql` | `geo_checkins` | GPS check-ins: lat, lng, accuracy, device_id |
| 10 | `V010__create_outlet_census.sql` | `outlet_censuses` | Outlet audit data capture (structured survey) |
| 11 | `V011__create_van_sales.sql` | `van_sales`, `van_sale_lines` | Van-to-outlet direct sales with line items |
| 12 | `V012__create_order_approvals.sql` | `order_approvals` | Multi-level approval: level, status, approver_id |
| 13 | `V013__create_merchandising_audits.sql` | `merchandising_audits` | In-store compliance audits |
| 14 | `V014__create_sfa_metrics.sql` | `sfa_metrics` | Performance metrics for dashboards (KPIs) |
| 15 | `V015__create_sfa_audits.sql` | `sfa_audit_log` | SFA-specific audit trail |
| 16 | `V016__rls_order_approvals.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `order_approvals` |
| 17 | `V017__rls_beat_routes.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `beat_routes` |
| 18 | `V018__rls_visits.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `visits` |
| 19 | `V019__rls_attendance.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `attendance` |
| 20 | `V020__rls_geo_checkins.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `geo_checkins` |
| 21 | `V021__rls_outlet_census.sql` | RLS policy | `ENABLE ROW LEVEL SECURITY` on `outlet_censuses` |
| 22 | `V022__create_outlet_profiles.sql` | `outlet_profiles` | Outlet profiles with classification (A/B/C/D) |

### 8.4 DMS Schema (13 migrations — Distributor Operations)

| # | Migration | Tables / Changes | Purpose |
|---|---|---|---|
| 1 | `V001__create_dms_tables.sql` | `products`, `outlets`, `inventory`, `distributors` | Core DMS: product catalog, outlet master, inventory per location |
| 2 | `V002__dms_outbox_and_deduplication.sql` | `dms_outbox_events`, `dms_processed_events` | Event infrastructure for DMS domain |
| 3 | `V003__create_distributor_hierarchy.sql` | `distributor_hierarchy` | Org tree: parent_id, level (company→region→area→distributor) |
| 4 | `V004__create_kyc_documents.sql` | `kyc_documents` | KYC: doc_type (PAN/GST/FSSAI), verification_status |
| 5 | `V005__create_credit_limits.sql` | `credit_limits` | Credit: limit_amount, utilized_amount, available (computed) |
| 6 | `V006__create_stock_ledger.sql` | `stock_ledger_entries` | Immutable append-only stock movement journal |
| 7 | `V007__create_stock_transfers.sql` | `stock_transfers` | Inter-warehouse: from_warehouse, to_warehouse, status |
| 8 | `V008__create_product_categories.sql` | `product_categories` | Category hierarchy with parent_id (self-referencing FK) |
| 9 | `V009__create_batches.sql` | `batches` | Batch/lot: mfg_date, expiry_date, batch_number |
| 10 | `V010__create_invoices.sql` | `invoices`, `invoice_lines` | Tax invoices with HSN codes and GST breakup |
| 11 | `V011__create_price_lists.sql` | `price_lists`, `price_list_entries` | Price list management with per-product pricing |
| 12 | `V012__distributor_lifecycle_rls_and_workflows.sql` | RLS + status workflows | RLS on distributor tables; status state machine |
| 13 | `V013__inventory_rls_and_concurrency.sql` | RLS + version column | RLS on inventory; `version` column for optimistic locking |

### 8.5 Other Schemas

| Schema | # | Migration | Purpose |
|---|---|---|---|
| **claims** | 1 | `V001__create_claims.sql` | Claims table with state machine columns, evidence references, amounts |
| **schemes** | 1 | `V001__create_schemes.sql` | Scheme definitions, eligibility rules, benefit structures |
| | 2 | `V002__schemes_outbox_and_deduplication.sql` | Event infrastructure for scheme domain events |
| **pricing** | 1 | `V001__create_pricing_tables.sql` | Price lists, entries, assignments, tax rules |
| **finance** | 1 | `V001__create_ledger_tables.sql` | Ledger accounts, entries, postings, periods |

### Migration Execution Order & Dependencies

```
1. system/V001 → V002 → V003 → V004         (foundation — must run first)
     ↓
2. identity/V1 → V2                           (IAM — needed by all services for RLS context)
     ↓
3. dms/V001 → V002 → ... → V013              (master data: products, outlets, inventory)
     ↓
4. sfa/V001 → V002 → ... → V022              (field ops — references dms products/outlets via FK)
     ↓
5. schemes/V001 → V002                        (schemes — references products from dms)
     ↓
6. claims/V001                                (claims — references orders from sfa)
     ↓
7. pricing/V001                               (pricing — references products from dms)
     ↓
8. finance/V001                               (ledger — standalone, last consumer of events)
```

> **Why this order?** System tables are the foundation. Identity is needed by every service for RLS context (`SET app.current_tenant`). DMS creates product/outlet master data that SFA references via foreign keys. Schemes depend on product data. Claims depend on orders. Pricing is standalone. Finance is the last consumer.

---

## 9. Event & Contract Registry

### Domain Events (19 event types)

| Event | Schema Path | Producer | Consumers | Payload Summary |
|---|---|---|---|---|
| `order.placed.v1` | `events/order/` | sfa-service | dms-core, schemes, finance | order_id, lines[], total, distributor_id |
| `order.placed.v2` | `events/order/` | sfa-service | same + extended | + channel, geo_zone, applied_schemes[] |
| `order.cancelled.v1` | `events/order/` | sfa-service | dms-core, finance | order_id, reason, cancelled_by |
| `visit.completed.v1` | `events/visit/` | sfa-service | report-service | visit_id, duration_mins, notes, outlet_id |
| `delivery.scheduled.v1` | `events/delivery/` | sfa-service | notification | delivery_id, eta, outlet_contact |
| `delivery.completed.v1` | `events/delivery/` | sfa-service | dms-core | delivery_id, photo_url, signature |
| `claim.settled.v1` | `events/claim/` | claims-service | finance | claim_id, amount, settlement_method |
| `settlement.posted.v1` | `events/settlement/` | claims-service | finance | settlement_id, ledger_entry_id |
| `inventory.adjusted.v1` | `events/inventory/` | dms-core | report-service | product_id, qty_delta, reason |
| `user.created.v1` | `events/user/` | identity-service | notification | user_id, email, tenant_id |
| `role.assigned.v1` | `events/user/` | identity-service | audit-service | user_id, role_id, assigned_by |
| `audit.recorded.v1` | `events/audit/` | audit-service | — (terminal) | block_id, action, hash, prev_hash |
| `notification.sent.v1` | `events/notification/` | notification-service | audit-service | channel, recipient, template |
| `file.uploaded.v1` | `events/file/` | file-service | audit-service | file_id, mime_type, size_bytes |
| `inference.completed.v1` | `events/inference/` | ai-gateway | report-service | model_id, latency_ms, token_count |
| `flag.changed.v1` | `events/config/` | config-service | all services | flag_name, new_value, changed_by |
| `tenant.config.updated.v1` | `events/config/` | config-service | all services | tenant_id, config_key, new_value |
| `sync.completed.v1` | `events/sync/` | sync-service | audit-service | device_id, records_synced |
| `conflict.detected.v1` | `events/sync/` | sync-service | notification | entity_type, conflicting_ids |

### API Contracts

- **11 OpenAPI 3.1 specs** in `contracts/openapi/` — one per service
- **2 gRPC Protos** — `sync.proto` (mobile streaming), `token.proto` (internal auth)
- **2 GraphQL schemas** — `sfa.graphql` (mobile queries), `reporting.graphql` (dashboards)

---

## 10. API Endpoint Summary

| Service | Base Path | Key Endpoints | Auth |
|---|---|---|---|
| **api-gateway** | `/api/v1/` | `POST /health`, `POST /proxy/*` | API key or JWT |
| **identity** | `/api/v1/auth/` | `POST /login`, `POST /register`, `POST /refresh`, `POST /logout` | Public (login), JWT (others) |
| **identity** | `/api/v1/users/` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | JWT + `users:manage` |
| **identity** | `/api/v1/roles/` | CRUD | JWT + `roles:manage` |
| **identity** | `/api/v1/tenants/` | CRUD | JWT + `tenants:manage` |
| **sfa** | `/api/v1/orders/` | `POST /`, `GET /:id`, `PUT /:id/process`, `PUT /:id/cancel` | JWT + `orders:*` |
| **sfa** | `/api/v1/visits/` | CRUD | JWT + `visits:*` |
| **sfa** | `/api/v1/attendance/` | CRUD | JWT + `attendance:*` |
| **sfa** | `/api/v1/beat-routes/` | CRUD | JWT + `beat-routes:*` |
| **sfa** | `/api/v1/journey-plans/` | CRUD | JWT + `journey-plans:*` |
| **sfa** | `/api/v1/geo-checkins/` | CRUD | JWT + `geo-checkins:*` |
| **dms** | `/api/v1/products/` | CRUD | JWT + `products:*` |
| **dms** | `/api/v1/inventory/` | `GET /`, `POST /adjust`, `POST /reserve`, `POST /release` | JWT + `inventory:*` |
| **dms** | `/api/v1/outlets/` | CRUD | JWT + `outlets:*` |
| **claims** | `/api/v1/claims/` | `POST /`, `GET /:id`, `PUT /:id/approve`, `PUT /:id/reject`, `PUT /:id/settle` | JWT + `claims:*` |
| **schemes** | `/api/v1/schemes/` | CRUD + `POST /evaluate` | JWT + `schemes:*` |
| **pricing** | `/api/v1/price-lists/` | CRUD + `POST /calculate` | JWT + `pricing:*` |

---

## 11. Error Response Standards

All API error responses follow a standardized JSON envelope:

```json
{
  "timestamp": "2026-07-24T00:00:00.000Z",
  "status_code": 422,
  "error_code": "VALIDATION_ERROR",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Order validation failed",
  "details": [
    { "field": "lines[0].quantity", "message": "Must be greater than 0" },
    { "field": "distributor_id", "message": "Required" }
  ]
}
```

| HTTP Status | Error Code | When Used |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON, invalid content-type |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Valid JWT but insufficient permissions |
| 404 | `NOT_FOUND` | Resource does not exist (clean — no existence leak) |
| 409 | `CONFLICT` | Optimistic lock version mismatch |
| 422 | `VALIDATION_ERROR` | Business rule or schema validation failure |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error (stack trace never exposed) |

---

## 12. Testing Strategy

### Triple-Layer Testing

| Layer | Tool | What It Tests | Example |
|---|---|---|---|
| **Unit Tests** | Vitest | Domain entities, aggregates, value objects, business rules | Order aggregate state machine transitions |
| **Integration Tests** | Vitest + test DB | Repository SQL correctness, FK/unique violations, RLS isolation | Tenant A cannot read tenant B's orders |
| **API Tests** | Vitest + supertest | Controller endpoints, auth, validation, error envelopes | POST /orders with missing fields → 422 |

### Test Coverage Areas

| Area | Tests Cover |
|---|---|
| State machines | Every valid and invalid transition (e.g., can't approve a REJECTED claim) |
| Optimistic locking | Concurrent update → version conflict → 409 response |
| RLS isolation | Tenant A query with tenant B's ID → empty result (no error leak) |
| Input validation | Null payloads, oversized strings, invalid UUIDs, negative amounts |
| Business rules | Credit limit exceeded, stock unavailable, expired scheme |
| Event publishing | Outbox entry created within transaction, dispatcher publishes correctly |

### Running Tests

```bash
# Run all tests across workspace
pnpm test

# Run tests for a specific service
cd services/sfa-service && pnpm test

# Run tests for a specific package
cd packages/pkg-events && pnpm test

# Run with coverage
pnpm test -- --coverage
```

---

## 13. Quick Start — Local Development

### Prerequisites

| Tool | Version | Installation |
|---|---|---|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org/) or `nvm install 18` |
| pnpm | 8.15 | `npm install -g pnpm@8` |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Git | Latest | [git-scm.com](https://git-scm.com/) |

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/JyotirmoyBhowmik/DMS.git
cd DMS

# 2. Copy environment config
cp .env.example .env

# 3. Start infrastructure (Postgres, PG Replica, RabbitMQ, Redis)
docker-compose up -d

# 4. Start extended infrastructure (Vault, MinIO)
docker-compose -f infrastructure/docker-compose.yml up -d

# 5. Install dependencies
pnpm install

# 6. Build all packages and services (topological order via Turborepo)
pnpm build

# 7. Run all tests
pnpm test

# 8. Start individual services (in separate terminals)
cd services/api-gateway && pnpm dev       # Port 3000
cd services/identity-service && pnpm dev  # Port 3001
cd services/sfa-service && pnpm dev       # Port 3002
cd services/dms-core-service && pnpm dev  # Port 3003
# ... repeat for other services

# 9. Start web admin
cd apps/web-admin && pnpm dev             # Port 5173
```

### Environment Variables (Full Reference)

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
| `RABBITMQ_VHOST` | (empty) | RabbitMQ virtual host |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (empty) | Redis password |
| `VAULT_ADDR` | `http://127.0.0.1:8200` | HashiCorp Vault address |
| `VAULT_TOKEN` | (empty) | Vault authentication token |
| `VAULT_MOUNT_PATH` | `secret` | Vault secret mount path |
| `CONFIG_SERVICE_URL` | `http://localhost:3000` | Config service URL |
| `AI_SERVICE_URL` | `http://localhost:8000` | AI service URL |
| `GATEWAY_URL` | `http://localhost:3000` | Gateway URL |
| `JWT_ISSUER` | `dms-identity-service` | JWT issuer claim |
| `JWT_AUDIENCE` | `dms-enterprise` | JWT audience claim |
| `LOCKOUT_THRESHOLD` | `5` | Failed login attempts before lockout |
| `LOCKOUT_DURATION_MINUTES` | `15` | Lockout duration |
| `RATE_LIMIT_MAX_REQUESTS` | `10` | Max requests per rate limit window |
| `LOG_LEVEL` | `DEBUG` | Logging level (DEBUG/INFO/WARN/ERROR) |
| `SEED_MOCK_DATA` | `true` | Seed development data on startup |
| `SEED_TENANT_ID` | `tenant-uuid-1111` | Default tenant for dev seeds |
| `SEED_AGENT_ID` | `agent-uuid-2222` | Default agent for dev seeds |
| `SEED_OUTLET_LAT` | `28.6139` | Default outlet latitude (New Delhi) |
| `SEED_OUTLET_LNG` | `77.2090` | Default outlet longitude (New Delhi) |

---

## 14. Free Deployment Guide — Online & Server

### 14.1 Free Cloud Deployment (Zero Cost)

| Component | Free Service | Free Tier Limits |
|---|---|---|
| **PostgreSQL** | [Supabase](https://supabase.com/) | 500 MB storage, 2 compute units |
| **PostgreSQL (alt)** | [Neon](https://neon.tech/) | 500 MB, auto-scaling |
| **Application Hosting** | [Railway](https://railway.app/) | $5/mo free credit |
| **Application Hosting (alt)** | [Render](https://render.com/) | Free tier (spins down on idle) |
| **Application Hosting (alt)** | [Fly.io](https://fly.io/) | 3 shared-cpu VMs free |
| **RabbitMQ** | [CloudAMQP](https://www.cloudamqp.com/) | Little Lemur: 1M msgs/month |
| **Redis** | [Upstash](https://upstash.com/) | 10K commands/day free |
| **Frontend** | [Vercel](https://vercel.com/) | Unlimited for personal projects |
| **Container Registry** | [GitHub GHCR](https://ghcr.io/) | Free for public repos |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) | 2,000 min/month free |
| **Secrets** | [Doppler](https://www.doppler.com/) | Free for 5 users |
| **Monitoring** | [Grafana Cloud](https://grafana.com/products/cloud/) | 10K metrics, 50 GB logs |

### Step-by-Step Free Deployment

```bash
# 1. Set up Neon PostgreSQL → get connection string
# 2. Set up CloudAMQP Little Lemur → get AMQP URL
# 3. Set up Upstash Redis → get connection string

# 4. Deploy to Railway
npm install -g @railway/cli
railway login
railway init
railway up --service api-gateway
railway up --service identity-service
railway up --service sfa-service

# 5. Set env vars in Railway dashboard (copy from .env.example)

# 6. Deploy web-admin to Vercel
cd apps/web-admin
npx vercel --prod
```

### 14.2 Self-Hosted Docker Deployment

```bash
# On your VPS / on-premise server:
git clone https://github.com/JyotirmoyBhowmik/DMS.git && cd DMS
cp .env.example .env  # Edit with production values

# Start everything
docker-compose -f docker-compose.yml -f infrastructure/docker-compose.yml up -d

# Verify
curl http://localhost:3000/health
```

### 14.3 Kubernetes Deployment

```bash
kubectl apply -f k8s/base/namespace.yaml          # Create dms-prod namespace
kubectl apply -f k8s/base/network-policy.yaml      # Restrict pod traffic
kubectl apply -f k8s/base/postgres-deployment.yaml # StatefulSet PG
kubectl apply -f k8s/base/postgres-service.yaml    # Headless PG service
kubectl apply -f k8s/base/api-gateway-deployment.yaml
kubectl apply -f k8s/base/api-gateway-service.yaml
kubectl apply -f infrastructure/k8s/               # Remaining services
kubectl get pods -n dms-prod                        # Verify
```

### Service Startup Order

```
1. Infrastructure:  PostgreSQL → RabbitMQ → Redis → Vault → MinIO
2. Foundation:      identity-service → config-service
3. Core:            dms-core-service, sfa-service (parallel)
4. Domain:          claims, schemes, pricing, finance (parallel)
5. Support:         audit, notification, file, report, AI, sync (parallel)
6. Frontend:        web-admin (Vercel/Nginx)
```

---

## 15. Infrastructure Deep Dive

### 15.1 Docker Compose (Development)

**`docker-compose.yml`** — Core dev services:

| Service | Image | Ports | Purpose |
|---|---|---|---|
| `postgres` | `postgres:15-alpine` | 5432 | Primary database |
| `postgres-replica` | `postgres:15-alpine` | 5433 | Read replica |
| `rabbitmq` | `rabbitmq:3-management-alpine` | 5672, 15672 | Message broker + management UI |
| `redis` | `redis:7-alpine` | 6379 | Session cache, rate limits |

**`infrastructure/docker-compose.yml`** — Extended services:

| Service | Image | Ports | Purpose |
|---|---|---|---|
| `postgres` | `postgres:15-alpine` | 5432 | Named container `dms-postgres` |
| `redis` | `redis:7-alpine` | 6379 | Named container `dms-redis` |
| `vault` | `hashicorp/vault:1.15` | 8200 | Secret management (dev mode) |
| `minio` | `minio/minio:latest` | 9000, 9001 | S3-compatible object storage |

### 15.2 PgBouncer Configuration

Connection pooler (`infrastructure/pgbouncer.ini`):

| Setting | Value | Purpose |
|---|---|---|
| `pool_mode` | `transaction` | Connections returned after each TX (required for RLS SET) |
| `max_client_conn` | `2000` | Maximum client connections |
| `default_pool_size` | `20` | Connections per user/database pair |
| `max_db_connections` | `100` | Maximum actual PG connections |
| `query_timeout` | `30s` | Kill queries exceeding 30 seconds |
| `client_idle_timeout` | `60s` | Disconnect idle clients |
| `connection_lifetime` | `600s` | Recycle connections every 10 minutes |

**Per-Role Limits:**

| Role | Max Connections | Use Case |
|---|---|---|
| `dms_admin` | 50 | Heavy analytics queries |
| `dms_agent` | 20 | Field agent API calls |
| `dms_distributor` | 20 | Distributor portal |
| `dms_auditor` | 10 | Read-only audit queries |

### 15.3 Kubernetes Network Policy

The `k8s/base/network-policy.yaml` restricts which pods can access PostgreSQL:

```
Allowed → PostgreSQL (port 5432):
  ✅ api-gateway
  ✅ sfa-service
  ✅ dms-core-service
  ✅ integration-service
  ✅ ai-service
  ❌ All other pods (denied by default)
```

---

## 16. Scaling, Load & Compute Requirements

### 16.1 Compute by Scale

| Scale | Users | TPS | PostgreSQL | RabbitMQ | Redis | App Servers | Total RAM | Total vCPU |
|---|---|---|---|---|---|---|---|---|
| **Startup** | 1–50 | 5–20 | 1 vCPU, 2 GB | CloudAMQP free | Upstash free | 1× all-in-one | **4 GB** | **2** |
| **Small** | 50–500 | 20–100 | 2 vCPU, 4 GB | 1 vCPU, 1 GB | 512 MB | 2× gw, 1× each | **16 GB** | **8** |
| **Medium** | 500–5K | 100–500 | 4 vCPU, 16 GB + replica | 2 vCPU, 4 GB (HA) | 2 GB cluster | 3× gw, 2× core | **64 GB** | **24** |
| **Large** | 5K–50K | 500–2K | 8 vCPU, 32 GB + 2 replicas + PgBouncer | 4 vCPU, 8 GB (HA) | 8 GB sentinel | 5× gw, 3× each, HPA | **256 GB** | **64** |
| **Enterprise** | 50K+ | 2K+ | Managed (RDS Multi-AZ) | Managed (Amazon MQ) | Managed (ElastiCache) | K8s auto-scaling | **512+ GB** | **128+** |

### 16.2 Per-Service K8s Resources

| Service | CPU Req | CPU Limit | Mem Req | Mem Limit | Replicas (Medium) |
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

### 16.3 Database Scaling Strategy

```
                    ┌────────────────┐
                    │   PgBouncer    │  ← 2000 clients → 100 PG connections
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
    ┌──────────────┐ ┌───────────┐ ┌───────────┐
    │   Primary    │ │ Replica 1 │ │ Replica 2 │
    │   (Writes)   │ │ (Reads)   │ │ (Reads)   │
    └──────────────┘ └───────────┘ └───────────┘
```

### 16.4 Load Impact Analysis

| Operation | Latency | DB Queries | Events | Bottleneck |
|---|---|---|---|---|
| Place Order | < 200ms | 5 | `order.placed.v1` | TX size |
| Login + JWT | < 100ms | 2 | — | bcrypt hash |
| Geo Check-in | < 150ms | 2 | — | GPS validation |
| Price Calculate | < 50ms | 3 | — | Rule evaluation |
| List Orders | < 300ms | 1 | — | Index quality |
| Scheme Evaluate | < 500ms | 4 | `scheme.matched` | Active scheme count |

### 16.5 Free Tier Capacity

| Metric | Limit | Estimated Capacity |
|---|---|---|
| Concurrent Users | — | ~10–30 |
| Daily Orders | — | ~200–500 |
| Monthly Events | 1M (CloudAMQP) | ~30K events/day |
| DB Storage | 500 MB (Neon) | ~50K orders |
| Redis Commands | 10K/day (Upstash) | ~500 API calls/day with caching |

---

## 17. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
Trigger: push to main, pull requests to main

Steps:
  1. Checkout code (actions/checkout@v4)
  2. Install pnpm 8 (pnpm/action-setup@v3)
  3. Setup Node.js 20 (actions/setup-node@v4 with pnpm cache)
  4. Install dependencies (pnpm install)
  5. Build all packages (pnpm build → Turborepo topological)
  6. Run all tests (pnpm test)
  7. Generate SBOM (Software Bill of Materials via Syft/Trivy)
```

### Turborepo Pipeline

```json
{
  "build":     { "dependsOn": ["^build"],  "outputs": ["dist/**", "build/**", ".next/**"] },
  "test":      { "dependsOn": ["build"],   "outputs": [] },
  "lint":      {                           "outputs": [] },
  "typecheck": { "dependsOn": ["^build"],  "outputs": [] },
  "codegen":   {                           "outputs": ["src/api/generated/**"] }
}
```

- `^build` = build dependencies first (topological order)
- Turborepo caches unchanged packages → subsequent builds skip them

---

## 18. Monitoring & Observability

### Structured Logging (pkg-logger)

Every log entry is JSON with:
```json
{
  "level": "INFO",
  "timestamp": "2026-07-24T00:00:00.000Z",
  "service": "sfa-service",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "function": "PlaceOrderUseCase.execute",
  "message": "Order placed successfully",
  "data": { "order_id": "...", "total": 12450 }
}
```

### Distributed Tracing

- `correlation_id` propagated via HTTP header `X-Correlation-ID`
- `pkg-logger/correlation/context.ts` uses `AsyncLocalStorage` for automatic propagation
- Every outbox event carries the `correlation_id` from the original request

### Health Checks

Every service exposes:
- `GET /health` — liveness probe (process is alive)
- `GET /ready` — readiness probe (DB connected, RabbitMQ connected)

### Recommended Stack (Free)

| Tool | Purpose | Free Tier |
|---|---|---|
| [Grafana Cloud](https://grafana.com/products/cloud/) | Dashboards + alerting | 10K metrics, 50 GB logs |
| [Better Stack](https://betterstack.com/) | Log aggregation | 1 GB/month |
| [Sentry](https://sentry.io/) | Error tracking | 5K errors/month |

---

## 19. Database Backup & Disaster Recovery

### Automated Backup Script

`scripts/backup-db.sh`:
```bash
#!/bin/bash
set -e
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/tmp/backups/db_backup_${TIMESTAMP}.sql.gz"

# pg_dump with gzip compression
PGPASSWORD="password" pg_dump -h localhost -p 5432 -U user -d dms | gzip > "$BACKUP_FILE"

# Upload to S3 for point-in-time recovery
aws s3 cp "$BACKUP_FILE" "s3://dms-db-backups/prod/"
```

### Backup Strategy

| Type | Frequency | Retention | Tool |
|---|---|---|---|
| Full backup | Daily at 02:00 UTC | 30 days | `backup-db.sh` → S3 |
| WAL archiving | Continuous | 7 days | PG `archive_command` |
| Logical backup | Weekly | 90 days | `pg_dump --format=custom` |

---

## 20. Security & Compliance

| Security Layer | Implementation | Detail |
|---|---|---|
| **Authentication** | JWT (RS256) | Key rotation via `KeyManager`, JWKS endpoint |
| **Authorization** | RBAC | Hierarchical permissions with wildcard matching |
| **Multi-Factor Auth** | TOTP | `MfaDevice` entity, enrollment/verification flow |
| **Tenant Isolation** | PostgreSQL RLS | Every table: `WHERE tenant_id = current_setting('app.current_tenant')` |
| **SQL Injection** | Parameterized queries | Zero string concatenation in any repository |
| **XSS Prevention** | Zod input validation | All user input sanitized before processing |
| **Rate Limiting** | Redis sliding window | Per-IP + per-tenant, configurable threshold |
| **Account Lockout** | Configurable | 5 failed attempts → 15 min lockout |
| **PII Protection** | Log redaction | `pkg-logger/redactor` masks passwords, tokens, cards |
| **Secrets** | HashiCorp Vault | Dynamic secrets, transit encryption |
| **Encryption at Rest** | AES-256-GCM | `pkg-crypto` for sensitive field encryption |
| **Audit Trail** | Blockchain-style | Immutable blocks with previous hash → tamper detection |
| **CORS** | Configurable middleware | Allowed origins, methods, headers |
| **SBOM** | CI-generated | Software Bill of Materials for supply chain security |
| **Network Policy** | K8s NetworkPolicy | Pod-to-pod traffic restrictions (only gw/sfa/dms → PG) |
| **Vulnerability Reporting** | `SECURITY.md` | Report to `security@dms-platform.enterprise`, 24h acknowledgment |

---

## 21. Versioning Policy

From `CHANGELOG.md`:

- **Semantic Versioning** (SemVer 2.0.0) for all packages and services
- **Additive-Only Rule**: Stable message/event schemas MUST be additive-only. Removing fields requires a new version (e.g., `order.placed.v1` → `order.placed.v2`)
- **Independent Releases**: Packages versioned independently via Git tags: `@dms/pkg-crypto@v1.0.0`
- **Commit Convention**: Conventional Commits enforced by commitlint with **38 allowed scopes** (one per package/service/app)

### Allowed Commit Scopes

```
platform, pkg-crypto, pkg-events, pkg-http, pkg-rbac, pkg-logger,
pkg-validation, pkg-database, pkg-testing, pkg-ui-shared, pkg-config-client,
dms-core-service, sfa-service, sync-service, audit-service, identity-service,
notification-service, forecasting-service, recommendation-service, api-gateway,
ai-gateway-service, config-service, file-service, report-service, web-admin,
mobile-rn, mobile-flutter, infra, deps, release
```

---

## 22. Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

### Branch Naming

```
feature/<issue-id>-summary    # New features
bugfix/<issue-id>-summary     # Bug fixes
```

### Pull Request Requirements

1. ✅ CI green (typecheck + lint + test)
2. ✅ Peer review from at least one Code Owner
3. ✅ Changes scoped and self-contained

### Development Workflow

```bash
pnpm install          # Install dependencies
pnpm build            # Build everything (Turborepo)
pnpm test             # Run all test suites
pnpm lint             # Check code style (ESLint + Prettier)
pnpm typecheck        # TypeScript strict mode verification
pnpm codegen          # Generate API clients from OpenAPI specs
```

---

## 23. Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| `pnpm install` fails | Wrong Node version | Run `nvm use` (reads `.nvmrc`) |
| Build fails with type errors | Missing dependency build | Run `pnpm build` from root (Turborepo handles order) |
| DB connection refused | Docker not running | `docker-compose up -d` |
| RLS returns empty results | Missing tenant context | Ensure `SET app.current_tenant = ?` before queries |
| Optimistic lock conflict (409) | Concurrent update | Re-fetch entity, retry with new version |
| RabbitMQ connection timeout | Container not ready | Wait 10s after `docker-compose up`, check `localhost:15672` |
| JWT expired | Token TTL exceeded | Use `/refresh` endpoint with refresh token |
| Rate limit exceeded (429) | Too many requests | Wait for window reset, or increase `RATE_LIMIT_MAX_REQUESTS` |
| Outbox events not publishing | Dispatcher not running | Start the worker process: `cd services/sfa-service && pnpm worker` |
| MinIO connection error | Infrastructure compose not started | `docker-compose -f infrastructure/docker-compose.yml up -d` |

---

## 24. Glossary

| Term | Definition |
|---|---|
| **DMS** | Distributor Management System — manages distributor lifecycle, inventory, orders |
| **SFA** | Sales Force Automation — manages field agent operations (visits, routes, attendance) |
| **RLS** | Row-Level Security — PostgreSQL feature that filters rows by tenant_id automatically |
| **Outbox** | Transactional outbox pattern — write events to DB in same TX as business data |
| **Beat Route** | Weekly schedule assigning an agent to visit specific outlets on specific days |
| **Journey Plan** | Daily plan listing which outlets an agent must visit, in what order |
| **Geo Check-in** | GPS-validated proof that an agent physically visited an outlet |
| **KYC** | Know Your Customer — document verification (PAN, GST, FSSAI) |
| **HSN** | Harmonized System Nomenclature — product classification code for GST |
| **FMCG** | Fast-Moving Consumer Goods — products with high turnover (food, beverages, toiletries) |
| **Optimistic Locking** | Concurrency control using version column: `WHERE version = $expected` |
| **Aggregate** | DDD term — cluster of entities treated as a single unit for data changes |
| **Use Case** | Application layer class that orchestrates a single business operation |
| **Port** | Interface defined by the domain/application layer (e.g., repository interface) |
| **Adapter** | Infrastructure implementation of a port (e.g., PostgreSQL repository) |
| **Correlation ID** | Unique ID propagated across all services for distributed request tracing |
| **PgBouncer** | PostgreSQL connection pooler that multiplexes many clients onto few DB connections |

---

## 25. Changelog

### [1.0.0] - 2026-06-02

Initial release of the multi-tenant DMS & SFA monorepo.

**Added:**
- **8 shared packages**: pkg-crypto, pkg-events, pkg-http, pkg-rbac, pkg-validation, pkg-logger, pkg-database, pkg-testing
- **19 microservices**: Full DDD architecture with domain entities, aggregates, repositories, use cases, controllers
- **46 SQL migrations**: Across 7 schemas (system, identity, sfa, dms, schemes, claims, pricing, finance)
- **19 event types**: With versioned JSON Schema definitions
- **11 OpenAPI specs**: Complete REST API documentation
- **2 gRPC protos**: Mobile sync + internal token verification
- **2 GraphQL schemas**: SFA mobile + analytical reporting
- **CI/CD pipeline**: GitHub Actions with build, test, SBOM generation
- **Docker Compose**: Development environment with PG, RabbitMQ, Redis, Vault, MinIO
- **Kubernetes manifests**: Production deployment with network policies

---

## License

See [LICENSE](./LICENSE) for details.

---

> **Built with ❤️ using Domain-Driven Design, Event-Driven Architecture, and TypeScript.**
