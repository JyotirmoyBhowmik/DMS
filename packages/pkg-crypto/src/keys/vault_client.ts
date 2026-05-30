import { KeyNotFoundError, CryptoError } from '../errors.js';

/**
 * Abstract provider for symmetric encryption keys.
 * Implementations fetch keys from Vault, KMS, environment, or in-memory stores.
 */
export interface KeyProvider {
  /** Retrieve the key for encryption. If keyId is omitted, the default/current key is used. */
  getKey(keyId?: string): Promise<Buffer>;
  /** Retrieve a specific key version for decryption (key rotation support). */
  getKeyForDecrypt(keyId: string): Promise<Buffer>;
}

/**
 * Production KeyProvider backed by HashiCorp Vault KV v2 engine.
 */
export class VaultKeyProvider implements KeyProvider {
  private readonly vaultUrl: string;
  private readonly token: string;
  private readonly mountPath: string;
  private readonly cache: Map<string, { key: Buffer; expiresAt: number }> = new Map();
  private readonly cacheTtlMs: number;
  private readonly defaultKeyPath: string;

  constructor(opts: {
    vaultUrl?: string;
    token?: string;
    mountPath?: string;
    defaultKeyPath?: string;
    cacheTtlMs?: number;
  } = {}) {
    this.vaultUrl = opts.vaultUrl ?? process.env['VAULT_ADDR'] ?? 'http://127.0.0.1:8200';
    this.token = opts.token ?? process.env['VAULT_TOKEN'] ?? '';
    this.mountPath = opts.mountPath ?? 'secret';
    this.defaultKeyPath = opts.defaultKeyPath ?? 'dms/encryption/current';
    this.cacheTtlMs = opts.cacheTtlMs ?? 300_000; // 5 minutes
  }

  async getKey(keyId?: string): Promise<Buffer> {
    const path = keyId ?? this.defaultKeyPath;
    return this.fetchKey(path);
  }

  async getKeyForDecrypt(keyId: string): Promise<Buffer> {
    return this.fetchKey(keyId);
  }

  private async fetchKey(path: string): Promise<Buffer> {
    const cached = this.cache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key;
    }

    const url = `${this.vaultUrl}/v1/${this.mountPath}/data/${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Vault-Token': this.token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new KeyNotFoundError(path);
      }
      throw new CryptoError(
        `Vault returned HTTP ${response.status} for key path "${path}"`,
        'VAULT_ERROR'
      );
    }

    const body = (await response.json()) as {
      data?: { data?: { key?: string } };
    };

    const hexKey = body?.data?.data?.key;
    if (!hexKey) {
      throw new KeyNotFoundError(path);
    }

    const keyBuffer = Buffer.from(hexKey, 'hex');
    if (keyBuffer.length !== 32) {
      throw new CryptoError(
        `Key at path "${path}" is ${keyBuffer.length} bytes; expected 32 bytes for AES-256`,
        'INVALID_KEY_LENGTH'
      );
    }

    this.cache.set(path, {
      key: keyBuffer,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return keyBuffer;
  }

  /** Clear the in-memory key cache. */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * In-memory KeyProvider for tests and local development.
 */
export class InMemoryKeyProvider implements KeyProvider {
  private readonly keys: Map<string, Buffer>;
  private readonly defaultKeyId: string;

  constructor(keys: Record<string, Buffer>, defaultKeyId?: string) {
    this.keys = new Map(Object.entries(keys));
    const first = Object.keys(keys)[0];
    this.defaultKeyId = defaultKeyId ?? first ?? 'default';
  }

  async getKey(keyId?: string): Promise<Buffer> {
    const id = keyId ?? this.defaultKeyId;
    const key = this.keys.get(id);
    if (!key) {
      throw new KeyNotFoundError(id);
    }
    return key;
  }

  async getKeyForDecrypt(keyId: string): Promise<Buffer> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new KeyNotFoundError(keyId);
    }
    return key;
  }

  /** Add or replace a key in the store. */
  setKey(keyId: string, key: Buffer): void {
    this.keys.set(keyId, key);
  }
}
