## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.
## 2024-10-31 - Use crypto module for secure ID generation in Node.js
**Vulnerability:** Use of `Math.random()` to generate mapping IDs in API Gateway, which can lead to predictable IDs (IDOR/enumeration risks).
**Learning:** `Math.random()` is cryptographically weak.
**Prevention:** In Node.js environments, use the built-in `crypto` module (e.g. `crypto.randomBytes(4).toString('hex')` or `crypto.randomUUID()`) to generate secure internal identifiers instead of relying on `Math.random()`.
