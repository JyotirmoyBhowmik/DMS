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

// Envelope encryption & PII classifier
export { EnvelopeEncryptionService } from './envelope/envelope_encryption.js';
export type { WrappedDek } from './envelope/envelope_encryption.js';
export { PiiClassifier } from './pii/pii_classifier.js';
export type { SensitiveDataType } from './pii/pii_classifier.js';
export { KekRotatorEngine } from './rotation/kek_rotator.js';
export type { KekRotationLog } from './rotation/kek_rotator.js';
