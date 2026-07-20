# Enterprise DMS & SFA Platform

An enterprise-grade **Distributor Management System (DMS)** and **Sales Force Automation (SFA)** platform structured as a high-performance TypeScript monorepo using `pnpm` workspaces and `Turborepo`.

---

## 1. Directory & System Structure

```
dms-platform/
├── apps/
│   ├── web-admin/               # React Vite Admin Portal Dashboard
│   └── mobile-rn/               # React Native SFA Field Sales Mobile App
├── services/
│   ├── api-gateway/             # API Gateway Router (Tenant & RBAC check, Forwarder)
│   ├── sfa-service/             # SFA Domain Core Service (Visits, Orders, SalesTargets)
│   ├── identity-service/        # JWT Authentication, MFA, and Key Manager
│   ├── audit-service/           # Cryptographic Append-only Security Audit log
│   ├── forecasting-service/     # AI Sales Forecasting & Analysis
│   └── schemes-service/         # Schemes & Claims Verification
├── packages/
│   ├── pkg-database/            # Shared Postgres connection pool & transaction utilities
│   ├── pkg-events/              # Transactional Outbox pattern & event envelopes
│   ├── pkg-logger/              # Correlation-ID aware Winston logger
│   ├── pkg-rbac/                # Role-Based Access Control decorators & policies
│   └── pkg-validation/          # Centralized Zod validation schemas
├── contracts/
│   └── openapi/                 # API Contracts (e.g. sfa-service.yaml spec)
└── db/
    └── migrations/              # Database Schema Flyway-style migrations
```

---

## 2. Core SFA Service Modules

The platform enforces strict domain-driven design (DDD) boundaries across all core SFA service slices:

### 📊 SalesTarget
- Manages monthly sales volumes and values.
- Automatically completes active targets when sales thresholds are met via order placements.
- Optimistic locking and strict validation parameters constraints.

### 🎯 KPIAchievement
- Establishes performance indicators (completed visits, count of orders, financial volume sum).
- Handles workflow transitions (`DRAFT` -> `SUBMITTED` -> `APPROVED` / `REJECTED`).
- Subscribes to `visit.completed.v1` events via progressive projection.

### 👤 FieldRep (Field Representatives)
- Core database repository for field sales agents details.
- Validates properties uniqueness constraints (employee code, user reference link).
- Features Row-Level Security (RLS) tenant isolation policies and actor audit logs.

### 📸 PhotoCapture
- Enforces retail audits, geo-tagged image uploads, and image size constraints.

### 🔍 CompetitorCapture
- Audits and tracks competitor pricing, promotion offerings, and stock levels.

### 🛒 MerchandisingAudit
- Audits store layout compliance, shelf visibility, and brand placement correctness.

### 📝 Survey
- Enables retail surveys creation, updates, pagination search, and list detail views.
- Restricts actions using strict `survey:create`, `survey:read`, and `survey:update` RBAC permissions.
- Emits outbox events and records audits upon mutations with automatic database transaction fallbacks.

---

## 3. Technology Stack & Design System

1. **Frameworks & Core**: React (Vite-powered Single Page Application), Node.js (TypeScript compiled to ES modules).
2. **Database Engine**: PostgreSQL with Row Level Security (RLS) tenant partitioning.
3. **Event Broker**: Transactional Outbox and Event-driven consumer subscriptions.
4. **Security & Audits**: RS256 JWT validation, RbacGuard permissions, cryptographic signature verification, and tamper-evident append-only audits blocks.

---

## 4. Quick Start

### Prerequisites
- Node.js (v18+)
- pnpm (v8+)

### Setup Commands
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Build the workspace:
   ```bash
   pnpm build
   ```
3. Run tests:
   ```bash
   pnpm test
   ```
