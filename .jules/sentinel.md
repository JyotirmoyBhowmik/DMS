## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2026-08-20 - Secure PRNG in React Native
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive identifiers in mobile packages.
**Learning:** `node:crypto` cannot be used in React Native environments, requiring Web Crypto APIs.
**Prevention:** Use `globalThis.crypto.randomUUID()` with a safe fallback to `Math.random()` to ensure both security and application stability in mobile environments.
