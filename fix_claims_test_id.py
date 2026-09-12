import re

file_path = "services/claims-service/src/claims_slice.test.ts"
with open(file_path, "r") as f:
    content = f.read()

replacement = """    // 4. Update with stale version (Optimistic Locking failure)
    const staleEntity = new ClaimEntity({
      id: updated ? updated.id : entity.id,
      tenantId: tenantA,
      distributorId,
      schemeId,
      amount: 12000,
      status: 'validated',
      version: 1, // stale
    });"""

content = re.sub(
    r"    // 4\. Update with stale version \(Optimistic Locking failure\)[\s\S]*?version: 1, // stale\n    \}\);",
    replacement,
    content
)

# And wait, does claimRepo.update return anything? Let's check claim.pg-repository.ts
