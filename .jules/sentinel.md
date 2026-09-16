## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.
## 2023-10-27 - SQL Injection Risk via SET App Setting
**Vulnerability:** String concatenation was used inside a `SET app.tenant_id = '${tenantId}'` query within the database package to set row-level security variables. While the input was lightly sanitized for SQL quotes and semicolons, it fundamentally bypassed parameterization defenses.
**Learning:** Even with custom string sanitization, injecting dynamic variables into SQL settings poses a risk. The `SET` command in PostgreSQL does not natively support bound parameters in some contexts via Node drivers.
**Prevention:** Always use the native `set_config('setting_name', $1, $2)` function via a `SELECT` query, which natively supports parameterized values and eliminates injection vectors.
