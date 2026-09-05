import re

with open('services/finance-service/src/finance.test.ts', 'r') as f:
    content = f.read()

# Replace the hardcoded period setup with a dynamic one that includes the current month
replacement = """
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();

      const p2Start = new Date(Date.UTC(currentYear, currentMonth, 1));
      const p2End = new Date(Date.UTC(currentYear, currentMonth + 1, 0));

      await repo.savePeriod(new LedgerPeriod({
        id: 'p2',
        tenantId,
        startDate: p2Start,
        endDate: p2End,
        status: 'OPEN'
      }), tenantId);
"""

# Find the block where `p2` is seeded and replace it
content = re.sub(
    r"await repo\.savePeriod\(new LedgerPeriod\(\{\s*id:\s*'p2'[\s\S]*?\}\),\s*tenantId\);",
    replacement.strip(),
    content
)

with open('services/finance-service/src/finance.test.ts', 'w') as f:
    f.write(content)
