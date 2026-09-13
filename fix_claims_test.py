import re

with open('services/claims-service/src/claims_slice.test.ts', 'r') as f:
    content = f.read()

# I am undoing the changes in claims_slice.test.ts since it was not needed
# Let's just checkout the file
