## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.

## 2024-05-18 - React Native Cryptographic Nonce Generation
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating secure nonces in React Native apps, allowing for predictable values.
**Learning:** React Native lacks built-in support for `globalThis.crypto.randomUUID()` without specialized polyfills (like `react-native-get-random-values`), which can lead to silent fallback to `Math.random()`. `globalThis.crypto.getRandomValues()` is generally more robust for mobile environments.
**Prevention:** In React Native, prefer `getRandomValues()` over `randomUUID()`. Always include a fallback for unsupported environments to prevent app crashes while gracefully degrading security.

## 2024-05-27 - Handling Legacy Keys When Rotating Hardcoded Secrets
**Vulnerability:** A fallback KEK (Key Encryption Key) secret was hardcoded into the codebase.
**Learning:** Directly replacing the hardcoded secret with an environment variable for all scenarios can break legacy decryption, leading to data loss for historically wrapped keys.
**Prevention:** When rotating to environment variables, ensure writes STRICTLY enforce the environment variable, while allowing a legacy fallback specifically for read/decrypt scenarios on existing data.

## 2024-05-27 - Removing Hardcoded Legacy Secrets
**Vulnerability:** A fallback KEK (Key Encryption Key) secret was hardcoded into the codebase to support legacy decryptions.
**Learning:** Leaving hardcoded strings in code defeats the purpose of extracting secrets to environment variables, since anyone with access to the codebase can access the legacy key.
**Prevention:** Always inject even legacy or fallback secrets via environment variables (e.g. LEGACY_PLATFORM_KEK_SECRET) to completely eliminate hardcoded secrets from version control.
