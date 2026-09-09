import re

with open('services/finance-service/src/finance.test.ts', 'r') as f:
    content = f.read()

# Fix the entry to use new Date() so it aligns with the mocked current period,
# instead of the hardcoded 2026-06-10 date which falls outside the dynamic current period.
content = re.sub(
    r"postedAt: new Date\('2026-06-10'\),",
    r"postedAt: new Date(),",
    content
)

with open('services/finance-service/src/finance.test.ts', 'w') as f:
    f.write(content)
