import re

with open('services/claims-service/src/claims_slice.test.ts', 'r') as f:
    content = f.read()

# Fix 1: Use method to update status instead of mutating getter
# Before: saved.status = 'validated';
# After: saved.updateStatus('UNDER_REVIEW', 'admin', 'Validating claim');
content = re.sub(
    r"saved\.status\s*=\s*'validated';",
    r"saved.updateStatus('UNDER_REVIEW', 'admin', 'Validating claim');",
    content
)

# Fix 2: Assert against the correct status enum instead of 'validated'
content = re.sub(
    r"assert\.strictEqual\(updated\.status, 'validated'\);",
    r"assert.strictEqual(updated.status, 'UNDER_REVIEW');",
    content
)

# Fix 3: Simulate stale version correctly without mutating the saved entity directly
# The memory says: "When testing optimistic locking in repositories (e.g., `ClaimPgRepository`), the concurrency check (`existing.version !== data.version - 1`) is bypassed if `data.version <= 1`. To properly simulate a concurrency conflict and trigger a `ConcurrencyError` in tests, you must instantiate the stale aggregate with a `version` of 2 or higher."
# The test expects a failure when calling claimRepo.update with a stale version.

stale_version_code = """
    // 4. Update with stale version (Optimistic Locking failure)
    // Create a new aggregate instance based on the saved data to simulate a concurrent request
    // with a stale version. The repo expects version > 1 to enforce concurrency.
    const staleData = saved.toJSON();
    staleData.version = 2; // Simulate a client sending version 2, while DB is now at version 2 (expecting 3)
    const staleClaim = ClaimAggregate.fromPrimitives(staleData as any);

    await assert.rejects(
      async () => {
        await claimRepo.update(staleClaim, tenantA);
      },"""

content = re.sub(
    r"\s*// 4\. Update with stale version \(Optimistic Locking failure\)\n\s*saved\.version = 1; // stale version\n\s*await assert\.rejects\(\n\s*async \(\) => \{\n\s*await claimRepo\.update\(saved, tenantA\);\n\s*\},",
    stale_version_code,
    content
)

with open('services/claims-service/src/claims_slice.test.ts', 'w') as f:
    f.write(content)
