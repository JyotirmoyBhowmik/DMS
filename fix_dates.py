import re

with open('services/finance-service/src/finance.test.ts', 'r') as f:
    content = f.read()

content = re.sub(
    r"await repo\.savePeriod\(new LedgerPeriod\(\{.*?id: 'p1'.*?\}\), tenantId\);",
    r"""await repo.savePeriod(new LedgerPeriod({
        id: 'p1',
        tenantId,
        startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
        status: 'OPEN'
      }), tenantId);""",
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"await repo\.savePeriod\(new LedgerPeriod\(\{.*?id: 'p2'.*?\}\), tenantId\);",
    r"""await repo.savePeriod(new LedgerPeriod({
        id: 'p2',
        tenantId,
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        status: 'OPEN'
      }), tenantId);""",
    content,
    flags=re.DOTALL
)

with open('services/finance-service/src/finance.test.ts', 'w') as f:
    f.write(content)
