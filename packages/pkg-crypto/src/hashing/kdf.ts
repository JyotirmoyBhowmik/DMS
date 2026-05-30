import { hkdfSync, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { CryptoError } from '../errors.js';

const scryptAsync = promisify(scryptCb);

/**
 * Derive a key using HKDF-SHA256.
 *
 * @param input  - Input keying material (IKM)
 * @param salt   - Salt (should be random or at least unique)
 * @param info   - Context/application-specific info string
 * @param length - Desired output key length in bytes (default: 32)
 * @returns Derived key as a Buffer
 */
export function deriveKey(
  input: Buffer,
  salt: Buffer,
  info: string,
  length = 32
): Buffer {
  if (input.length === 0) {
    throw new CryptoError('Input keying material must not be empty', 'INVALID_IKM');
  }
  if (length < 1 || length > 255 * 32) {
    throw new CryptoError(
      `Invalid derived key length: ${length}. Must be between 1 and ${255 * 32}`,
      'INVALID_KEY_LENGTH'
    );
  }

  const derived = hkdfSync('sha256', input, salt, info, length);
  return Buffer.from(derived);
}

/**
 * Derive a key from a user passphrase using scrypt.
 *
 * Uses hardened parameters suitable for password-based key derivation:
 * - N (cost): 2^15 = 32768
 * - r (block size): 8
 * - p (parallelization): 1
 * - Output: 32 bytes (256-bit key)
 *
 * @param passphrase - User-supplied passphrase
 * @param salt       - Unique salt (at least 16 bytes recommended)
 * @returns Derived 32-byte key
 */
export async function deriveFromPassphrase(
  passphrase: string,
  salt: Buffer
): Promise<Buffer> {
  if (!passphrase) {
    throw new CryptoError('Passphrase must not be empty', 'INVALID_PASSPHRASE');
  }
  if (salt.length < 16) {
    throw new CryptoError(
      `Salt should be at least 16 bytes; got ${salt.length} bytes`,
      'INVALID_SALT'
    );
  }

  const derived = (await (scryptAsync as any)(passphrase, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024, // 64 MB
  })) as Buffer;

  return derived;
}
