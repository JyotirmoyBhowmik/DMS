import { Tenant } from '@dms/pkg-database';

export class TaxRuleEntity {
  id: string;

  @Tenant()
  tenantId: string;

  taxRuleKey: string; // e.g. 'GST_18', 'GST_5', 'VAT_12'
  ratePercentage: number; // e.g. 18.00
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<TaxRuleEntity>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.taxRuleKey = data.taxRuleKey || '';
    this.ratePercentage = data.ratePercentage !== undefined ? Number(data.ratePercentage) : 0;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
