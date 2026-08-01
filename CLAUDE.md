# Codebase Context & Interaction Rules — Enterprise DMS + SFA Monorepo

## Project Overview

- **Purpose**: Enterprise-grade Distribution Management System (DMS) and Sales Force Automation (SFA) platform. DMS manages distributors, stock flow, billing, secondary sales, credit limits, and pricing schemes. SFA manages field sales teams, beat planning, GPS-verified retailer visits, van sales, and on-ground order collection.
- **Production Web**: `https://dms.jyotirmoyb.com`
- **Production API**: `https://api.dms.jyotirmoyb.com`
- **Hosting**: Render (Singapore region), static frontend on Vercel/CDN.

## Core Tech Stack

| Layer              | Technology                                                             |
|--------------------|------------------------------------------------------------------------|
| **Monorepo**       | pnpm 8.15 workspaces + Turborepo                                      |
| **Language**       | TypeScript 5.x (strict mode, `ES2022` target)                         |
| **Frontend**       | React 18, Vite 5, react-router-dom 6 (HashRouter)                     |
| **Backend**        | Node.js ≥18, Express-based microservices                               |
| **Database**       | PostgreSQL (Row-Level Security per tenant), pg driver                  |
| **Mobile**         | React Native 0.85 (SFA), Flutter (DMS)                                |
| **State Mgmt**     | React Context (`DataContext.tsx`) — global reactive store              |
| **Design System**  | Centralized tokens (`src/theme/tokens.ts`) — no Tailwind              |
| **Build**          | `tsc --noEmit && vite build` (frontend), `turbo run build` (monorepo) |
| **Linting**        | ESLint 8 + @typescript-eslint, Prettier                               |
| **Commits**        | Commitlint (conventional commits), Husky pre-commit hooks             |

---

## Efficiency Rules (Token Management)

1. **NEVER** scan or read the entire repository unless explicitly asked to do structural refactoring.
2. If context is missing, **ask** for specific filenames or paths instead of guessing.
3. Keep context lean: only focus on the target file and its **immediate** imports.
4. When navigating the monorepo, always start from the specific workspace (`apps/web-admin`, a specific service, or a specific package). Do not walk the full tree.
5. Treat `node_modules/`, `dist/`, `.turbo/`, `pnpm-lock.yaml`, and `__pycache__/` as off-limits unless debugging a dependency issue.

---

## Output and Update Format

When a change is required, output the solution so it can be automatically applied:

- **ALWAYS** use the specific code-block file path convention:

```typescript filename="apps/web-admin/src/pages/sales/SalesOrders.tsx"
// Code goes here
```

- For modifications to existing files, use **precise search-and-replace blocks** rather than rewriting the entire file.
- For new files, output the **full file content** with the filename header.

---

## Workspace Topology

```
DMS/                              ← Monorepo Root
├── apps/
│   ├── web-admin/                ← PRIMARY: React + Vite admin SPA
│   │   └── src/
│   │       ├── App.tsx           ← Root component: HashRouter + Frame Switcher
│   │       ├── main.tsx          ← Entry: ErrorBoundary → DataProvider → App
│   │       ├── types/index.ts    ← ALL shared TypeScript interfaces & types
│   │       ├── theme/tokens.ts   ← Design system: colors, typography, presets
│   │       ├── data/seed.ts      ← Navigation items + dropdown constants
│   │       ├── context/
│   │       │   └── DataContext.tsx  ← Global reactive data store (ALL state)
│   │       ├── services/
│   │       │   └── dbService.ts    ← API client with timeout + AbortController
│   │       ├── components/         ← Reusable UI primitives
│   │       │   ├── Sidebar.tsx     ← Role-aware sidebar navigation
│   │       │   ├── Modal.tsx       ← Reusable modal shell
│   │       │   ├── FormField.tsx   ← Label + input wrapper
│   │       │   ├── StatusBadge.tsx ← Coloured status pill
│   │       │   ├── StatCard.tsx    ← KPI metric card
│   │       │   ├── DataTable.tsx   ← Sortable/filterable table
│   │       │   ├── FrameHeader.tsx ← Frame banner with live KPIs
│   │       │   ├── ErrorBoundary.tsx ← Global error catch
│   │       │   └── forms/          ← Modular form modals
│   │       │       ├── SkuCreateModal.tsx
│   │       │       ├── OrderCreateModal.tsx
│   │       │       ├── OutletCreateModal.tsx
│   │       │       └── UserCreateModal.tsx
│   │       ├── frames/             ← Multi-Frame Architecture containers
│   │       │   ├── ControlFrame.tsx    ← System admin: dashboard, users, tenants
│   │       │   ├── DmsFrame.tsx        ← Supply chain: SKUs, stock, outlets
│   │       │   ├── SfaFrame.tsx        ← Field ops: orders, beats, visits
│   │       │   ├── GovernanceFrame.tsx ← Finance: invoices, claims, audit
│   │       │   └── AnalyticsFrame.tsx  ← AI forecasting, reports
│   │       └── pages/              ← Domain page components
│   │           ├── landing/LandingPage.tsx
│   │           ├── admin/           ← UserManagement, TenantManagement, PlatformMatrix, etc.
│   │           ├── inventory/       ← SkuCatalog, StockLedger, OutletRegistry
│   │           ├── sales/           ← SalesOrders, BeatRoutes, FieldVisits, VanSales
│   │           ├── finance/         ← Invoices, TradeClaims, PricingSchemes
│   │           ├── analytics/       ← AiForecast, Reports
│   │           └── integration/     ← AuditLedger, SystemConfig, SyncQueue
│   ├── mobile-sfa/               ← React Native SFA mobile app
│   ├── mobile-flutter/           ← Flutter DMS mobile app
│   └── mobile-rn/                ← Legacy React Native app
├── services/                     ← 19 Node.js microservices
│   ├── api-gateway/              ← Express API gateway (port 10000)
│   ├── identity-service/         ← JWT auth, MFA, RBAC
│   ├── dms-core-service/         ← Distributor orders, stock, billing
│   ├── sfa-service/              ← Field sales, GPS visits, beat routes
│   ├── finance-service/          ← Invoices, credit, payments
│   ├── claims-service/           ← Trade claim submission & settlement
│   ├── pricing-service/          ← Scheme & price list management
│   ├── audit-service/            ← Blockchain-style audit ledger
│   ├── sync-service/             ← Offline-first mobile data sync
│   ├── config-service/           ← Feature flags, tenant config
│   ├── notification-service/     ← Push, SMS, email notifications
│   ├── file-service/             ← Document & image storage
│   ├── report-service/           ← Report generation & export
│   ├── integration-service/      ← ERP, SAP, Tally connectors
│   ├── forecasting-service/      ← ML demand forecasting
│   ├── recommendation-service/   ← AI product recommendations
│   ├── ai-service/               ← Core AI/ML pipeline
│   ├── ai-gateway-service/       ← AI model serving gateway
│   └── schemes-service/          ← Promotion scheme engine
├── packages/                     ← 14 shared internal packages (@dms/pkg-*)
│   ├── pkg-database/             ← Postgres connection pool, query builders
│   ├── pkg-logger/               ← Structured JSON logging
│   ├── pkg-validation/           ← Zod schemas, input sanitisation
│   ├── pkg-rbac/                 ← Role & permission enforcement
│   ├── pkg-crypto/               ← Token signing, hashing
│   ├── pkg-events/               ← Event bus, pub/sub
│   ├── pkg-http/                 ← HTTP client with retry, circuit breaker
│   ├── pkg-config-client/        ← Remote config fetcher
│   ├── pkg-ui-shared/            ← Shared React UI components
│   ├── pkg-analytics/            ← Analytics event tracking
│   ├── pkg-testing/              ← Test utilities, fixtures
│   ├── pkg-integrations/         ← Third-party integration adapters
│   ├── pkg-mobile-sync/          ← Mobile offline sync protocol
│   └── pkg-config/               ← Shared configuration schemas
├── db/
│   └── seeds/V001__full_database_seed.sql  ← PostgreSQL sample data
├── infrastructure/               ← Terraform / IaC
├── k8s/                          ← Kubernetes manifests
├── contracts/                    ← OpenAPI specs
├── docs/                         ← Architecture documentation
├── scripts/                      ← CI/CD & deployment scripts
├── ai-ml/                        ← Python ML training pipelines
├── turbo.json                    ← Turborepo pipeline config
├── pnpm-workspace.yaml           ← Workspace: apps/*, services/*, packages/*
├── tsconfig.base.json            ← Shared TS config with @dms/* path aliases
├── render.yaml                   ← Render.com deployment manifest
└── docker-compose.yml            ← Local dev containers
```

---

## Data Flow Architecture

```
┌─────────────────┐     HashRouter      ┌─────────────────┐
│   LandingPage   │ ──login/demo──────▶ │     App.tsx      │
│  (pre-auth)     │                     │  Frame Switcher  │
└─────────────────┘                     └────────┬─────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
              /control/*                   /dms/*  /sfa/*             /governance/*  /analytics/*
                    │                            │                            │
           ControlFrame.tsx             DmsFrame / SfaFrame          GovernanceFrame
                    │                            │                            │
           ┌───────┴───────┐           ┌────────┴────────┐          ┌────────┴────────┐
           │  Page Comps   │           │   Page Comps    │          │   Page Comps    │
           └───────┬───────┘           └────────┬────────┘          └────────┬────────┘
                   │                            │                            │
                   └────────────────────────────┼────────────────────────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │   DataContext.tsx      │
                                    │   (Global State)      │
                                    │                       │
                                    │  useData() hook       │
                                    │  Reactive mutations:  │
                                    │  addSku, addOutlet,   │
                                    │  approveSalesOrder,   │
                                    │  addInvoice, etc.     │
                                    └───────────┬───────────┘
                                                │
                                     ┌──────────▼──────────┐
                                     │   dbService.ts      │
                                     │   (API Client)      │
                                     │   4s timeout,       │
                                     │   AbortController   │
                                     └──────────┬──────────┘
                                                │
                              ┌─────────────────▼─────────────────┐
                              │   api.dms.jyotirmoyb.com          │
                              │   (api-gateway → microservices)   │
                              └───────────────────────────────────┘
```

---

## URL Routing Convention (react-router-dom v6 HashRouter)

| Frame         | Routes                                                                         |
|---------------|--------------------------------------------------------------------------------|
| Control       | `/control/dashboard`, `/control/platform-matrix`, `/control/users`, `/control/tenants`, `/control/system-config`, `/control/sync-queue` |
| DMS           | `/dms/sku-catalog`, `/dms/stock-ledger`, `/dms/outlet-registry`, `/dms/pricing-schemes` |
| SFA           | `/sfa/sales-orders`, `/sfa/beat-routes`, `/sfa/field-visits`, `/sfa/van-sales` |
| Governance    | `/governance/invoices`, `/governance/trade-claims`, `/governance/audit-ledger`  |
| Analytics     | `/analytics/ai-forecast`, `/analytics/reports`                                 |

---

## RBAC Roles & Visibility

| Role          | Frames Accessible                                       |
|---------------|---------------------------------------------------------|
| `admin`       | All 5 frames (Control, DMS, SFA, Governance, Analytics) |
| `agent`       | DMS, SFA                                                |
| `distributor` | DMS, Governance                                         |
| `auditor`     | Control, DMS, Governance (read-only)                    |

---

## File Ownership & Edit Rules

### When editing a page component (e.g. `SkuCatalog.tsx`):
1. Read **only** that file + `types/index.ts` + `context/DataContext.tsx`.
2. Use `useData()` hook for all state — never `useState` + `fetch` locally.
3. Use `tokens` from `theme/tokens.ts` for all colours, spacing, and typography.
4. Use existing modular form modals from `components/forms/` for create/edit flows.
5. Use `<StatusBadge>` for all status rendering.

### When adding a new domain entity:
1. Add the TypeScript interface to `types/index.ts`.
2. Add seed data arrays/constants to `data/seed.ts`.
3. Add state + mutation to `DataContext.tsx`.
4. Create form modal in `components/forms/`.
5. Create page in the appropriate `pages/` subdirectory.
6. Register in the relevant Frame container (`frames/`).
7. Add route entry to `App.tsx` frame path map.
8. Add `NavItem` to `data/seed.ts` NAV_ITEMS array.

### When adding a new microservice:
1. Scaffold under `services/<service-name>/`.
2. Add to `pnpm-workspace.yaml` (already covered by `services/*`).
3. Add health endpoint to `api-gateway` proxy table.
4. Add deployment block to `render.yaml` and `docker-compose.yml`.
5. Add Kubernetes manifest to `k8s/`.

---

## Build & Verify Commands

```bash
# Frontend typecheck + build
cd apps/web-admin && npx tsc --noEmit && npx vite build

# Full monorepo build
pnpm build          # runs turbo run build

# Lint
pnpm lint           # runs turbo run lint

# Tests
pnpm test           # runs turbo run test --concurrency=1

# Install dependencies
pnpm install

# Dev server (web-admin)
cd apps/web-admin && pnpm dev
```

---

## Critical Conventions

1. **No hardcoded data in page components.** All domain data comes from `DataContext` (which falls back to seed data when the API is unreachable).
2. **No Tailwind.** All styling uses inline `style` objects referencing `tokens.ts` presets.
3. **No `any` types.** Strict TypeScript everywhere. Use `types/index.ts` interfaces.
4. **No silent failures.** Every `catch` block must log or display an error.
5. **Monospace IDs.** All ID columns render with `fontFamily: 'monospace'`.
6. **Auto-increment IDs.** New entities use `Date.now()` hex suffix pattern: `PREFIX-${Date.now().toString(16).slice(-6)}`.
7. **Dropdown-first forms.** Minimise user typing — use `<select>` with pre-populated options from seed constants (`AGENT_NAMES`, `DISTRIBUTOR_NAMES`, `SKU_CATEGORIES`, etc.).
8. **Cross-module mutations.** Approving a sales order auto-generates an invoice. Approving a trade claim changes status to `SETTLED`. All side effects are centralised in `DataContext.tsx`.
