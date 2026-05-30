export class CryptoError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'CRYPTO_ERROR') {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
    Object.setPrototypeOf(this, CryptoError.prototype);
  }
}

export class IntegrityError extends CryptoError {
  constructor(message = 'Data integrity check failed') {
    super(message, 'INTEGRITY_ERROR');
    this.name = 'IntegrityError';
    Object.setPrototypeOf(this, IntegrityError.prototype);
  }
}

export class KeyNotFoundError extends CryptoError {
  public readonly keyId: string;

  constructor(keyId: string) {
    super(`Key not found: ${keyId}`, 'KEY_NOT_FOUND');
    this.name = 'KeyNotFoundError';
    this.keyId = keyId;
    Object.setPrototypeOf(this, KeyNotFoundError.prototype);
  }
}
