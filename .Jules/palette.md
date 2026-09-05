## 2024-05-18 - Modal Component Accessibility Requirements
**Learning:** Custom UI dialogs/modals in the `@dms/web-admin` application require explicitly setting fundamental ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and implementing an Escape key event listener to close the modal, in order to comply with accessibility standards.
**Action:** When building or updating custom modals, always include `role="dialog"`, `aria-modal="true"`, dynamic `aria-labelledby`, and ensure keyboard accessibility by binding 'Escape' to the modal's close functionality.

## 2024-05-24 - FormField auto-linking
**Learning:** Wrapper components with labels need to automatically associate the label with the child input using htmlFor and ID. Also aria-describedby for hints.
**Action:** Use useId() and React.cloneElement() to inject an ID into the child if it doesn't have one, and link it to the label and hint.

## 2024-05-25 - Ledger Period temporal issue in test
**Learning:** Hardcoding a strict ledger period in `finance.test.ts` (e.g. `2026-08-01` to `2026-08-31`) causes the test to fail when `ReverseLedgerEntryUseCase` executes `new Date()` outside of this range, resulting in an "No accounting period defined for the entry date" error (a temporal time bomb test).
**Action:** Always dynamically generate mocked periods for the current month when the code under test validates against `new Date()`.

## 2024-05-25 - Instantiating Domain Aggregates for concurrency tests
**Learning:** Bypassing domain invariants by directly modifying `version` property on database entities to test concurrency conflicts in repositories (like `ClaimPgRepository`) will fail. Repositories expect the aggregate method `.toJSON()` to correctly resolve values.
**Action:** When testing optimistic locking, instantiate a full aggregate object (e.g. `Claim`) passing the specific stale `version` required. Ensure you observe the specific aggregate's enum/union types (e.g. 'SUBMITTED' rather than legacy entity statuses like 'raised').
