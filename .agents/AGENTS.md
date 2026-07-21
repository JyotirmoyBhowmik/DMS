# Workspace Production Engineering & Coding Standards

## 1. Input Validation & Data Integrity Rules
- **Rule 1.1 (Boundary Validation)**: Validate all incoming data (API payloads, query parameters, environmental variables, message queues) at the entry point before passing it to business logic.
- **Rule 1.2 (Schema Enforcement)**: Use strict type definitions and schema validators (e.g., Zod, DTOs, Dataclasses). Do not allow loose dict or untyped any objects.
- **Rule 1.3 (Defense Against Bad Data)**: Enforce non-null assertions, strict type bounds, allowed string formats (regex/UUID/email), and numeric ranges.
- **Rule 1.4 (Sanitization)**: Escape and sanitize all string inputs to prevent SQL Injection, Cross-Site Scripting (XSS), and Remote Code Execution (RCE).

## 2. Error Handling & Exception Management Rules
- **Rule 2.1 (No Silent Failures)**: Never use empty catch or except blocks. Every exception must be explicitly handled, logged, or rethrown.
- **Rule 2.2 (Domain Exceptions)**: Throw specific, custom domain/business exceptions (e.g., UserNotFoundException, PaymentFailedException) instead of generic system errors.
- **Rule 2.3 (Global Exception Mapping)**: Handle all unhandled exceptions at a global API middleware/filter level.
- **Rule 2.4 (Sanitized Error Responses)**: API error responses must return a standardized JSON structure with: `timestamp`, `status_code`, `error_code`, `correlation_id`, `message` (Safe for public consumption; NEVER expose stack traces, database schema details, or internal server paths to the client).

## 3. Resilience & Fault Tolerance Rules
- **Rule 3.1 (Explicit Timeouts)**: Define explicit connection and read timeouts on every external HTTP request, database call, or socket connection.
- **Rule 3.2 (Retries & Backoff)**: Wrap external integrations with automated retry logic using Exponential Backoff with Jitter for transient network failures.
- **Rule 3.3 (Circuit Breakers)**: Implement circuit breaker patterns for third-party service calls to fail fast and prevent cascading system crashes.
- **Rule 3.4 (Idempotency)**: Ensure state-mutating operations (POST, PUT, DELETE) support idempotency keys to prevent duplicate actions on network retries.

## 4. Observability & Logging Rules
- **Rule 4.1 (Structured Logging)**: Write all logs in JSON format with contextual attributes (level, timestamp, service_name, function_name).
- **Rule 4.2 (Distributed Tracing)**: Extract and propagate a unique Correlation-ID or Trace-ID across every HTTP header, service layer, and asynchronous task.
- **Rule 4.3 (PII Redaction)**: Mask or redact sensitive information (passwords, tokens, credit cards, SSNs, personal health data) before writing to log streams.

## 5. Resource Safety & Performance Rules
- **Rule 5.1 (Deterministic Cleanup)**: Always release external handles (file streams, DB connections, sockets) using resource managers (e.g., try-finally, using, with blocks).
- **Rule 5.2 (Database Protections)**: Enforce pagination controls (LIMIT/OFFSET or Cursor) on all database queries. Unbounded SELECT * queries are strictly forbidden.
- **Rule 5.3 (Connection Pooling)**: Use managed connection pools for database and HTTP clients; do not instantiate new client instances inside hot execution loops.

## 6. Testing & Quality Assurance Rules
- **Rule 6.1 (Triple-Layer Testing)**: Include comprehensive Unit Tests (business logic), Integration Tests (DB/API contracts), and Edge-Case Tests (null payloads, invalid types, timeouts).
- **Rule 6.2 (Mocking Boundaries)**: Mock all external third-party API dependencies in integration tests using explicit contract interfaces.
- **Rule 6.3 (Continuous Git Sync)**: Validate with workspace build (`pnpm build`) and tests before committing and pushing working code to `origin main`.
