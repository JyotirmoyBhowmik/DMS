const fs = require('fs');
const filepath = 'services/claims-service/src/claims_slice.test.ts';
let content = fs.readFileSync(filepath, 'utf8');

// The domain aggregate is named ClaimAggregate in the test file or needs to be imported.
// Let's check imports.

content = content.replace(/ClaimPgRepository/g, 'ClaimPgRepository');

// Fix 'saved' is possibly null, assert it's not. Fix 'Claim' to 'ClaimAggregate'

content = content.replace(/new Claim\(/g, 'new ClaimAggregate(');

content = content.replace(/const saved = await claimRepo\.findById\(tenantA, entity\.id\);/g, `const saved = await claimRepo.findById(tenantA, entity.id);
    if (!saved) throw new Error('Not found');`);

content = content.replace(/saved!\.updateStatus/g, 'saved.updateStatus');
content = content.replace(/claimRepo\.update\(saved!/g, 'claimRepo.update(saved');
content = content.replace(/saved!\./g, 'saved.');

content = content.replace(/const updated = await claimRepo\.update\(saved, tenantA\);/g, `await claimRepo.update(saved, tenantA);
    const updated = await claimRepo.findById(tenantA, saved.id) as ClaimAggregate;`);

fs.writeFileSync(filepath, content);
console.log('fixed imports and types');
