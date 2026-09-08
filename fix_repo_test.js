const fs = require('fs');
const filepath = 'services/claims-service/src/claims_slice.test.ts';
let content = fs.readFileSync(filepath, 'utf8');

// There are TWO different Claim models in the project?!
// One is ClaimEntity/ClaimAggregate and the other is `Claim` in `domain/entities/claim.js`
// The repository uses `Claim` which is what the memory warned about!

// Add import for Claim
if (!content.includes("import { Claim }")) {
  content = content.replace("import { ClaimEntity } from './domain/entities/claim.entity.js';", "import { ClaimEntity } from './domain/entities/claim.entity.js';\nimport { Claim } from './domain/entities/claim.js';");
}

// Revert the previous Repo save and update logic to use `Claim` instead of `ClaimAggregate`.
content = content.replace(/const claimToSave = new ClaimAggregate\(/g, 'const claimToSave = new Claim(');
content = content.replace(/updated\.status/g, 'updated.toJSON().status');
content = content.replace(/updated\.version/g, 'updated.toJSON().version');

content = content.replace(
  `// 4. Update with stale version (Optimistic Locking failure)
    // Create a stale aggregate instance instead of directly mutating version
    const staleAggregate = new ClaimAggregate({
      id: saved.id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimCode: saved.claimCode,
      name: saved.name,
      claimAmountCents: saved.claimAmountCents,
      status: saved.status,
      version: 2, // stale, should be 2, database is now 2, we simulate conflict by trying to save version 2 again, meaning we expected db to be 1. Wait, memory says "To properly simulate a concurrency conflict and trigger a ConcurrencyError in tests, you must instantiate the stale aggregate with a version of 2 or higher."
    });
    staleAggregate.updateStatus('APPROVED', 'approver'); // bumps aggregate version to 3, expects DB to be 2. Wait, the check is existing.version !== data.version - 1. So if data.version is 2, it expects DB to be 1. DB is 2. So they mismatch.

    // Actually, if we just instantiate an aggregate with version 2 and call update, the repository concurrency check \`existing.version !== data.version - 1\` (or similar) will fail because data.version is 2 (so data.version - 1 = 1) but existing in DB is 2.
    const conflictAggregate = new ClaimAggregate({
      id: saved.id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimCode: saved.claimCode,
      name: saved.name,
      claimAmountCents: saved.claimAmountCents,
      status: saved.status,
      version: 2 // This is the stale version we read earlier (before update). Wait, after update, DB is version 2.
    });

    await assert.rejects(
      async () => {
        await claimRepo.update(conflictAggregate, tenantA);
      },`,
  `// 4. Update with stale version (Optimistic Locking failure)
    const json = saved.toJSON();
    const staleAggregate = new Claim({
      id: json.id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimCode: json.claimCode,
      name: json.name,
      claimAmountCents: json.claimAmountCents,
      status: json.status,
      version: 2, // stale
    });

    await assert.rejects(
      async () => {
        await claimRepo.update(staleAggregate, tenantA);
      },`
);

content = content.replace(/updated = await claimRepo\.findById\(tenantA, saved\.id\) as ClaimAggregate;/g, `updated = await claimRepo.findById(tenantA, saved.id) as Claim;`);

fs.writeFileSync(filepath, content);
console.log('fixed repo tests');
