## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2026-08-14 - Predictable Nonce in Cryptographic Request Signing
**Vulnerability:** The mobile React Native client (`apps/mobile-rn/src/session_manager.ts`) was using `Math.random().toString(36).substring(2, 15)` to generate a nonce for its cryptographic request signature (X-DMS-Signature).
**Learning:** `Math.random()` is predictable. If an attacker can guess the nonce, they may be able to replay requests or bypass timing protections depending on how the signature is validated server-side.
**Prevention:** Always use a CSPRNG such as `randomBytes` from the `crypto` module when generating nonces, IVs, or any randomness used in cryptographic operations.
