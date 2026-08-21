## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2026-08-11 - Cryptographically Secure Random Values in Mobile Environments
**Vulnerability:** Use of `Math.random()` to generate nonces and mutation IDs for mobile environments (`apps/mobile-rn` and `packages/pkg-mobile-sync`).
**Learning:** React Native and other mobile environments lack support for Node core modules like `node:crypto`.
**Prevention:** Use Web Crypto APIs (`globalThis.crypto.getRandomValues` or `globalThis.crypto.randomUUID()`) when generating nonces, tokens, or UUIDs in code that may run in a mobile environment. Make sure to always implement a `try-catch` fallback to `Math.random()` for older JS runtimes where `crypto` may not be polyfilled.
