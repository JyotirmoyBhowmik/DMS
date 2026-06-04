# Enterprise Feature Matrix & Availability Checklist

This document acts as the definitive roadmap and verification guide for the **Enterprise Distributor Management System (DMS) & Sales Force Automation (SFA) Platform**. It audits 114 key business and technical requirements, mapping them to codebase targets, status indicators, and deployment gap assessments.

---

## 📊 Summary of Feature Coverage

| Status | Count | Description |
|:---|:---:|:---|
| **Implemented `[✓]`** | **31** | Core logic is active, fully functional, and verified by passing unit/integration tests in the monorepo. |
| **Stubbed/Mocked `[~]`** | **28** | Interfaces, schemas, or mocked endpoints exist, supporting testing workflows without live integration adapters. |
| **Planned `[ ]`** | **55** | Feature is in the v1 roadmap backlog and requires full design/development before production rollout. |

---

## 🛠️ Feature Audit Checklist

### 1. Security, Architecture & Non-Functional Requirements (NFRs)

| Feature | Module | Status | Codebase Link / Target | Real-World Integration Gap |
| :--- | :---: | :---: | :--- | :--- |
| **SSO and Multi-Factor Authentication (MFA)** | `M1` | `[ ]` | Planned in `identity-service` | Requires OAuth2/OIDC adapter and MFA TOTP/SMS provider integration. |
| **Role-Based Access Control (RBAC)** | `M1` | `[✓]` | [index.ts](file:///c:/Users/TEST/DMS/packages/pkg-rbac/src/index.ts#L34-L101) | Needs a web administration console to dynamically edit role-permission assignments. |
| **Multi-Tenant Data Segregation** | `M2` | `[✓]` | [tenant_isolation.sql](file:///c:/Users/TEST/DMS/db/policies/tenant_isolation.sql) | Row-Level Security (RLS) is enabled; needs automated migration verification. |
| **Immutable Audit Trails** | `M28` | `[✓]` | [audit-block.ts](file:///c:/Users/TEST/DMS/services/audit-service/src/domain/entities/audit-block.ts) | Add a message queue to automatically record ledger blocks from core transaction events. |
| **API-first Architecture** | `M31` | `[✓]` | [contracts/](file:///c:/Users/TEST/DMS/contracts/) | Schemas and code generation are fully in place; requires API versioning checks. |
| **Cloud-native High Availability (HA)** | `M33` | `[✓]` | [k8s/](file:///c:/Users/TEST/DMS/infrastructure/k8s/) | Manifests are configured with autoscaling limits; requires multi-zone cloud setup. |
| **End-to-End Encryption** | `M1` | `[✓]` | [aes_gcm.ts](file:///c:/Users/TEST/DMS/packages/pkg-crypto/src/symmetric/aes_gcm.ts) | Cryptographic primers are verified; needs secure HSM key management policies. |
| **Data Residency Compliance** | `M2` | `[✓]` | `@Tenant` Annotations | Database partitions must route to regional server instances based on tenant location. |
| **Real-time API Health Monitoring** | `M31` | `[✓]` | [nginx.conf](file:///c:/Users/TEST/DMS/infrastructure/nginx/nginx.conf#L55-L68) | Health checks are configured in deployments; needs external SLA alerting (PagerDuty). |
| **PII Data Anonymization** | `M32` | `[✓]` | `@PII` annotations in `@dms/pkg-database` | Logs and reporting tables must be periodically sanitized using automated masking. |
| **Sandbox & Staging Environments** | `M33` | `[✓]` | Staging / Test Suites | Standardize database cloning tools to quickly spin up replica sandboxes. |
| **Automated Backups & Archiving** | `M33` | `[ ]` | Planned in Infrastructure | Set up automated PG dumps to AWS S3 Glacier with rotation rules. |

---

### 2. Field Sales Force Automation (SFA)

| Feature | Module | Status | Codebase Link / Target | Real-World Integration Gap |
| :--- | :--- | :---: | :--- | :--- |
| **Offline-first Order Capture** | `M5` | `[✓]` | Client Outbox Store | Optimize local data stores for low memory footprint on entry-level Android devices. |
| **Real-Time Calculation of Schemes** | `M19` | `[✓]` | [scheme_policy.ts](file:///c:/Users/TEST/DMS/services/sfa-service/src/domain/policies/scheme_policy.ts) | Dynamic resolution from database tables instead of in-memory maps. |
| **Geo-fenced Beat Check-in/out** | `M4` | `[✓]` | [journey_policy.ts](file:///c:/Users/TEST/DMS/services/sfa-service/src/domain/policies/journey_policy.ts) | Integrate Mapbox / Google Maps API to calculate real road distance. |
| **Cash vs. Credit Billing Holds** | `M5` | `[✓]` | [process_order.usecase.ts](file:///c:/Users/TEST/DMS/services/sfa-service/src/application/usecases/process_order.usecase.ts#L25-L42) | Must fetch real-time outstanding ledger amounts from ERP. |
| **MoQ & MoV Enforcement** | `M18` | `[✓]` | [order.rules](file:///c:/Users/TEST/DMS/packages/pkg-validation/src/index.ts) | Need config panel UI for regional managers to set MoQ/MoV values. |
| **Differential Sync Protocols** | `M25` | `[✓]` | [sync-service/](file:///c:/Users/TEST/DMS/services/sync-service/) | Implement GZIP compression on synchronization packets. |
| **Journey Plan (PJP) Exception Handling** | `M3` | `[ ]` | Planned in `sfa-service` | Add supervisor approval UI and push notification flow. |
| **Van Sales & Route Accounting** | `M10` | `[~]` | [business_blueprint.md](file:///c:/Users/TEST/DMS/docs/business_blueprint.md#L298-L305) | Needs vehicle load sheets, cash drawer settlement, and on-board printing logic. |
| **Customizable Dynamic Forms & Surveys** | `M8` | `[~]` | Survey Definitions | Needs WYSIWYG form creator interface in the Admin portal. |
| **Field Force Attendance & Shifts** | `M15` | `[~]` | Visit Check-In coordinates | Needs leave management forms, calendars, and payroll integrations. |
| **Integrated Payment Collection** | `M9` | `[~]` | Collection stubs | Integrate Razorpay, Stripe, or UPI gateway SDKs into the mobile client. |
| **Merchandising & Share of Shelf** | `M7` | `[~]` | Planogram stubs | Implement camera interface and photo uploading in Flutter client. |
| **GPS Spoofing Detection** | `M4` | `[ ]` | Planned in Flutter/RN App | Implement mock-location detection native libraries in Android/iOS. |
| **Coaching & Joint-working Visits** | `M4` | `[ ]` | Planned in `sfa-service` | Add joint-visit status flag and coaching questionnaire templates. |
| **In-App LMS & Training Modules** | `M15` | `[ ]` | Planned in mobile clients | Video player module and quiz progress database storage. |
| **Voice-to-Text Order Dictation** | `M5` | `[ ]` | Planned in mobile clients | Integrate OpenAI Whisper API or offline voice recognition libraries. |
| **Thermal Bluetooth Printing** | `M10` | `[ ]` | Planned in mobile clients | Write native ESC/POS print driver bindings for Android/iOS. |
| **Peer-to-Peer Recognition Wall** | `M15` | `[ ]` | Planned in mobile clients | Social feed service with WebSockets for real-time reactions. |
| **Fuel Expense Geo-Calculations** | `M14` | `[ ]` | Planned in `sfa-service` | Integrate Google Directions API to verify travel distance against logs. |
| **Expense Management Module** | `M14` | `[ ]` | Planned in `sfa-service` | Receipt upload storage and approval hierarchy configurations. |
| **Retailer Asset Management** | `M11` | `[ ]` | Planned in `dms-core-service` | Asset ledger tracking serials, models, and maintenance schedules. |
| **Competitor Product Mapping** | `M12` | `[ ]` | Planned in `sfa-service` | Competitor product catalogue and price tracking models. |
| **Telecalling & Centralized Sales** | `M5` | `[ ]` | Planned in `sfa-service` | Connect Twilio / Asterisk CRM systems with SFA order pipelines. |
| **Gamification & Target Tracking** | `M13` | `[ ]` | Planned in `recommendation-service` | Real-time leaderboard calculations and visual widgets. |

---

### 3. Distributor Management System (DMS Core)

| Feature | Module | Status | Codebase Link / Target | Real-World Integration Gap |
| :--- | :--- | :---: | :--- | :--- |
| **Primary & Secondary Sales Tracking** | `M17` | `[✓]` | [order.aggregate.ts](file:///c:/Users/TEST/DMS/services/sfa-service/src/domain/aggregates/order.aggregate.ts) | Connect primary orders to the factory dispatch notifications. |
| **Dynamic Pricing (MRP, PTR, PTD)** | `M18` | `[✓]` | [pricing_policy.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/domain/policies/pricing_policy.ts) | Dynamic geographical resolving of tax/prices based on customer address. |
| **Automated Tax Application** | `M18` | `[✓]` | [pricing_policy.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/domain/policies/pricing_policy.ts) | Auto updates for regional GST/VAT changes via tax authority API. |
| **FEFO Batch Tracking & Expiry** | `M6` | `[✓]` | [inventory_aggregate.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/domain/entities/inventory_aggregate.ts) | Batch inventory optimization query patterns in database. |
| **Physical Stock Reconciliation** | `M6` | `[✓]` | [inventory_aggregate.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/domain/entities/inventory_aggregate.ts#L22-L30) | Variance logging UI. |
| **Digital Stock Quarantine** | `M21` | `[✓]` | [dms.controller.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/presentation/rest/controllers/dms.controller.ts#L61-L76) | Setup separate virtual and physical warehouse bins. |
| **Claims & Settlement Workflow** | `M20` | `[✓]` | [claim_aggregate.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/domain/entities/claim_aggregate.ts) | Integrate bank transfers / credit note accounts. |
| **Reverse Logistics Workflows** | `M21` | `[✓]` | Return request endpoint | Multi-step return status (received, assessed, refurbished). |
| **Advanced Basket-Level Promotions** | `M19` | `[✓]` | `SchemePolicy` and `PricingPolicy` | Combinatorics discount resolver algorithms. |
| **Date-Effective Rate Changes** | `M18` | `[~]` | [pricing_policy.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/domain/policies/pricing_policy.ts) | Automation scheduler (Agenda/BullMQ) to change active rates at midnight. |
| **UoM (Pieces/Boxes/Cartons) conversions**| `M17` | `[~]` | [pricing_policy.ts](file:///c:/Users/TEST/DMS/services/dms-core-service/src/domain/policies/pricing_policy.ts) | Conversions database schemas and validation routines. |
| **Instant B2B Invoice Generation** | `M18` | `[~]` | [order.controller.ts](file:///c:/Users/TEST/DMS/services/sfa-service/src/presentation/rest/controllers/order.controller.ts) | PDF rendering template libraries and digital signing integration. |
| **Distributor Portal Web Mockup** | `M24` | `[~]` | [apps/web-admin/](file:///c:/Users/TEST/DMS/apps/web-admin/) | Setup a customer portal with separate identity mappings. |
| **KYC Outlet Geo-tagged Onboarding** | `M11` | `[~]` | [business_blueprint.md](file:///c:/Users/TEST/DMS/docs/business_blueprint.md#L306-L313) | Connect API verification (GSTIN/PAN/Aadhaar validation). |
| **Multi-tier Distribution Mappings** | `M17` | `[~]` | Distributor Hierarchy | Setup query structures for multi-tier hierarchies. |
| **Multi-currency & Multi-language** | `M17` | `[~]` | ISO currency field | Setup UI translation tables and local pricing catalogs. |
| **Electronic Proof of Delivery (e-POD)** | `M22` | `[~]` | e-POD schema | Signature canvas capture or OTP confirmation via SMS. |
| **Digital Signature Agreements** | `M11` | `[~]` | Agreements schema | API connection to DocuSign, HelloSign, or native Aadhaar e-Sign. |
| **Barcode, QR & RFID Scanning** | `M22` | `[~]` | Scan validation | Connect native camera decoding or hardware scanners. |
| **ERP Bi-directional Sync** | `M17` | `[ ]` | Planned in `dms-core-service` | Write RFC adapters for SAP and MS Dynamics web services. |
| **Government E-Invoicing / E-Way Bill** | `M22` | `[ ]` | Planned in `dms-core-service` | Integrate government sandbox APIs for invoice registering. |
| **Automated Inventory Replenishment** | `M17` | `[ ]` | Planned in `dms-core-service` | Min-max logic cron calculations. |
| **KPI Tracking (Strike Rate, LPC)** | `M29` | `[~]` | Report aggregates | Real-time analytics compute service. |
| **Custom Report Builder** | `M29` | `[ ]` | Planned in `report-service` | Ad-hoc SQL/JSON schema explorer interface. |
| **Geospatial Heatmaps** | `M29` | `[ ]` | Planned in `report-service` | GIS databases (PostGIS) mapping overlays. |
| **Automated Goods Receipt Note (GRN)** | `M17` | `[ ]` | Planned in `dms-core-service` | GRN entry screens and dynamic purchase order reconciliation. |
| **Visual Territory Management Tools** | `M3` | `[ ]` | Planned in `sfa-service` | Drag-and-drop map beats layout manager. |
| **What-if Scenario Modeling** | `M30` | `[ ]` | Planned in `forecasting-service`| Simulation compute sandboxes. |
| **Cross-Docking Dispatch Support** | `M17` | `[ ]` | Planned in `dms-core-service` | Direct stock transfer routing. |
| **Automated Retailer Compliance Alerts**| `M11` | `[ ]` | Planned in `dms-core-service` | Compliance document checker cron job. |
| **Direct Customer Sentiment Logging** | `M8` | `[ ]` | Planned in `sfa-service` | Survey log sentiment analysis extensions. |
| **Hyperlocal D2C Order Routing** | `M22` | `[ ]` | Planned in `dms-core-service` | Geolocation distributor resolving engines. |
| **Supply Chain Finance Integration** | `M23` | `[ ]` | Planned in `dms-core-service` | Loan application API integrations. |
| **Returnable Transport Packaging (RTP)** | `M17` | `[ ]` | Planned in `dms-core-service` | Pallet/crate ledger and deposits tracking. |
| **Predictive Churn Risk Analytics** | `M30` | `[ ]` | Planned in `forecasting-service`| Churn regression models. |
| **WhatsApp Business Conversational Bot** | `M26` | `[ ]` | Planned in notification | Conversational bot flow configurations. |
| **B2B Tenders & Institutional Sales** | `M18` | `[ ]` | Planned in `dms-core-service` | Custom bidding price structures. |
| **Master Data Deduplication (MDM)** | `M11` | `[ ]` | Planned in `dms-core-service` | Deduplication pipelines using fuzzy string matching. |
| **Third-party Market Data Overlay** | `M30` | `[ ]` | Planned in `forecasting-service`| Nielsen/Kantar CSV ingestors. |
| **Traffic-aware Route Optimization** | `M22` | `[ ]` | Planned in `forecasting-service`| Dynamic vehicle capacity and live road traffic routing. |
| **Sustainability & Carbon Footprint** | `M29` | `[ ]` | Planned in `report-service` | Emissions factor calculation based on mileage. |
| **Virtual Territory Mapping** | `M3` | `[ ]` | Planned in `sfa-service` | Inside sales routing engine. |
| **Distributor ROI & Margins Analytics** | `M24` | `[ ]` | Planned in `dms-core-service` | Multi-ledger financial aggregator. |
| **Serial Number & IMEI Tracking** | `M17` | `[ ]` | Planned in `dms-core-service` | Serial number verification fields. |
| **Surprise Physical Stock Auditing** | `M6` | `[ ]` | Planned in `sfa-service` | Auditing visit flow definitions. |
| **Month-End Close Ledger Locking (MEC)** | `M23` | `[ ]` | Planned in `dms-core-service` | Period lock schedules and ledger validation controls. |
| **Warehouse Bin/Rack Layout Mapping** | `M17` | `[ ]` | Planned in `dms-core-service` | Visual bin mapping layout manager. |
| **Wave and Zone Picking Orchestration** | `M22` | `[ ]` | Planned in `dms-core-service` | Split picker picking lists. |
| **Coupon Code Verification Ledger** | `M19` | `[ ]` | Planned in `dms-core-service` | Alphanumeric validation index database. |
| **Warranty & Post-Sales Requests** | `M21` | `[ ]` | Planned in `dms-core-service` | Serial verification lookup engines. |
| **Retailer Credit Scoring Analytics** | `M23` | `[ ]` | Planned in `forecasting-service`| Delay grading risk matrices. |
| **Digital Adoption Guided Walkthroughs** | `M15` | `[ ]` | Planned in mobile clients | Guided overlay frameworks. |
| **Mystery Shopper Compliance Surveys** | `M8` | `[ ]` | Planned in `sfa-service` | Audit questionnaires. |
| **CSAT and NPS Surveys** | `M8` | `[ ]` | Planned in `sfa-service` | CSAT campaign schedules. |
| **Cohort Customer Lifetime Value** | `M29` | `[ ]` | Planned in `report-service` | Outlets group cohort charts. |
| **Auto-translation In-App Chat** | `M26` | `[ ]` | Planned in notification | Chat translation webhooks. |

---

### 4. Embedded AI/ML Platform Features

| Feature | Module | Status | Codebase Link / Target | Real-World Integration Gap |
| :--- | :--- | :---: | :--- | :--- |
| **Conversational Search (NLP Query)** | `M30` | `[~]` | Prompt routing stubs | Connect real DB vector stores and semantic query parsers. |
| **Image Recognition for Planograms** | `M7` | `[ ]` | Planned in AI serving | Mobile ML planogram matching models. |
| **AI-driven Order Suggestions** | `M16` | `[~]` | `recommendation-service` stub | Train models on historical sales records. |

---

## 🏗️ Production Readiness Gap Analysis

To deploy this platform in a real-world enterprise environment, the following architectural gaps must be addressed:

### A. Repository Adapters & Persistence
* **Current State**: The services verify logic using local, dependency-free in-memory registries (e.g. Map/Set storage) inside repositories.
* **Production Path**: Replace in-memory adapters with TypeORM mappings connecting to a physical **PostgreSQL Cluster (Primary/Replica)**. Ensure Logical Replication (`db/policies/logical_replication.sql`) is active.

### B. Message Broker Orchestration
* **Current State**: Service communication is simulated using local event routing hooks.
* **Production Path**: Configure **RabbitMQ** or **Apache Kafka** brokers. Bind `@dms/pkg-events` codecs to parse and deserialize event streams. Ensure the Outbox patterns (`outbox.entity.ts`) are fully bound to the event publishing schedules.

### C. Live External SDK Bindings
* **Current State**: External systems (such as OCR, government e-invoicing APIs, mapping servers, and SMS gateways) are bypassed with logical mocks.
* **Production Path**: Wire real integrations for:
  1. **Geo-routing**: Mapbox Directions / OSRM routing.
  2. **KYC Verification**: Integration with India Stack APIs or regional equivalent providers.
  3. **E-Invoicing**: Government NIC GST/e-way bill tax portal integrations.
  4. **Push Notifications**: Firebase Cloud Messaging (FCM).
