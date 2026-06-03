import { generateKeyPairSync, createPublicKey } from 'node:crypto';

export interface KeyRecord {
  kid: string;
  privateKey: string;
  publicKey: string;
  createdAt: number;
  expiresAt: number;
}

export class KeyManager {
  private static instance: KeyManager | null = null;
  private keys: KeyRecord[] = [];
  private keyLifetimeMs = 24 * 3600 * 1000; // 24 hours default key life

  private constructor() {
    this.rotate(); // Generate initial key
  }

  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  /**
   * Generates a new RSA keypair, makes it the active signing key, and keeps the old one for verification.
   */
  rotate(): KeyRecord {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const now = Date.now();
    const kid = `kid-${now}-${Math.random().toString(36).substring(2, 7)}`;
    
    const newKey: KeyRecord = {
      kid,
      privateKey,
      publicKey,
      createdAt: now,
      expiresAt: now + this.keyLifetimeMs,
    };

    // Prepend so the latest is always first
    this.keys.unshift(newKey);

    // Keep only the last 3 keys to allow grace periods while cleaning up expired keys
    if (this.keys.length > 3) {
      this.keys = this.keys.slice(0, 3);
    }

    return newKey;
  }

  /**
   * Retrieves the current active key for signing. Rotates automatically if the active key has expired.
   */
  getSigningKey(): KeyRecord {
    const active = this.keys[0];
    if (!active || Date.now() >= active.expiresAt) {
      return this.rotate();
    }
    return active;
  }

  /**
   * Retrieves a verification public key by its Key ID.
   */
  getPublicKey(kid: string): string | null {
    const record = this.keys.find((k) => k.kid === kid);
    return record ? record.publicKey : null;
  }

  /**
   * Exports all active public keys in JSON Web Key (JWK) format.
   */
  getJwks(): { keys: Array<Record<string, unknown>> } {
    const jwkList = this.keys.map((k) => {
      const keyObj = createPublicKey(k.publicKey);
      const jwk = keyObj.export({ format: 'jwk' }) as Record<string, unknown>;
      return {
        kty: jwk.kty,
        kid: k.kid,
        use: 'sig',
        alg: 'RS256',
        n: jwk.n,
        e: jwk.e,
      };
    });

    return { keys: jwkList };
  }

  /**
   * Resets the key manager (useful for tests).
   */
  clear(): void {
    this.keys = [];
    this.rotate();
  }
}
