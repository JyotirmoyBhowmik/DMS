## 2026-08-10 - Replace Insecure Math.random() with randomBytes()
**Vulnerability:** Weak PRNG (`Math.random()`) used for sensitive security tokens (`jti`, `refreshToken`, `familyId`, `kid`).
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable token generation, making the system vulnerable to token guessing or collision attacks.
**Prevention:** Always use a cryptographically secure random number generator (CSPRNG) like `node:crypto` s `randomBytes()` or `randomUUID()` for generating any sensitive security identifier or token.
## 2026-08-11 - Use timingSafeEqual for secret comparisons
**Vulnerability:** API key hashes were being compared using a manual bitwise loop (`result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i)`).
**Learning:** Manual comparisons for secrets/hashes can be susceptible to subtle V8 JIT optimizations or variations, leading to timing attacks. Standard crypto primitives should always be preferred over manual implementation.
**Prevention:** Always use `timingSafeEqual` from `node:crypto` (converting strings to `Buffer`s if needed) when comparing cryptographic hashes, API keys, or any secrets to ensure constant-time comparison.
