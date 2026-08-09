## 2026-08-09 - Insecure Randomness in Security Tokens
**Vulnerability:** Weak PRNG (`Math.random()`) used for generating critical security tokens (Refresh Tokens, JWT IDs, Token Family IDs, Key IDs).
**Learning:** Even in core security files (`issue_token.usecase.ts`, `refresh_token.usecase.ts`), developers may default to standard library functions like `Math.random()` for convenience instead of cryptographically secure alternatives, potentially leading to predictable tokens and token hijackings.
**Prevention:** Always mandate the use of `node:crypto` (`randomBytes`, `randomUUID`) for any security-sensitive random generation. Add a static analysis rule (e.g. ESLint `no-math-random`) to catch insecure randomness at build time.
