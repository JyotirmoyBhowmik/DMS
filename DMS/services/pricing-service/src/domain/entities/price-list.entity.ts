import { Tenant } from '@dms/pkg-database';
import { PriceListAssignmentEntity } from './price-list-assignment.entity.js';
import { PriceListEntryEntity } from './price-list-entry.entity.js';

export class PriceListEntity {
  id: string;

  @Tenant()
  tenantId: string;

  name: string;
  description?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;

  assignments?: PriceListAssignmentEntity[];
  entries?: PriceListEntryEntity[];

  constructor(data: Partial<PriceListEntity>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.name = data.name || '';
    this.description = data.description;
    this.effectiveFrom = data.effectiveFrom || new Date();
    this.effectiveTo = data.effectiveTo;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.version = data.version || 1;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.assignments = data.assignments || [];
    this.entries = data.entries || [];
  }
}
