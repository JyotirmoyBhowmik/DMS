const fs = require('fs');
const filepath = 'services/claims-service/src/claims_slice.test.ts';
let content = fs.readFileSync(filepath, 'utf8');

// Re-apply ONLY the exact fixes needed:
// 1. Repo tests: passing domain aggregates instead of raw entities
content = content.replace(
  `await claimRepo.save(entity as any, tenantA);`,
  `await claimRepo.save(new ClaimAggregate(entity), tenantA);`
);

content = content.replace(
  `saved.status = 'validated';
    const updated: any = await claimRepo.update(saved, tenantA);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.status, 'validated');`,
  `saved.getClaim().status = 'validated';
    const updated: any = await claimRepo.update(saved, tenantA);
    assert.strictEqual(updated.getClaim().version, 2);
    assert.strictEqual(updated.getClaim().status, 'validated');`
);

content = content.replace(
  `saved.version = 1; // stale version
    await assert.rejects(
      async () => {
        await claimRepo.update(saved, tenantA);
      },`,
  `// Create a stale aggregate with version >= 2 to trigger concurrency check correctly
    const staleEntity = new ClaimEntity({
      id: saved.getClaim().id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      amount: 12000,
      status: 'validated',
      version: 2
    });
    const staleAggregate = new ClaimAggregate(staleEntity);

    await assert.rejects(
      async () => {
        await claimRepo.update(staleAggregate, tenantA);
      },`
);

// 2. E2E tests: fix payload and expected states
content = content.replace(
  `      body: {
        id: claimId,
        distributorId,
        schemeId,
        amount: 8500,
      },`,
  `      body: {
        id: claimId,
        distributorId,
        schemeId,
        claimCode: 'CLM-E2E-1',
        name: 'E2E Claim',
        claimAmountCents: 8500,
      },`
);

content = content.replace(
  `assert.strictEqual((createResult.body as any).status, 'raised');`,
  `assert.strictEqual((createResult.body as any).status, 'SUBMITTED');`
);
content = content.replace(
  `assert.strictEqual((validateResult.body as any).status, 'validated');`,
  `assert.strictEqual((validateResult.body as any).status, 'UNDER_REVIEW');`
);
content = content.replace(
  `assert.strictEqual((approveResult.body as any).status, 'approved');`,
  `assert.strictEqual((approveResult.body as any).status, 'APPROVED');`
);
content = content.replace(
  `assert.strictEqual(auditRows.rows[0].action, 'raised');`,
  `assert.strictEqual(auditRows.rows[0].action, 'SUBMITTED');`
);
content = content.replace(
  `assert.strictEqual(outboxRows.rows[0].event_type, 'claim.raised');`,
  `assert.strictEqual(outboxRows.rows[0].event_type, 'claim.SUBMITTED');`
);

fs.writeFileSync(filepath, content);
console.log('patched claims test');
