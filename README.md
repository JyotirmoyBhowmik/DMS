# Enterprise DMS & SFA Platform

An enterprise-grade **Distributor Management System (DMS)** and **Sales Force Automation (SFA)** platform structured as a high-performance TypeScript monorepo using `pnpm` workspaces and `Turborepo`.

## Directory Overview

- `apps/` — Admin Portal (`web-admin`), SFA Mobile Clients (`mobile-rn`, `mobile-flutter`)
- `services/` — Core DDD microservices (`sfa-service`, `dms-core-service`, `identity-service`, etc.)
- `packages/` — Shared libraries for common tasks (cryptography, structured logger, schemas, validation)
- `contracts/` — OpenAPI specs, Proto contracts, and JSON event schemas
- `ai-ml/` — Feature stores and training models

## Quick Start

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
