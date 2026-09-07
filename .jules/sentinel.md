## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.

## 2024-05-18 - Vault Secret Key Hardcoding
**Vulnerability:** A hardcoded 32-character secret key (`dms-vault-secret-key-32-chars-long`) was found in `VaultSecretStore` for fallback AES-256-GCM encryption.
**Learning:** Hardcoded keys expose sensitive fallback encrypted ERP credentials to anyone with access to the source code. Replacing encryption keys requires backwards compatibility logic to continue decrypting previously stored data to prevent data-loss regressions.
**Prevention:** Always source encryption keys from environment variables or a secure secret manager. When rotating keys or moving from hardcoded to environment variables, ensure decryption logic attempts the new key first but falls back to the old key if decryption fails, while new encryptions enforce the use of the secure new key.
