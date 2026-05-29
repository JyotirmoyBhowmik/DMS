# Enterprise DMS & SFA Platform — File-Level Build Manifest

Central registry of concrete files created and their mapped contents types across all monorepo scopes.

## 1. Root-Level Files
- `package.json` — Root workspace manifest.
- `turbo.json` — Turborepo pipeline graph.
- `.editorconfig`, `.eslintrc.js`, `.prettierrc` — Formatting and lint guidelines.
- `tsconfig.base.json` — Shared TS compiler settings.
- `pnpm-workspace.yaml` — pnpm workspace configurations.

## 2. Core Utility Packages (`packages/`)
- `@dms/pkg-crypto` — AES-256-GCM, RSA, HMAC, and Vault dynamic secrets.
- `@dms/pkg-logger` — structured JSON logging, AsyncLocalStorage context, and PII redactors.
- `@dms/pkg-validation` — input Zod validators and credit limits/discounts.
- `@dms/pkg-database` — custom `@Tenant`, `@Encrypted`, and `@PII` annotations and RLS queries.
- `@dms/pkg-events` — CloudEvents builders and event payload interfaces.
- Skeletons: `@dms/pkg-http`, `@dms/pkg-rbac`, `@dms/pkg-config-client`, `@dms/pkg-ui-shared`, `@dms/pkg-testing`.

## 3. DDD Services & Frontend Clients (`services/`, `apps/`)
- `services/sfa-service` — Sales Force Automation DDD layer (entities, aggregates, usecases, controller).
- `services/dms-core-service` — core distribution logic entrypoint.
- `apps/web-admin` — single-page corporate dashboard mockup.
- `apps/mobile-rn` — React Native baseline.
- `apps/mobile-flutter` — Flutter mobile application.
- `ai-ml/feature-store` — Feast entities.
