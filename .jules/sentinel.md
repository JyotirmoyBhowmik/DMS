## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.
## 2026-09-13 - Secure Random Values in RN Packages
**Vulnerability:** Insecure Math.random() usage for mutationId in mfa_device_offline_cache.ts
**Learning:** Code destined for React Native (like mobile-sync packages) cannot blindly rely on node:crypto or globalThis.crypto.randomUUID() as it may silently fallback or crash without polyfills. Using Math.random() directly is insecure for mutation/entity IDs.
**Prevention:** Use globalThis.crypto.getRandomValues with a typed array to generate random bytes, map to a hex string, and always include a fallback to Math.random() to prevent crashes in unsupported environments.
