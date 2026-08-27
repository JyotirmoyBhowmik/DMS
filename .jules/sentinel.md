## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.

## 2024-05-18 - Vault Fallback Key Rotation and Backward Compatibility
**Vulnerability:** A hardcoded symmetric encryption key (`dms-vault-secret-key-32-chars-long`) was used for encrypting ERP credentials locally when Vault was unavailable.
**Learning:** Fixing hardcoded encryption keys requires more than just swapping in an environment variable. Without a robust key rotation strategy, updating the key will cause the application to permanently lose the ability to decrypt existing historical ciphertexts, breaking production data.
**Prevention:** When replacing hardcoded secrets with environment variables, ensure a secure fail state for new encryptions (throw an error if the secret is missing), but implement a graceful fallback to the legacy key during decryption to prevent data-loss regressions.
