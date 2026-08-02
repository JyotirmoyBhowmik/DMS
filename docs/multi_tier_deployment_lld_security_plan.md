# Multi-Tier Deployment, LLD, and Security Plan

This document outlines the detailed plan for circulating the Enterprise DMS & SFA Platform in a B2B2B model, integrating with customer ERPs, delivering module-based SFA applications to diverse user personas, and ensuring strict security, data confidentiality, and multi-tenant isolation.

---

## 1. Multi-Tier Deployment Architecture (B2B2B Hierarchy)

The platform is designed to scale across multiple levels, supporting our deployment to multiple customers, who in turn deploy to multiple distributors.

### 1.1 Hierarchical Model
*   **Platform (L0):** The root instance managing the global infrastructure, overall system health, global AI models, and billing.
*   **Customer / Tenant (L1):** Enterprise FMCG companies or large consumer brands. Each customer operates as an isolated tenant.
*   **Distributor (L2):** Entities operating under a Customer. Distributors manage their own inventory, sales teams, and operations within their designated territories.
*   **Retailer / Persona (L3):** The endpoint entities, including Big Consumer Marts, HORECA (Hotels, Restaurants, Cafes), Small Shops, Van Operators, and the Sales & Marketing teams of the customer.

### 1.2 Infrastructure Scaling & Multi-Tenancy
*   **Compute:** Kubernetes (EKS/GKE) scales pods dynamically based on traffic. Tenants share compute clusters to optimize cost but maintain logical isolation. Dedicated clusters can be provisioned for Enterprise/Premium customers if required.
*   **Data Isolation:** PostgreSQL databases utilize Row-Level Security (RLS) to enforce tenant isolation at the database engine level. Each query automatically filters by `tenant_id`.
*   **Deployment Flow:** Updates to the platform are rolled out centrally via CI/CD pipelines. Database migrations and schema updates are applied cautiously with backward compatibility maintained across versions.

---

## 2. ERP Integration LLD

To seamlessly connect the DMS platform with customer ERPs (e.g., SAP, Oracle, MS Dynamics), we implement an event-driven synchronization architecture.

### 2.1 Architecture & Adapters
*   **Sync Service (`sync-service`):** Acts as the central hub for data exchange.
*   **ERP Adapters:** Custom adapters built for standard ERPs. These adapters handle protocol translation (REST, SOAP, OData, RFC) and data transformation (mapping ERP schemas to DMS canonical schemas).
*   **Message Broker (RabbitMQ / Kafka):** Decouples the ERP adapters from the core DMS services. ERP updates (e.g., new product catalog, pricing changes) are published as events (`catalog.updated`, `pricing.synced`) which are consumed by `dms-core-service`.

### 2.2 Standard API Endpoints
A standard set of robust, versioned REST APIs (in `api-gateway`) is exposed for ERPs capable of direct HTTP integration:
*   `POST /api/v1/erp/sync/catalog` - Inbound product and category updates.
*   `POST /api/v1/erp/sync/pricing` - Inbound pricing and scheme updates.
*   `GET /api/v1/erp/export/orders` - Outbound consolidated sales orders.
*   `GET /api/v1/erp/export/inventory` - Outbound inventory snapshots.

### 2.3 Data Transformation & Idempotency
*   All inbound data passes through validation schemas (using `pkg-validation`).
*   Event processors are idempotent, ensuring safe retries in case of network failures or ERP downtime.

---

## 3. Module-Based SFA Delivery

The SFA application must serve diverse personas with tailored functionality, delivered via a single binary/app using dynamic feature flagging.

### 3.1 Feature Flags (`config-service`)
*   The `config-service` manages configurations at the Tenant (Customer), Role, and User level.
*   Modules are toggled on/off dynamically. When the SFA app initializes, it fetches the active feature flags for the current user.

### 3.2 Personas & Module Mapping
*   **Big Consumer (Marts):** Focus on bulk ordering, custom pricing slabs, and merchandising compliance. (Modules: Order Capture, Merchandising, Pricing & Tax Engine).
*   **HORECA:** Focus on frequent replenishment, specific catalog filtering, and credit management. (Modules: Order Capture, Finance & Receivables).
*   **Small Shops:** Focus on quick spot billing, cash collection, and visual catalog. (Modules: Van Sales, Payment Collection).
*   **Van Operators:** Focus on ready-stock delivery, offline capability, and inventory check. (Modules: Van Sales, Inventory Check, Sync & Offline).
*   **Sales & Marketing Team:** Focus on journey planning, targets, coaching, and surveys. (Modules: Journey Planning, Target & Incentive, Survey & Audit, AI Coaching).

### 3.3 Role-Based Access Control (`identity-service` & `pkg-rbac`)
*   `identity-service` issues JWTs containing the user's roles and tenant ID.
*   `pkg-rbac` enforces fine-grained access policies at the API level based on the roles (e.g., `van_operator` cannot access `distributor_reports`).

---

## 4. Detailed Low Level Design (LLD)

### 4.1 Database Schemas & Row-Level Security (RLS)
All critical tables include a `tenant_id` column.
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    distributor_id UUID NOT NULL,
    retailer_id UUID NOT NULL,
    total_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON orders
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```
Application middleware extracts the `tenant_id` from the JWT and sets `app.current_tenant` in the Postgres session before executing queries.

### 4.2 Authentication Flow
1.  User opens SFA App and submits credentials (or SSO).
2.  `identity-service` validates credentials, fetches user profile, roles, and tenant mapping.
3.  `identity-service` issues a signed JWT containing `sub`, `tenant_id`, and `roles`.
4.  API Gateway validates the JWT signature for all subsequent requests.
5.  Downstream services extract `tenant_id` for database queries and `roles` for RBAC.

### 4.3 Offline-Sync Conflict Resolution
*   **Local DB:** SFA app uses SQLite (Drift) for offline storage.
*   **Sync Protocol:** Bidirectional sync using logical clocks or vector clocks.
*   **Conflict Resolution:**
    *   Last-Write-Wins (LWW) for non-critical fields.
    *   Server-Authoritative for inventory and financial transactions.
    *   Manual Resolution queues for complex conflicts (e.g., simultaneous territory reassignment).

---

## 5. Security & Data Confidentiality

### 5.1 End-to-End Encryption (`pkg-crypto`)
*   **Data in Transit:** TLS 1.2+ mandatory for all communications.
*   **Data at Rest:** Database volumes are encrypted (AWS KMS / Cloud provider default).
*   **Column-Level Encryption:** Highly sensitive fields (e.g., bank account details) are encrypted at the application level using AES-256-GCM via `pkg-crypto` before persistence.

### 5.2 PII Anonymization
*   Personally Identifiable Information (PII) is tagged in the database schema (`pkg-database` annotations).
*   Data pipelines moving data to AI/ML or reporting data lakes automatically mask or anonymize these fields.

### 5.3 Audit Logging (`audit-service`)
*   All create, update, and delete actions on critical entities (Orders, Payments, Master Data) generate an event.
*   `audit-service` consumes these events and stores them in a tamper-evident, append-only ledger (vital for SOC 2 compliance).

### 5.4 Compliance Standards
*   The architecture supports ISO 27001, SOC 2 Type II, and GDPR/CCPA requirements through data residency controls, strict access management, and comprehensive auditing.
