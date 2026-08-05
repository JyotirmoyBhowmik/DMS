import { ErpConnectionConfig } from '../erp/erp-port.interface.js';
import { Logger } from '@dms/pkg-logger';
import crypto from 'node:crypto';

export class VaultSecretStore {
  private static mockVaultStorage = new Map<string, string>();
  private readonly vaultAddress: string;
  private readonly vaultToken?: string;

  constructor(private readonly logger: Logger) {
    this.vaultAddress = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
    this.vaultToken = process.env.VAULT_TOKEN;
  }

  /**
   * Stores tenant ERP credentials in Vault at secret/data/tenants/<tenantId>/erp.
   * If Vault is offline or token is unset, falls back to AES-256-GCM envelope encryption.
   */
  async storeTenantErpCredentials(
    tenantId: string,
    credentials: ErpConnectionConfig
  ): Promise<void> {
    const vaultPath = `secret/data/tenants/${tenantId}/erp`;
    const serialized = JSON.stringify(credentials);

    this.logger.info(`[VaultSecretStore] Writing ERP credentials to Vault at ${vaultPath}`);

    try {
      if (this.vaultToken) {
        const response = await fetch(`${this.vaultAddress}/v1/${vaultPath}`, {
          method: 'POST',
          headers: {
            'X-Vault-Token': this.vaultToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: credentials }),
        });

        if (!response.ok) {
          throw new Error(`Vault write returned HTTP ${response.status}`);
        }
        return;
      }
    } catch (err: any) {
      this.logger.warn(`Vault server unreachable, using AES-256-GCM envelope encryption fallback`, {
        error: err.message,
      });
    }

    // AES-256-GCM Encryption Fallback
    const encrypted = this.encryptAesGcm(serialized);
    VaultSecretStore.mockVaultStorage.set(tenantId, encrypted);
  }

  /**
   * Retrieves tenant ERP credentials from Vault path.
   */
  async getTenantErpCredentials(tenantId: string): Promise<ErpConnectionConfig | null> {
    const vaultPath = `secret/data/tenants/${tenantId}/erp`;

    try {
      if (this.vaultToken) {
        const response = await fetch(`${this.vaultAddress}/v1/${vaultPath}`, {
          headers: { 'X-Vault-Token': this.vaultToken },
        });

        if (response.ok) {
          const json = await response.json() as any;
          return json?.data?.data as ErpConnectionConfig;
        }
      }
    } catch {
      // Fall through to encrypted storage
    }

    const encrypted = VaultSecretStore.mockVaultStorage.get(tenantId);
    if (!encrypted) return null;

    try {
      const decrypted = this.decryptAesGcm(encrypted);
      return JSON.parse(decrypted) as ErpConnectionConfig;
    } catch (err: any) {
      this.logger.error(`Failed to decrypt tenant ERP credentials`, { tenantId, error: err.message });
      return null;
    }
  }

  private encryptAesGcm(plainText: string): string {
    const key = crypto.scryptSync('dms-vault-secret-key-32-chars-long', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decryptAesGcm(cipherText: string): string {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    const key = crypto.scryptSync('dms-vault-secret-key-32-chars-long', 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
