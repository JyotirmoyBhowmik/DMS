with open("services/claims-service/src/claims_slice.test.ts", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines[-10:]):
    print(f"{len(lines)-10+i+1}: {line}", end='')
