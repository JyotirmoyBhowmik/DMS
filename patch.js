const fs = require('fs');
const filepath = 'services/finance-service/src/finance.test.ts';
let content = fs.readFileSync(filepath, 'utf8');

// The test 'PostLedgerEntryUseCase and ReverseLedgerEntryUseCase execution flow'
// invokes the use case that relies on 'new Date()' but the mocked periods
// only cover June and August of 2026.
// Let's modify the seeded periods to cover the current month dynamically.

const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g., "2026-09"
const startDateStr = `${currentMonthStr}-01T00:00:00Z`;
// Get end of month roughly
const endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
const endDateStr = endDate.toISOString();

content = content.replace(/new Date\('2026-06-01'\)/g, `new Date('${startDateStr}')`);
content = content.replace(/new Date\('2026-06-30'\)/g, `new Date('${endDateStr}')`);
content = content.replace(/new Date\('2026-08-01'\)/g, `new Date('${startDateStr}')`);
content = content.replace(/new Date\('2026-08-31'\)/g, `new Date('${endDateStr}')`);

fs.writeFileSync(filepath, content);
console.log('patched');
