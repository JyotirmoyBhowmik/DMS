## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2026-08-23 - Secure Nonce Generation in React Native
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating cryptographic nonces in `apps/mobile-rn/src/session_manager.ts`.
**Learning:** In React Native environments (`apps/mobile-rn`), Node.js core modules like `node:crypto` are not supported. `globalThis.crypto.randomUUID()` should be used, but must include a try/catch fallback to `Math.random()` as it might not be polyfilled correctly on all devices, preventing application crashes.
**Prevention:** Always use Web Crypto API (`globalThis.crypto`) with a safe fallback when generating random values in React Native shared packages to balance security and stability.
