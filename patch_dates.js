const fs = require('fs');
const filepath = 'services/finance-service/src/finance.test.ts';
let content = fs.readFileSync(filepath, 'utf8');

const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g., "2026-09"
const middleOfMonthStr = `${currentMonthStr}-15T00:00:00Z`;

// Replace the hardcoded test dates that rely on matching the period
content = content.replace(/new Date\('2026-06-15'\)/g, `new Date('${middleOfMonthStr}')`);
content = content.replace(/new Date\('2026-07-01'\)/g, `new Date('2027-07-01')`); // Intentional out of bounds test
content = content.replace(/new Date\('2026-06-10'\)/g, `new Date()`);

fs.writeFileSync(filepath, content);
console.log('patched entry dates');
