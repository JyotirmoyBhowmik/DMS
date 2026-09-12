## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.
## 2024-05-24 - Remove Hardcoded Encryption Secrets
**Vulnerability:** Core encryption modules (`envelope_encryption.ts` and `vault_secret_store.ts`) relied on hardcoded plaintext secrets as fallbacks.
**Learning:** Hardcoding fallback encryption keys fundamentally defeats the purpose of encryption, as any attacker with source code access can decrypt the data. Fallback mechanisms must be as secure as primary mechanisms.
**Prevention:** Always inject sensitive secrets (even fallbacks) via environment variables or secure secret managers. Implement strict "fail secure" logic by throwing errors when required environment variables are missing, refusing to start in an insecure state.
