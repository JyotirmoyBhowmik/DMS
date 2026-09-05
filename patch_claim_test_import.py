with open('services/claims-service/src/claims_slice.test.ts', 'r') as f:
    content = f.read()

# Add import for Claim
if "import { Claim " not in content and "import { Claim," not in content and "import { Claim }" not in content:
    content = content.replace("import { ClaimEntity } from './domain/entities/claim.entity.js';", "import { ClaimEntity } from './domain/entities/claim.entity.js';\nimport { Claim } from './domain/entities/claim.js';")

with open('services/claims-service/src/claims_slice.test.ts', 'w') as f:
    f.write(content)
