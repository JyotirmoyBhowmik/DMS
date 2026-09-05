import re

with open('services/claims-service/src/claims_slice.test.ts', 'r') as f:
    content = f.read()

# Replace the entity instantiation and passing raw entities with domain aggregate methods

replacement_save_find_update = """
  test('Repo: Save, find, update claims, audit log creation, and optimistic locking', async () => {
    if (!isDbAvailable) return;

    // We should use the domain aggregate 'Claim', not 'ClaimEntity' directly to repository
    const claim = new Claim({
      id: '00000000-0000-0000-0000-000000000300',
      tenantId: tenantA,
      distributorId,
      schemeId,
      name: 'Test Claim',
      claimCode: 'CLM-TEST-300',
      claimAmountCents: 12000,
      approvedAmountCents: 0,
      status: 'SUBMITTED',
      version: 1,
    });

    // 1. Save
    await claimRepo.save(claim, tenantA);

    // 2. Find
    const saved = await claimRepo.findById(tenantA, claim.id);
    assert.strictEqual(saved?.id, claim.id);
    assert.strictEqual(saved?.version, 1);

    // 3. Update (Optimistic Locking success)
    if (saved) {
      saved.approve(12000);
      const updated = await claimRepo.update(saved, tenantA);
      // fetch back to check version bump
      const reFetched = await claimRepo.findById(tenantA, claim.id);
      assert.strictEqual(reFetched?.version, 2);
      assert.strictEqual(reFetched?.status, 'APPROVED');

      // 4. Update with stale version (Optimistic Locking failure)
      // instantiate a new aggregate object with the stale version number
      const staleClaim = new Claim({
          id: claim.id,
          tenantId: tenantA,
          distributorId,
          schemeId,
          name: 'Test Claim',
          claimCode: 'CLM-TEST-300',
          claimAmountCents: 12000,
          approvedAmountCents: 0,
          status: 'SUBMITTED',
          version: 2, // stale, actual is 2 so it should fail when incremented to 3 but checking against 2-1 = 1? wait.
          // to trigger concurrency we pass version N, and existing is N-1. If actual is 2.
          // let's pass a new claim with version 2 and status changed, it'll check existing(2) !== new(2) - 1 (1). 2 !== 1
      });
      // to make it increment version:
      staleClaim.approve(12000); // version becomes 3. existing is 2. 2 !== 3 - 1 (2).
      // wait, the code does: data.version !== undefined && data.version > 1
      // existing.version !== data.version - 1
      // to fail, we need existing.version (2) !== data.version - 1.
      // If we pass data.version = 2, data.version - 1 = 1. 2 !== 1. True. Concurrency Error.

      const trulyStaleClaim = new Claim({
          id: claim.id,
          tenantId: tenantA,
          distributorId,
          schemeId,
          name: 'Test Claim',
          claimCode: 'CLM-TEST-300',
          claimAmountCents: 12000,
          approvedAmountCents: 0,
          status: 'SUBMITTED',
          version: 2,
      });

      await assert.rejects(
        async () => {
          await claimRepo.update(trulyStaleClaim, tenantA);
        },
        (err: any) => {
          return err instanceof ConcurrencyError;
        }
      );
    }

    // 5. Verify RLS Isolation
    await assert.rejects(
      async () => {
        await claimRepo.findById(tenantB, claim.id);
      },
      (err: any) => {
        return err instanceof EntityNotFoundError;
      }
    );
  });
"""

content = re.sub(
    r"  test\('Repo: Save, find, update claims, audit log creation, and optimistic locking', async \(\) => \{[\s\S]*?\}\);\s*// ─── 3\. E2E HAPPY PATH / API GATEWAY TEST",
    replacement_save_find_update.strip() + "\n\n  // ─── 3. E2E HAPPY PATH / API GATEWAY TEST",
    content
)

# And fix the status returned by API Gateway
content = re.sub(
    r"assert\.strictEqual\(\(createResult\.body as any\)\.status, 'raised'\);",
    "assert.strictEqual((createResult.body as any).status, 'SUBMITTED');",
    content
)
content = re.sub(
    r"assert\.strictEqual\(\(validateResult\.body as any\)\.status, 'validated'\);",
    "assert.strictEqual((validateResult.body as any).status, 'UNDER_REVIEW');",
    content
)
content = re.sub(
    r"assert\.strictEqual\(\(approveResult\.body as any\)\.status, 'approved'\);",
    "assert.strictEqual((approveResult.body as any).status, 'APPROVED');",
    content
)


with open('services/claims-service/src/claims_slice.test.ts', 'w') as f:
    f.write(content)
