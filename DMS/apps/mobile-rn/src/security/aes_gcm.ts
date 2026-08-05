import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PACK_VERSION = 'v1';

export interface SealedPayload {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
  aad?: Buffer;
}

export class AesGcm {
  /**
   * Encrypt plaintext using AES-256-GCM.
   */
  static encrypt(plaintext: Buffer, key: Buffer, aad?: Buffer): SealedPayload {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes`);
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    if (aad) {
      cipher.setAAD(aad);
    }

    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      iv,
      ciphertext,
      authTag,
      aad,
    };
  }

  /**
   * Decrypt a SealedPayload using AES-256-GCM.
   */
  static decrypt(sealed: SealedPayload, key: Buffer): Buffer {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes`);
    }

    const decipher = createDecipheriv(ALGORITHM, key, sealed.iv, {
      authTagLength: TAG_LENGTH,
    });

    if (sealed.aad) {
      decipher.setAAD(sealed.aad);
    }

    decipher.setAuthTag(sealed.authTag);

    try {
      return Buffer.concat([
        decipher.update(sealed.ciphertext),
        decipher.final(),
      ]);
    } catch (err: unknown) {
      throw new Error('AES-GCM decryption failed: authentication tag verification failed');
    }
  }

  /**
   * Serialize SealedPayload to compact string token.
   * Format: 'v1.<iv_base64url>.<ciphertext_base64url>.<authTag_base64url>'
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
      throw new Error(`Invalid sealed token format: expected 4 parts, got ${parts.length}`);
    }

    const [version, ivB64, ctB64, tagB64] = parts as [string, string, string, string];
    if (version !== PACK_VERSION) {
      throw new Error(`Unsupported token version: "${version}"`);
    }

    const iv = Buffer.from(ivB64, 'base64url');
    const ciphertext = Buffer.from(ctB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (authTag.length !== TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${TAG_LENGTH}, got ${authTag.length}`);
    }

    return { iv, ciphertext, authTag };
  }
}
