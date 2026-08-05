import { EnvelopeEncryptionService } from '../envelope/envelope_encryption.js';

export type SensitiveDataType = 'PHONE' | 'PAN' | 'GSTIN' | 'BANK_ACCOUNT' | 'CREDIT_LIMIT' | 'KYC_DOCUMENT';

export class PiiClassifier {
  private static PII_FIELD_NAMES = new Set([
    'ownerphone',
    'owner_phone',
    'phone',
    'phonenumber',
    'pannumber',
    'pan_number',
    'gstin',
    'bankaccount',
    'bank_account_number',
    'creditlimit',
    'credit_limit',
    'kycdocnumber',
    'kyc_doc_number',
  ]);

  /**
   * Evaluates if a given database field is classified as PII or financial data.
   */
  static isSensitiveField(fieldName: string): boolean {
    const normalized = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.PII_FIELD_NAMES.has(normalized);
  }

  /**
   * Encrypts a sensitive PII value for a specific tenant using tenant envelope encryption.
   */
  static encryptPii(tenantId: string, plainValue: string | number): string {
    return EnvelopeEncryptionService.encryptTenantData(tenantId, String(plainValue));
  }

  /**
   * Decrypts a sensitive PII value for a specific tenant.
   */
  static decryptPii(tenantId: string, cipherValue: string): string {
    return EnvelopeEncryptionService.decryptTenantData(tenantId, cipherValue);
  }

  /**
   * Masks sensitive PII for logs, export displays, or auditor views.
   */
  static maskPii(value: string, type: SensitiveDataType): string {
    if (!value) return '';
    const str = String(value);

    switch (type) {
      case 'PHONE':
        return str.length >= 10 ? `${str.slice(0, 3)}****${str.slice(-3)}` : '***';
      case 'PAN':
        return str.length === 10 ? `${str.slice(0, 2)}*****${str.slice(-3)}` : '*****';
      case 'GSTIN':
        return str.length >= 15 ? `${str.slice(0, 2)}**********${str.slice(-3)}` : '**********';
      case 'BANK_ACCOUNT':
        return str.length >= 4 ? `****${str.slice(-4)}` : '****';
      case 'CREDIT_LIMIT':
        return '[REDACTED_FINANCIAL]';
      case 'KYC_DOCUMENT':
        return '[CONFIDENTIAL_KYC_DOC]';
      default:
        return '***';
    }
  }
}
