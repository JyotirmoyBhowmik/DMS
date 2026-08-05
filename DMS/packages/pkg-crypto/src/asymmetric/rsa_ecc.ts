import {
  randomBytes,
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
  createPublicKey,
  createPrivateKey,
  createECDH,
  constants,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { AesGcmCipher } from '../symmetric/aes_gcm.js';
import { InMemoryKeyProvider } from '../keys/vault_client.js';
import { CryptoError } from '../errors.js';
import type { SealedPayload } from '../symmetric/aes_gcm.js';

const DEK_LENGTH = 32; // 256-bit data encryption key
const DEK_KEY_ID = '__envelope_dek__';

/** Reference to a PEM-encoded public or private key. */
export interface KeyRef {
  /** PEM-encoded key string */
  pem: string;
  /** Key algorithm hint — optional, auto-detected from PEM if omitted */
  algo?: 'rsa-2048' | 'ec-p256';
}

export interface EnvelopeResult {
  /** DEK wrapped (encrypted) with the recipient's public key */
  wrappedDek: Buffer;
  /** AES-GCM sealed payload (plaintext encrypted with the DEK) */
  payload: SealedPayload;
}

export class EnvelopeCipher {
  /**
   * Seal an envelope:
   * 1. Generate a random 256-bit DEK.
   * 2. Encrypt plaintext with AES-256-GCM using the DEK.
   * 3. Wrap (encrypt) the DEK with the recipient's RSA public key using OAEP-SHA256.
   */
  async sealEnvelope(
    plaintext: Buffer,
    recipientPubKey: KeyRef
  ): Promise<EnvelopeResult> {
    const dek = randomBytes(DEK_LENGTH);

    // Encrypt plaintext with AES-GCM
    const keyProvider = new InMemoryKeyProvider({ [DEK_KEY_ID]: dek });
    const cipher = new AesGcmCipher(keyProvider);
    const payload = await cipher.encrypt(plaintext, { keyId: DEK_KEY_ID });

    // Wrap the DEK with the recipient's public key
    const wrappedDek = this.wrapKey(dek, recipientPubKey);

    // Zero the DEK in memory
    dek.fill(0);

    return { wrappedDek, payload };
  }

  /**
   * Open an envelope:
   * 1. Unwrap the DEK with the recipient's private key.
   * 2. Decrypt the AES-GCM payload using the unwrapped DEK.
   */
  async openEnvelope(
    env: EnvelopeResult,
    privKey: KeyRef
  ): Promise<Buffer> {
    const dek = this.unwrapKey(env.wrappedDek, privKey);

    const keyProvider = new InMemoryKeyProvider({ [DEK_KEY_ID]: dek });
    const cipher = new AesGcmCipher(keyProvider);
    const plaintext = await cipher.decrypt(env.payload, { keyId: DEK_KEY_ID });

    // Zero the DEK in memory
    dek.fill(0);

    return plaintext;
  }

  /**
   * Generate a key pair for envelope encryption.
   * Supports RSA-2048 and EC P-256.
   */
  async generateKeyPair(
    algo: 'rsa-2048' | 'ec-p256'
  ): Promise<{ publicKey: string; privateKey: string }> {
    if (algo === 'rsa-2048') {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return { publicKey, privateKey };
    }

    if (algo === 'ec-p256') {
      const { publicKey, privateKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return { publicKey, privateKey };
    }

    throw new CryptoError(`Unsupported algorithm: ${algo as string}`, 'UNSUPPORTED_ALGO');
  }

  /**
   * Wrap (encrypt) a DEK using the recipient's public key.
   * RSA: RSA-OAEP with SHA-256 padding.
   * EC: ECIES-style — ephemeral ECDH + HKDF + AES-GCM.
   */
  private wrapKey(dek: Buffer, pubKeyRef: KeyRef): Buffer {
    const pubKeyObj = createPublicKey(pubKeyRef.pem);
    const keyType = pubKeyObj.asymmetricKeyType;

    if (keyType === 'rsa') {
      return publicEncrypt(
        {
          key: pubKeyObj,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        dek
      );
    }

    if (keyType === 'ec') {
      // ECIES-style envelope:
      // 1. Generate ephemeral EC key pair
      // 2. Derive shared secret via ECDH
      // 3. Use shared secret as AES key to wrap the DEK
      // 4. Return: ephemeral public key || iv || encrypted DEK || auth tag
      const ephemeral = createECDH('prime256v1');
      ephemeral.generateKeys();

      const ephemeralPubKey = ephemeral.getPublicKey();

      // Export the recipient's raw public key for ECDH
      const recipientRawPub = pubKeyObj.export({ type: 'spki', format: 'der' });

      // Compute shared secret using the ephemeral private key and recipient public key
      const sharedSecret = ephemeral.computeSecret(
        extractEcRawPublicKey(recipientRawPub)
      );

      // Use first 32 bytes of SHA-256(sharedSecret) as wrapping key
      const wrappingKey = createHash('sha256').update(sharedSecret).digest();

      const keyProvider = new InMemoryKeyProvider({ wrap: wrappingKey });
      const cipher = new AesGcmCipher(keyProvider);

      // Synchronous usage through a workaround — run encrypt eagerly
      const iv = randomBytes(12);
      const aes = createCipheriv('aes-256-gcm', wrappingKey, iv, { authTagLength: 16 });
      const enc = Buffer.concat([aes.update(dek), aes.final()]);
      const tag = aes.getAuthTag();

      // Pack: [ephemeralPubKeyLen(1 byte)][ephemeralPubKey][iv][tag][encryptedDek]
      const lenBuf = Buffer.alloc(1);
      lenBuf[0] = ephemeralPubKey.length;
      return Buffer.concat([lenBuf, ephemeralPubKey, iv, tag, enc]);
    }

    throw new CryptoError(
      `Unsupported asymmetric key type for wrapping: ${String(keyType)}`,
      'UNSUPPORTED_KEY_TYPE'
    );
  }

  /**
   * Unwrap (decrypt) a wrapped DEK using the recipient's private key.
   */
  private unwrapKey(wrappedDek: Buffer, privKeyRef: KeyRef): Buffer {
    const privKeyObj = createPrivateKey(privKeyRef.pem);
    const keyType = privKeyObj.asymmetricKeyType;

    if (keyType === 'rsa') {
      return privateDecrypt(
        {
          key: privKeyObj,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        wrappedDek
      );
    }

    if (keyType === 'ec') {
      // ECIES unwrap: reverse the wrapping process
      const ephemeralPubKeyLen = wrappedDek[0]!;
      let offset = 1;
      const ephemeralPubKey = wrappedDek.subarray(offset, offset + ephemeralPubKeyLen);
      offset += ephemeralPubKeyLen;
      const iv = wrappedDek.subarray(offset, offset + 12);
      offset += 12;
      const tag = wrappedDek.subarray(offset, offset + 16);
      offset += 16;
      const encryptedDek = wrappedDek.subarray(offset);

      // Derive shared secret
      const ecdh = createECDH('prime256v1');
      const privKeyDer = privKeyObj.export({ type: 'pkcs8', format: 'der' });
      const rawPrivKey = extractEcRawPrivateKey(privKeyDer);
      ecdh.setPrivateKey(rawPrivKey);

      const sharedSecret = ecdh.computeSecret(ephemeralPubKey);

      // Derive wrapping key
      const wrappingKey = createHash('sha256').update(sharedSecret).digest();

      const decipher = createDecipheriv('aes-256-gcm', wrappingKey, iv, {
        authTagLength: 16,
      });
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encryptedDek), decipher.final()]);
    }

    throw new CryptoError(
      `Unsupported asymmetric key type for unwrapping: ${String(keyType)}`,
      'UNSUPPORTED_KEY_TYPE'
    );
  }
}

/**
 * Extract raw uncompressed EC public key from SPKI DER encoding.
 * The raw key is the bit-string payload (65 bytes for P-256 uncompressed).
 */
function extractEcRawPublicKey(spkiDer: Buffer): Buffer {
  // For P-256 SPKI, the raw key starts after a fixed 26-byte header
  // Sequence → Sequence(OID + OID) → BitString(04 || x || y)
  // The last 65 bytes are the uncompressed point (0x04 prefix + 32-byte x + 32-byte y)
  const raw = spkiDer.subarray(spkiDer.length - 65);
  if (raw[0] !== 0x04) {
    throw new CryptoError('Expected uncompressed EC public key (0x04 prefix)', 'INVALID_KEY_FORMAT');
  }
  return raw;
}

/**
 * Extract raw EC private key (32-byte scalar) from PKCS#8 DER.
 */
function extractEcRawPrivateKey(pkcs8Der: Buffer): Buffer {
  // For P-256 PKCS#8, locate the OCTET STRING containing the ECPrivateKey
  // Search for the 32-byte private key value inside the nested structure
  // The private key scalar is typically found after the EC params
  // Look for 0x04 0x20 (OCTET STRING of length 32)
  for (let i = 0; i < pkcs8Der.length - 33; i++) {
    if (pkcs8Der[i] === 0x04 && pkcs8Der[i + 1] === 0x20) {
      const candidate = pkcs8Der.subarray(i + 2, i + 34);
      // Verify it's not all zeros
      if (candidate.some((b) => b !== 0)) {
        return candidate;
      }
    }
  }
  throw new CryptoError('Could not extract EC private key from PKCS#8 DER', 'INVALID_KEY_FORMAT');
}
