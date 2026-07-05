import { Tenant } from '@dms/pkg-database';

export type ClaimStatus = 'draft' | 'raised' | 'validated' | 'approved' | 'settled' | 'rejected';

export class ClaimEntity {
  id: string;

  @Tenant()
  tenantId: string;

  distributorId: string;
  schemeId: string;
  amount: number; // in cents/paise (integer)
  settledAmount: number; // in cents/paise (integer)
  status: ClaimStatus;
  duplicateCheckKey?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;

  // In-memory / test-only fields
  claimAmount?: number;
  calculations?: { claimAmount: number; taxAmount: number; netAmount: number };
  validatedBy?: string;
  validatedAt?: Date;
  rejectionReason?: string;
  approvedBy?: string;
  settlementDetails?: { status: string; amountPaid: number; idempotencyKey: string };

  constructor(data: Partial<ClaimEntity>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.distributorId = data.distributorId || '';
    this.schemeId = data.schemeId || '';
    this.amount = data.amount || data.claimAmount || 0;
    this.settledAmount = data.settledAmount || 0;
    this.status = data.status || 'raised';
    this.duplicateCheckKey = data.duplicateCheckKey;
    this.version = data.version;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    // Initialize test fields
    this.claimAmount = data.claimAmount || this.amount;
    this.calculations = data.calculations;
    this.validatedBy = data.validatedBy;
    this.validatedAt = data.validatedAt;
    this.rejectionReason = data.rejectionReason;
    this.approvedBy = data.approvedBy;
    this.settlementDetails = data.settlementDetails;
  }
}
