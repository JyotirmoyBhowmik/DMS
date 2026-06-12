import { PII, Encrypted, Tenant } from '@dms/pkg-database';

export type SchemeStatus = 'draft' | 'active' | 'suspended' | 'expired';

export interface SchemeRules {
  minOrderAmount?: number; // In cents/paise
  applicableSkuIds?: string[];
  [key: string]: unknown;
}

export interface SchemePayouts {
  discountPercentage?: number;
  flatDiscountAmount?: number; // In cents/paise
  [key: string]: unknown;
}

export class SchemeEntity {
  id: string;

  @Tenant()
  tenantId: string;

  name: string;
  description?: string;
  status: SchemeStatus;
  startDate: Date;
  endDate?: Date;
  rules: SchemeRules;
  payouts: SchemePayouts;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<SchemeEntity>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.name = data.name || '';
    this.description = data.description;
    this.status = data.status || 'draft';
    this.startDate = data.startDate || new Date();
    this.endDate = data.endDate;
    this.rules = data.rules || {};
    this.payouts = data.payouts || {};
    this.version = data.version;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
