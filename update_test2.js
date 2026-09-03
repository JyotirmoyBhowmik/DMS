const fs = require('fs');
const content = fs.readFileSync('services/claims-service/src/claims_slice.test.ts', 'utf8');

const updatedContent = content.replace(
  `    const saved = await claimRepo.findById(tenantA, entity.id);
    assert.strictEqual(saved.id, entity.id);
    assert.strictEqual((saved as any)._version, 1);

    // 3. Update (Optimistic Locking success)
    const updatedClaim = new Claim({
      id: saved.id,
      tenantId: saved.tenantId,
      distributorId: saved.distributorId,
      schemeId: saved.schemeId,
      name: 'Test Claim',
      claimCode: 'TEST-123',
      claimAmountCents: 12000,
      status: 'UNDER_REVIEW',
      version: 2,
    });
    await claimRepo.update(updatedClaim, tenantA);
    const updated = await claimRepo.findById(tenantA, entity.id);
    assert.strictEqual((updated as any)._version, 2);
    assert.strictEqual((updated as any)._status, 'UNDER_REVIEW');

    // 4. Update with stale version (Optimistic Locking failure)
    saved.version = 1; // stale version
    await assert.rejects(
      async () => {
        await claimRepo.update(saved, tenantA);
      },`,
  `    const saved = await claimRepo.findById(tenantA, entity.id) as Claim;
    assert.strictEqual(saved.id, entity.id);
    assert.strictEqual((saved as any)._version, 1);

    // 3. Update (Optimistic Locking success)
    const updatedClaim = new Claim({
      id: saved.id,
      tenantId: saved.tenantId,
      distributorId: saved.distributorId,
      schemeId: saved.schemeId,
      name: 'Test Claim',
      claimCode: 'TEST-123',
      claimAmountCents: 12000,
      status: 'UNDER_REVIEW',
      version: 2,
    });
    await claimRepo.update(updatedClaim, tenantA);
    const updated = await claimRepo.findById(tenantA, entity.id);
    assert.strictEqual((updated as any)._version, 2);
    assert.strictEqual((updated as any)._status, 'UNDER_REVIEW');

    // 4. Update with stale version (Optimistic Locking failure)
    const staleClaim = new Claim({
      id: saved.id,
      tenantId: saved.tenantId,
      distributorId: saved.distributorId,
      schemeId: saved.schemeId,
      name: 'Test Claim',
      claimCode: 'TEST-123',
      claimAmountCents: 12000,
      status: 'UNDER_REVIEW',
      version: 1, // stale version
    });
    await assert.rejects(
      async () => {
        await claimRepo.update(staleClaim, tenantA);
      },`
);

fs.writeFileSync('services/claims-service/src/claims_slice.test.ts', updatedContent);
