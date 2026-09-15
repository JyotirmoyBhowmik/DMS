## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.

## 2024-11-20 - Refactor Hardcoded Secrets into Lazy Getters
**Vulnerability:** A fallback secret (`dms-master-platform-kek-key-32b`) was hardcoded as a static class property for the Key Encryption Key (KEK) derivation in `EnvelopeEncryptionService`.
**Learning:** Hardcoding fallback secrets bypasses intended environment variable configurations. Furthermore, evaluating cryptographic derivations (like `crypto.scryptSync`) directly on static class properties forces them to run at module load time. This can happen before environment loaders (like `dotenv`) have populated `process.env`, causing the application to silently fall back to the insecure hardcoded key instead of using the injected secrets.
**Prevention:** Remove hardcoded fallback secrets. Use lazy initialization (via a getter or factory function) for cryptographic keys so they are evaluated at runtime (e.g., upon first use) when `process.env` is guaranteed to be fully populated. Always throw an explicit error if required secrets are missing to enforce a fail-safe security posture.
