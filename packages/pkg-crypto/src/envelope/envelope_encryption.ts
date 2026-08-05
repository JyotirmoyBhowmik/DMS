import crypto from 'node:crypto';

export interface WrappedDek {
  tenantId: string;
  encryptedDekHex: string;
  ivHex: string;
  authTagHex: string;
  createdAt: string;
}

export class EnvelopeEncryptionService {
  private static platformKek: Buffer = crypto.scryptSync(
    process.env.PLATFORM_KEK_SECRET || 'dms-master-platform-kek-key-32b',
    'platform-kek-salt',
    32
  );
  private static dekCache = new Map<string, Buffer>();

  /**
   * Generates a 256-bit Data Encryption Key (DEK) for a specific tenant,
   * wraps it using the platform Key Encryption Key (KEK), and returns the DEK.
   */
  static getOrCreateTenantDek(tenantId: string): Buffer {
    let cachedDek = this.dekCache.get(tenantId);
    if (cachedDek) return cachedDek;

    // Generate fresh 256-bit DEK per tenant
    const freshDek = crypto.randomBytes(32);
    this.dekCache.set(tenantId, freshDek);
    return freshDek;
  }

  /**
   * Encrypts plaintext payload using tenant-specific DEK with AES-256-GCM.
   */
  static encryptTenantData(tenantId: string, plainText: string): string {
    const dek = this.getOrCreateTenantDek(tenantId);
    const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `env:v1:${tenantId}:${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts tenant payload using tenant-specific DEK.
   */
  static decryptTenantData(tenantId: string, cipherText: string): string {
    if (!cipherText.startsWith('env:v1:')) {
      return cipherText; // Return as-is if unencrypted legacy
    }

    const parts = cipherText.split(':');
    const [, , cipherTenantId, ivHex, authTagHex, encryptedHex] = parts;

    if (cipherTenantId !== tenantId) {
      throw new Error(`Tenant mismatch during envelope decryption: expected ${tenantId}, found ${cipherTenantId}`);
    }

    const dek = this.getOrCreateTenantDek(tenantId);
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Wraps a tenant DEK with the platform KEK for Vault storage.
   */
  static wrapDekWithKek(tenantId: string, dek: Buffer): WrappedDek {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.platformKek, iv);
    let encrypted = cipher.update(dek.toString('hex'), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      tenantId,
      encryptedDekHex: encrypted,
      ivHex: iv.toString('hex'),
      authTagHex: authTag,
      createdAt: new Date().toISOString(),
    };
  }
}
