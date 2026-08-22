## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.
## 2023-10-27 - Predictable request nonce in session manager
**Vulnerability:** The session manager in `apps/mobile-rn` was using `Math.random()` to generate nonces for signing HTTP requests. `Math.random()` is not cryptographically secure and can be predicted, potentially leading to replay attacks or signature forgery if the client secret key generation is weak or compromised.
**Learning:** React Native environments might not natively support Node.js core modules like `node:crypto`.
**Prevention:** Use Web Crypto APIs (`globalThis.crypto.getRandomValues` or `globalThis.crypto.randomUUID()`) when generating secure random values in React Native environments, and ensure a safe fallback to `Math.random()` is included to prevent crashes when the Web Crypto API is unavailable.
