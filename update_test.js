const fs = require('fs');
const content = fs.readFileSync('services/claims-service/src/claims_slice.test.ts', 'utf8');

const updatedContent = content.replace(
  `    const entity = new ClaimEntity({
      id: '00000000-0000-0000-0000-000000000300',
      tenantId: tenantA,
      distributorId,
      schemeId,
      amount: 12000,
      status: 'raised',
      version: 1,
    });

    // 1. Save
    await claimRepo.save(entity as any, tenantA);

    // 2. Find
    const saved: any = await claimRepo.findById(tenantA, entity.id);
    assert.strictEqual(saved.id, entity.id);
    assert.strictEqual(saved.version, 1);

    // 3. Update (Optimistic Locking success)
    saved.status = 'validated';
    const updated: any = await claimRepo.update(saved, tenantA);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.status, 'validated');`,
  `    const entity = new Claim({
      id: '00000000-0000-0000-0000-000000000300',
      tenantId: tenantA,
      distributorId,
      schemeId,
      name: 'Test Claim',
      claimCode: 'TEST-123',
      claimAmountCents: 12000,
      status: 'SUBMITTED',
      version: 1,
    });

    // 1. Save
    await claimRepo.save(entity, tenantA);

    // 2. Find
    const saved = await claimRepo.findById(tenantA, entity.id);
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
    assert.strictEqual((updated as any)._status, 'UNDER_REVIEW');`
);

fs.writeFileSync('services/claims-service/src/claims_slice.test.ts', updatedContent);
