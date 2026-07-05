import { Tenant } from '@dms/pkg-database';

export type ClaimStatus = 'raised' | 'validated' | 'approved' | 'settled' | 'rejected';

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

  constructor(data: Partial<ClaimEntity>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.distributorId = data.distributorId || '';
    this.schemeId = data.schemeId || '';
    this.amount = data.amount || 0;
    this.settledAmount = data.settledAmount || 0;
    this.status = data.status || 'raised';
    this.duplicateCheckKey = data.duplicateCheckKey;
    this.version = data.version;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
