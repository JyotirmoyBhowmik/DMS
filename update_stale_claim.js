const fs = require('fs');
const path = 'services/claims-service/src/claims_slice.test.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
`    const staleClaim = new Claim({
      ...saved.toJSON(),
      version: 1 // Simulate staleness
    });`,
`    const staleClaim = new Claim({
      ...saved.toJSON(),
      version: 2 // Simulate staleness: the updated entity is version 2, so a save with version 2 means existing.version (2) !== data.version - 1 (1)
    });`
);
fs.writeFileSync(path, content, 'utf8');
