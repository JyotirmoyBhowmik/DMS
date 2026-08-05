// Errors
export { CryptoError, IntegrityError, KeyNotFoundError } from './errors.js';

// Key management
export { VaultKeyProvider, InMemoryKeyProvider } from './keys/vault_client.js';
export type { KeyProvider } from './keys/vault_client.js';

// Symmetric encryption
export { AesGcmCipher } from './symmetric/aes_gcm.js';
export type { SealedPayload, EncryptOptions, DecryptOptions } from './symmetric/aes_gcm.js';

// Asymmetric / envelope encryption
export { EnvelopeCipher } from './asymmetric/rsa_ecc.js';
export type { KeyRef, EnvelopeResult } from './asymmetric/rsa_ecc.js';

// Hashing & HMAC
export { hmacSha256, verifyHmac, canonicalRequestString } from './hashing/hmac.js';
export type { CanonicalRequestParts } from './hashing/hmac.js';

// Key derivation
export { deriveKey, deriveFromPassphrase } from './hashing/kdf.js';
