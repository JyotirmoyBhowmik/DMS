import 'reflect-metadata';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ENCRYPTED_METADATA_KEY = 'dms:encrypted';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Marks a property for automatic encryption on write and decryption on read.
 * The ORM transformer uses AesGcmCipher-compatible pack/unpack format.
 */
export function Encrypted(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(ENCRYPTED_METADATA_KEY, true, target, propertyKey);

    const ctor = target.constructor as { __encryptedFields?: string[] };
    if (!ctor.__encryptedFields) {
      ctor.__encryptedFields = [];
    }
    const key = String(propertyKey);
    if (!ctor.__encryptedFields.includes(key)) {
      ctor.__encryptedFields.push(key);
    }
  };
}

/**
 * Returns true if the given property is marked for encryption.
 */
export function isEncrypted(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(ENCRYPTED_METADATA_KEY, target, propertyKey) === true;
}

/**
 * Returns the list of encrypted field names registered on a constructor.
 */
export function getEncryptedFields(ctor: Function): string[] {
  return (ctor as { __encryptedFields?: string[] }).__encryptedFields ?? [];
}

// ── AesGcm-compatible pack/unpack ──────────────────────────────

/**
 * Packs a plaintext string into a single base64 blob containing
 * iv + authTag + ciphertext.  This is interoperable with the
 * AesGcmCipher.pack format used elsewhere in the monorepo.
 */
export function packEncrypted(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  const packed = Buffer.concat([iv, tag, encrypted]);
  return packed.toString('base64');
}

/**
 * Unpacks and decrypts a base64 blob produced by `packEncrypted`.
 */
export function unpackEncrypted(packed: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Creates a TypeORM-compatible value transformer for automatic
 * encrypt-on-write / decrypt-on-read of column values.
 */
export function createEncryptedTransformer(keyHex: string) {
  return {
    to(value: string | null | undefined): string | null {
      if (value === null || value === undefined) return null;
      return packEncrypted(value, keyHex);
    },
    from(value: string | null | undefined): string | null {
      if (value === null || value === undefined) return null;
      return unpackEncrypted(value, keyHex);
    },
  };
}
