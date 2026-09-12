import re
import datetime

file_path = "services/finance-service/src/finance.test.ts"
with open(file_path, "r") as f:
    content = f.read()

# Wait, the error is still saying "2026-06-10" ! That means there is another one.
print("Looking for 2026-06-10 in file")
