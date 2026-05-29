# Enterprise DMS & SFA Platform — Repository Structure

Central monorepo directory layout outlining core contexts, packages, services, frontend apps, and pipelines.

```
enterprise-dms-monorepo/
│
├── apps/
│   ├── mobile-flutter/                 # Field SFA app (Flutter)
│   ├── mobile-rn/                      # React Native field app (parity surface)
│   └── web-admin/                      # React/Vue admin portal
│
├── services/
│   ├── sfa-service/                    # Sales force automation (DDD)
│   ├── dms-core-service/               # Distributor management (DDD)
│   ├── api-gateway/                    # Nginx/Envoy: mTLS, rate limiting
│   ├── report-service/                 # Read-replica reporting engine
│   ├── identity-service/               # authN/authZ, RBAC, tokens ★
│   ├── config-service/                 # multi-tenancy, feature flags ★
│   ├── notification-service/           # push, SMS, email, in-app ★
│   ├── sync-service/                   # offline sync & conflict resolution ★
│   ├── file-service/                   # documents/media, object storage ★
│   ├── audit-service/                  # tamper-evident audit log (SOC 2) ★
│   ├── ai-gateway-service/             # LLM/model inference gateway, prompt routing ★
│   ├── forecasting-service/            # demand/sales forecasting (ML-backed) ★
│   └── recommendation-service/         # next-best-action, suggested orders ★
│
├── ai-ml/                              # ML/AI workspace (feature store, training, serving)
│   ├── feature-store/                  # Online/offline features (Feast)
│   ├── datasets/                       # Raw, curated, labeling
│   ├── training/                       # Pipelines, experiments, notebooks
│   ├── models/                         # Registry + per-domain models
│   ├── serving/                        # Batch + realtime inference
│   ├── llm/                            # RAG, prompts, agents, guardrails
│   ├── evaluation/                     # Metrics, drift, bias, backtesting
│   ├── pipelines/                      # Orchestration, CI/CD, monitoring
│   └── contracts/                      # Feature + prediction schemas
│
├── packages/
│   ├── pkg-crypto/                     # AES-256-GCM, RSA/ECC, HMAC-SHA256
│   ├── pkg-database/                   # Shared schemas + PII annotations
│   ├── pkg-events/                     # Shared event schemas
│   ├── pkg-ui-shared/                  # React/React Native shared logic
│   ├── pkg-logger/                     # structured logging + redaction ★
│   ├── pkg-validation/                 # shared Zod/Joi schemas + DTOs ★
│   ├── pkg-http/                       # hardened HTTP client ★
│   ├── pkg-rbac/                       # permission model & policy helpers ★
│   ├── pkg-config-client/              # feature-flag / tenant config SDK ★
│   └── pkg-testing/                    # fixtures, factories, mocks ★
│
├── contracts/                          # cross-service contract registry
│   ├── events/                         # Versioned event schemas
│   ├── openapi/                        # REST API specs per service
│   ├── graphql/                        # GraphQL SDL schemas
│   └── proto/                          # gRPC service definitions
│
├── infrastructure/
│   ├── docker-compose.yml              # Local dev stack
│   ├── kubernetes/
│   ├── helm/                           # Helm charts per service ★
│   ├── terraform/                      # cloud infra as code (GCP/OCI) ★
│   ├── security/                       # vault, key mgmt, certificate mgmt ★
│   ├── scripts/
│   └── ci-cd/
│
├── observability/                      # logging, metrics, tracing ★
├── db/                                 # migrations, seeds, replica, policies ★
├── docs/                               # ADRs, runbooks, API docs, onboarding ★
├── tools/                              # generators, codegen, scripts ★
├── tests/                              # cross-cutting e2e scenarios ★
├── config/                             # feature flags, tenant templates ★
└── .github/                            # pipelines & governance ★
```
