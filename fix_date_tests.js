const fs = require('fs');
const filepath = 'services/finance-service/src/finance.test.ts';
let content = fs.readFileSync(filepath, 'utf8');

const now = new Date();
const currentMonthStr = now.toISOString().slice(0, 7); // e.g., "2026-09"
const middleOfMonthStr = `${currentMonthStr}-15T00:00:00.000Z`;
const startOfMonthStr = `${currentMonthStr}-01T00:00:00.000Z`;

// Fix "Should validate credit limit checks" and "Should throw error if period is closed or date is outside period"
content = content.replace(/new Date\('2026-06-15'\)/g, `new Date('${middleOfMonthStr}')`);
content = content.replace(/new Date\('2027-07-01'\)/g, `new Date('2027-07-01')`); // this was correct for outside period
content = content.replace(/new Date\('2026-06-10'\)/g, `new Date('${middleOfMonthStr}')`); // "PostLedgerEntryUseCase and ReverseLedgerEntryUseCase execution flow"

// Re-write to ensure all mocked periods dynamically cover the current month correctly:
content = content.replace(/startDate: new Date\('.*01T00:00:00Z'\),/g, `startDate: new Date('${startOfMonthStr}'),`);

const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
const endOfMonthStr = endOfMonth.toISOString();
content = content.replace(/endDate: new Date\('.*23:59:59.*Z'\),/g, `endDate: new Date('${endOfMonthStr}'),`);

fs.writeFileSync(filepath, content);
console.log('fixed tests with dynamic periods covering ' + middleOfMonthStr);
