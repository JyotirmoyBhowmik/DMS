import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { IntegrityError, CryptoError } from '../errors.js';
import type { KeyProvider } from '../keys/vault_client.js';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PACK_VERSION = 'v1';

export interface SealedPayload {
  /** 12-byte random nonce */
  iv: Buffer;
  /** Encrypted data */
  ciphertext: Buffer;
  /** 16-byte GCM authentication tag */
  authTag: Buffer;
  /** Optional additional authenticated data */
  aad?: Buffer;
}

export interface EncryptOptions {
  keyId?: string;
  aad?: Buffer;
}

export interface DecryptOptions {
  keyId?: string;
}

function assertKeyLength(key: Buffer): void {
  if (key.length !== KEY_LENGTH) {
    throw new CryptoError(
      `Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length} bytes`,
      'INVALID_KEY_LENGTH'
    );
  }
}

export class AesGcmCipher {
  constructor(private readonly keyProvider: KeyProvider) {}

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Generates a cryptographically random 12-byte IV for each encryption.
   */
  async encrypt(plaintext: Buffer, opts?: EncryptOptions): Promise<SealedPayload> {
    const key = await this.keyProvider.getKey(opts?.keyId);
    assertKeyLength(key);

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    if (opts?.aad) {
      cipher.setAAD(opts.aad);
    }

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      iv,
      ciphertext: encrypted,
      authTag,
      aad: opts?.aad,
    };
  }

  /**
   * Decrypt a SealedPayload using AES-256-GCM.
   * Throws IntegrityError if the authentication tag does not match.
   */
  async decrypt(sealed: SealedPayload, opts?: DecryptOptions): Promise<Buffer> {
    const keyId = opts?.keyId;
    const key = keyId
      ? await this.keyProvider.getKeyForDecrypt(keyId)
      : await this.keyProvider.getKey();
    assertKeyLength(key);

    const decipher = createDecipheriv(ALGORITHM, key, sealed.iv, {
      authTagLength: TAG_LENGTH,
    });

    if (sealed.aad) {
      decipher.setAAD(sealed.aad);
    }

    decipher.setAuthTag(sealed.authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(sealed.ciphertext),
        decipher.final(),
      ]);
      return decrypted;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes('Unsupported state') ||
        message.includes('unable to authenticate') ||
        message.includes('auth')
      ) {
        throw new IntegrityError('AES-GCM authentication tag verification failed');
      }
      throw new CryptoError(`Decryption failed: ${message}`);
    }
  }

  /**
   * Serialize a SealedPayload to a compact string token.
   * Format: 'v1.<base64url(iv)>.<base64url(ciphertext)>.<base64url(authTag)>'
   */
  static pack(sealed: SealedPayload): string {
    const ivB64 = sealed.iv.toString('base64url');
    const ctB64 = sealed.ciphertext.toString('base64url');
    const tagB64 = sealed.authTag.toString('base64url');
    return `${PACK_VERSION}.${ivB64}.${ctB64}.${tagB64}`;
  }

  /**
   * Deserialize a compact token string back into a SealedPayload.
   */
  static unpack(token: string): SealedPayload {
    const parts = token.split('.');
    if (parts.length !== 4) {
      throw new CryptoError(
        `Invalid sealed token format: expected 4 parts, got ${parts.length}`,
        'INVALID_TOKEN_FORMAT'
      );
    }

    const [version, ivB64, ctB64, tagB64] = parts as [string, string, string, string];
    if (version !== PACK_VERSION) {
      throw new CryptoError(
        `Unsupported token version: "${version}"`,
        'UNSUPPORTED_VERSION'
      );
    }

    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(ctB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');

    if (iv.length !== IV_LENGTH) {
      throw new CryptoError(
        `Invalid IV length in token: expected ${IV_LENGTH}, got ${iv.length}`,
        'INVALID_TOKEN_FORMAT'
      );
    }
    if (authTag.length !== TAG_LENGTH) {
      throw new CryptoError(
        `Invalid auth tag length in token: expected ${TAG_LENGTH}, got ${authTag.length}`,
        'INVALID_TOKEN_FORMAT'
      );
    }

    return { iv, ciphertext, authTag };
  }
}
