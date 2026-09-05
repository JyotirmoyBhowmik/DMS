with open('services/claims-service/src/claims_slice.test.ts', 'r') as f:
    content = f.read()

content = content.replace("saved.approve(12000);", "saved.updateStatus('APPROVED', 12000);")
content = content.replace("staleClaim.approve(12000);", "staleClaim.updateStatus('APPROVED', 12000);")

with open('services/claims-service/src/claims_slice.test.ts', 'w') as f:
    f.write(content)
