import re

with open('services/finance-service/src/finance.test.ts', 'r') as f:
    content = f.read()

content = re.sub(
    r"postedAt: new Date\(\),",
    r"postedAt: new Date(new Date().getFullYear(), new Date().getMonth(), 15),",
    content,
    flags=re.DOTALL
)

with open('services/finance-service/src/finance.test.ts', 'w') as f:
    f.write(content)
