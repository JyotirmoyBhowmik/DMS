with open("services/claims-service/src/claims_slice.test.ts", "r") as f:
    content = f.read()

import re

# We used a regex with `await assert.rejects([\s\S]*?);` that might have eaten too much. Let's fix that.
# Actually let's just reset using git properly if it was tracked. Was it tracked? Yes.
