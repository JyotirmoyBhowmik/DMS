const fs = require('fs');
const filepath = 'services/claims-service/src/claims_slice.test.ts';
let content = fs.readFileSync(filepath, 'utf8');

// The failure in 'Repo: Save, find, update claims...' is because the test passes 'saved' to update directly.
// The memory says: "When working with backend repositories (e.g., ClaimPgRepository in @dms/claims-service), ensure you pass domain aggregates (e.g., Claim) instead of raw database entities (e.g., ClaimEntity) to methods like save and update, as the repositories rely on aggregate methods like .toJSON() to format data for persistence."
// It also says "In @dms/claims-service, the Claim domain aggregate encapsulates its state. Do not directly mutate properties (like claim.status = 'validated'); instead, transition states using public methods like .updateStatus('<STATUS>', ...). Direct mutations will fail because these properties are often read-only getters."
// So we need to wrap 'saved' in the domain aggregate.

// Also, the E2E test fails because: "When testing or interacting with the POST /api/v1/claims endpoint, ensure the payload correctly maps to the schema by providing name, claimCode, and claimAmountCents (not amount)."
// We need to fix the payload in POST /api/v1/claims.

// Fix 1: Wrap entity with aggregate for save and update in Repo test
content = content.replace(
  `    // 1. Save\n    await claimRepo.save(entity as any, tenantA);\n\n    // 2. Find\n    const saved: any = await claimRepo.findById(tenantA, entity.id);`,
  `    // 1. Save
    const claimToSave = new Claim({
      id: entity.id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimCode: 'CLM-003',
      name: 'Test Claim',
      claimAmountCents: 12000,
      status: 'SUBMITTED',
      version: 1,
    });
    await claimRepo.save(claimToSave, tenantA);

    // 2. Find
    const saved = await claimRepo.findById(tenantA, entity.id);`
);

content = content.replace(
  `    // 3. Update (Optimistic Locking success)
    saved.status = 'validated';
    const updated: any = await claimRepo.update(saved, tenantA);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.status, 'validated');`,
  `    // 3. Update (Optimistic Locking success)
    saved!.updateStatus('UNDER_REVIEW', 'reviewer', 'looks good');
    const updated = await claimRepo.update(saved!, tenantA);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.status, 'UNDER_REVIEW');`
);

content = content.replace(
  `    // 4. Update with stale version (Optimistic Locking failure)
    saved.version = 1; // stale version
    await assert.rejects(
      async () => {
        await claimRepo.update(saved, tenantA);
      },`,
  `    // 4. Update with stale version (Optimistic Locking failure)
    // Create a stale aggregate instance instead of directly mutating version
    const staleAggregate = new Claim({
      id: saved!.id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimCode: saved!.claimCode,
      name: saved!.name,
      claimAmountCents: saved!.claimAmountCents,
      status: saved!.status,
      version: 2, // stale, should be 2, database is now 2, we simulate conflict by trying to save version 2 again, meaning we expected db to be 1. Wait, memory says "To properly simulate a concurrency conflict and trigger a ConcurrencyError in tests, you must instantiate the stale aggregate with a version of 2 or higher."
    });
    staleAggregate.updateStatus('APPROVED', 'approver'); // bumps aggregate version to 3, expects DB to be 2. Wait, the check is existing.version !== data.version - 1. So if data.version is 2, it expects DB to be 1. DB is 2. So they mismatch.

    // Actually, if we just instantiate an aggregate with version 2 and call update, the repository concurrency check \`existing.version !== data.version - 1\` (or similar) will fail because data.version is 2 (so data.version - 1 = 1) but existing in DB is 2.
    const conflictAggregate = new Claim({
      id: saved!.id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimCode: saved!.claimCode,
      name: saved!.name,
      claimAmountCents: saved!.claimAmountCents,
      status: saved!.status,
      version: 2 // This is the stale version we read earlier (before update). Wait, after update, DB is version 2.
    });

    await assert.rejects(
      async () => {
        await claimRepo.update(conflictAggregate, tenantA);
      },`
);

// Fix 2: the E2E POST payload
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
  `    assert.strictEqual(createResult.status, 201);
    assert.strictEqual(createResult.body.success, true);
    assert.strictEqual((createResult.body as any).status, 'raised');`,
  `    assert.strictEqual(createResult.status, 201);
    assert.strictEqual(createResult.body.success, true);
    assert.strictEqual((createResult.body as any).status, 'SUBMITTED');`
);

content = content.replace(
  `    assert.strictEqual(validateResult.status, 200);
    assert.strictEqual(validateResult.body.success, true);
    assert.strictEqual((validateResult.body as any).status, 'validated');`,
  `    assert.strictEqual(validateResult.status, 200);
    assert.strictEqual(validateResult.body.success, true);
    assert.strictEqual((validateResult.body as any).status, 'UNDER_REVIEW');`
);

content = content.replace(
  `    assert.strictEqual(approveResult.status, 200);
    assert.strictEqual(approveResult.body.success, true);
    assert.strictEqual((approveResult.body as any).status, 'approved');`,
  `    assert.strictEqual(approveResult.status, 200);
    assert.strictEqual(approveResult.body.success, true);
    assert.strictEqual((approveResult.body as any).status, 'APPROVED');`
);

content = content.replace(
  `    assert.strictEqual(auditRows.rows[0].action, 'raised');
    assert.strictEqual(auditRows.rows[3].action, 'settle');`,
  `    assert.strictEqual(auditRows.rows[0].action, 'SUBMITTED');
    assert.strictEqual(auditRows.rows[3].action, 'settle');`
);

content = content.replace(
  `    assert.strictEqual(outboxRows.rows[0].event_type, 'claim.raised');
    assert.strictEqual(outboxRows.rows[3].event_type, 'claim.settled');`,
  `    assert.strictEqual(outboxRows.rows[0].event_type, 'claim.SUBMITTED');
    assert.strictEqual(outboxRows.rows[3].event_type, 'claim.settled');`
);


fs.writeFileSync(filepath, content);
console.log('fixed claim tests');
