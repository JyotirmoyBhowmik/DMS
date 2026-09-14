## 2024-09-14 - Improve FormField accessibility

**Learning:** Reusable form wrapping components (`FormField`) need automatic `htmlFor` and `aria-describedby` generation. Using `React.cloneElement` on the `children` along with `useId()` ensures inputs are properly linked to labels and hints without requiring manual ID management by the consumer.
**Action:** When building generic form wrapper components, ensure accessibility by using `useId()` and `React.cloneElement()` (wrapped in a `React.isValidElement()` check) to automatically generate and link the `<label>`'s `htmlFor` attribute to the child element's `id`, and safely assign `aria-describedby` to link any associated hint text, preserving any existing `aria-describedby` values on the child.
## 2024-09-14 - Fix dynamic date testing logic for Temporal rules

**Learning:** When mocking `LedgerPeriod` data for tests in `@dms/finance-service` that invoke use cases relying on the current system date (e.g., `ReverseLedgerEntryUseCase` executing `new Date()`), using hardcoded historical dates like `2026-08-01` will cause CI temporal test failures (time bombs).
**Action:** When mocking `LedgerPeriod` data for tests in `@dms/finance-service` that invoke use cases relying on the current date, ensure you dynamically generate a mocked period that covers the current system month and year to prevent temporal test failures triggered by strict period validation.
## 2024-09-14 - Fix E2E and repository test logic for `Claim` domain aggregate

**Learning:** When testing optimistic concurrency with domain aggregates, avoid bypassing domain invariants by directly mutating properties like `version` on saved entities. Instead, simulate a concurrency conflict by instantiating a new aggregate object with the stale version number.
**Action:** When working with backend repositories (e.g., `ClaimPgRepository` in `@dms/claims-service`), ensure you pass domain aggregates (e.g., `Claim`) instead of raw database entities (e.g., `ClaimEntity`) to methods like `save` and `update`, as the repositories rely on aggregate methods like `.toJSON()` to format data for persistence. Also, ensure API tests match the exact input shapes defined by their controllers (e.g., passing `claimAmountCents` rather than legacy `amount` properties).
