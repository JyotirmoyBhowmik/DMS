/**
 * KYCDocument Domain Entity.
 * Tracks distributor KYC verification documents.
 * State machine: PENDING -> VERIFIED | REJECTED; VERIFIED -> EXPIRED
 */

export type KYCDocumentType = 'GSTIN' | 'PAN' | 'TRADE_LICENSE' | 'FSSAI' | 'DRUG_LICENSE' | 'BANK_PROOF';
export type KYCVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface KYCDocumentProps {
  id: string;
  tenantId: string;
  distributorId: string;
  documentType: KYCDocumentType;
  documentNumber: string;
  documentUrl?: string;
  verificationStatus?: KYCVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
  version?: number;
}

export class KYCDocument {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly distributorId: string;
  public readonly documentType: KYCDocumentType;
  public readonly documentNumber: string;
  public readonly documentUrl?: string;
  private _verificationStatus: KYCVerificationStatus;
  private _verifiedBy?: string;
  private _verifiedAt?: string;
  private _expiresAt?: string;
  private _rejectionReason?: string;
  private _version: number;

  constructor(props: KYCDocumentProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.distributorId = props.distributorId;
    this.documentType = props.documentType;
    this.documentNumber = props.documentNumber;
    this.documentUrl = props.documentUrl;
    this._verificationStatus = props.verificationStatus ?? 'PENDING';
    this._verifiedBy = props.verifiedBy;
    this._verifiedAt = props.verifiedAt;
    this._expiresAt = props.expiresAt;
    this._rejectionReason = props.rejectionReason;
    this._version = props.version ?? 1;
  }

  get verificationStatus(): KYCVerificationStatus { return this._verificationStatus; }
  get verifiedBy(): string | undefined { return this._verifiedBy; }
  get verifiedAt(): string | undefined { return this._verifiedAt; }
  get expiresAt(): string | undefined { return this._expiresAt; }
  get rejectionReason(): string | undefined { return this._rejectionReason; }
  get version(): number { return this._version; }

  static create(props: KYCDocumentProps): KYCDocument {
    if (!props.documentNumber.trim()) {
      throw new Error('Document number is required');
    }
    return new KYCDocument(props);
  }

  verify(verifiedBy: string, expiresAt?: string): void {
    if (this._verificationStatus !== 'PENDING') {
      throw new Error(`Cannot verify document in ${this._verificationStatus} status`);
    }
    this._verificationStatus = 'VERIFIED';
    this._verifiedBy = verifiedBy;
    this._verifiedAt = new Date().toISOString();
    this._expiresAt = expiresAt;
    this._rejectionReason = undefined;
    this._version++;
  }

  reject(reason: string): void {
    if (this._verificationStatus !== 'PENDING') {
      throw new Error(`Cannot reject document in ${this._verificationStatus} status`);
    }
    if (!reason.trim()) {
      throw new Error('Rejection reason is required');
    }
    this._verificationStatus = 'REJECTED';
    this._rejectionReason = reason;
    this._version++;
  }

  markExpired(): void {
    if (this._verificationStatus !== 'VERIFIED') {
      throw new Error(`Cannot expire document in ${this._verificationStatus} status`);
    }
    this._verificationStatus = 'EXPIRED';
    this._version++;
  }

  /**
   * Checks whether this document is expired based on expiresAt date.
   */
  isExpired(): boolean {
    if (!this._expiresAt) return false;
    return new Date(this._expiresAt).getTime() <= Date.now();
  }

  /**
   * Checks if a distributor has the required KYC documents verified.
   * Business rule: GSTIN and PAN must be verified before distributor activation.
   */
  static hasRequiredVerifiedDocs(documents: KYCDocument[]): { valid: boolean; missing: KYCDocumentType[] } {
    const requiredTypes: KYCDocumentType[] = ['GSTIN', 'PAN'];
    const verifiedTypes = new Set(
      documents
        .filter(d => d.verificationStatus === 'VERIFIED')
        .map(d => d.documentType)
    );

    const missing = requiredTypes.filter(t => !verifiedTypes.has(t));
    return { valid: missing.length === 0, missing };
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      distributorId: this.distributorId,
      documentType: this.documentType,
      documentNumber: this.documentNumber,
      documentUrl: this.documentUrl,
      verificationStatus: this._verificationStatus,
      verifiedBy: this._verifiedBy,
      verifiedAt: this._verifiedAt,
      expiresAt: this._expiresAt,
      rejectionReason: this._rejectionReason,
      version: this._version,
    };
  }
}
