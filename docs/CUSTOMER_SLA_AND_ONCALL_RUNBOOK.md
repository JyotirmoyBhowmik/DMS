# Customer Service Level Agreements (SLAs) & Operational On-Call Runbook

This document defines customer-facing **Service Level Agreements (SLAs)**, Recovery Point / Time Objectives (RPO/RTO), and internal **PagerDuty On-Call Triage Runbooks** for platform operations.

---

## 1. Customer-Facing SLAs & Commitments

| Metric | Target Commitment | Measurement Window | Credit / Penalty |
| :--- | :--- | :--- | :--- |
| **Service Availability** | **99.9% Uptime** (≤43.8 mins downtime/mo) | Calendar Month | 10% invoice credit per 0.1% breach |
| **API Latency (P95)** | **< 200 ms** for Core & SFA endpoints | Rolling 30 Days | Performance review |
| **Recovery Point Objective (RPO)** | **< 1 minute** (Point-in-Time DB WAL sync) | Continuous | High Priority Incident |
| **Recovery Time Objective (RTO)** | **< 15 minutes** (Automated cluster failover) | Per Outage | High Priority Incident |

---

## 2. Internal Incident Severity & Escalation Matrix

- **SEV-0 (Critical Platform Outage)**: System-wide outage affecting all tenants or database data corruption.
  - *Response Time*: **< 5 minutes** (PagerDuty P0 automated page).
- **SEV-1 (Major Service Degradation)**: Single tenant isolated outage, ERP connector pipeline failure, or API latency P95 > 1000ms.
  - *Response Time*: **< 15 minutes**.
- **SEV-2 (Minor Operational Defect)**: Single feature flag malfunction or non-blocking UI rendering glitch.
  - *Response Time*: **< 2 hours**.

---

## 3. On-Call Triage Runbooks

### 3.1 Database Connection Pool Exhaustion Triage
**Symptoms**: HTTP 500 responses with `CONNECTION_EXHAUSTED` error.
**Action Steps**:
1. Inspect connection pool metrics via Gateway Grafana dashboard.
2. Check for runaway unbounded queries or missing RLS indexes.
3. Scale PgBouncer pool limits:
   ```bash
   kubectl scale deployment/pgbouncer --replicas=3 -n dms-production
   ```

### 3.2 Vault Secret Storage Unseal Triage
**Symptoms**: Log entries `Vault server unreachable, using AES-256-GCM envelope encryption fallback`.
**Action Steps**:
1. Check Vault pod status:
   ```bash
   kubectl get pods -l app=vault -n dms-production
   ```
2. If unsealed, execute unseal keys protocol via Vault Operator key shares.
