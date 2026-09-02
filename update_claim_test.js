const fs = require('fs');

const path = 'services/claims-service/src/claims_slice.test.ts';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `  // ─── 2. REPOSITORY INTEGRATION TESTS ───────────────────────────────────────
  test('Repo: Save, find, update claims, audit log creation, and optimistic locking', async () => {
    if (!isDbAvailable) return;
    const entity = new ClaimEntity({
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
    assert.strictEqual(updated.status, 'validated');

    // 4. Update with stale version (Optimistic Locking failure)
    saved.version = 1; // stale version
    await assert.rejects(
      async () => {
        await claimRepo.update(saved, tenantA);
      },`;

const replacement = `  // ─── 2. REPOSITORY INTEGRATION TESTS ───────────────────────────────────────
  test('Repo: Save, find, update claims, audit log creation, and optimistic locking', async () => {
    if (!isDbAvailable) return;
    const entity = new Claim({
      id: '00000000-0000-0000-0000-000000000300',
      tenantId: tenantA,
      distributorId,
      schemeId,
      name: 'Test Claim',
      claimCode: 'CLM-TEST-001',
      claimAmountCents: 12000,
      status: 'SUBMITTED',
      version: 1,
    });

    // 1. Save
    await claimRepo.save(entity, tenantA);

    // 2. Find
    const saved: any = await claimRepo.findById(tenantA, entity.id);
    assert.strictEqual(saved.id, entity.id);
    assert.strictEqual(saved.version, 1);

    // 3. Update (Optimistic Locking success)
    saved.updateStatus('UNDER_REVIEW');
    await claimRepo.update(saved, tenantA);
    const updated: any = await claimRepo.findById(tenantA, entity.id);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.status, 'UNDER_REVIEW');

    // 4. Update with stale version (Optimistic Locking failure)
    const staleClaim = new Claim({
      ...saved.toJSON(),
      version: 1 // Simulate staleness
    });
    await assert.rejects(
      async () => {
        await claimRepo.update(staleClaim, tenantA);
      },`;

content = content.replace(targetStr, replacement);
content = content.replace("import { ClaimEntity } from './domain/entities/claim.entity.js';", "import { ClaimEntity } from './domain/entities/claim.entity.js';\nimport { Claim } from './domain/entities/claim.js';");

fs.writeFileSync(path, content, 'utf8');
