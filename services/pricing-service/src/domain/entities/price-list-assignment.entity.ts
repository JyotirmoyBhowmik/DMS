import { Tenant } from '@dms/pkg-database';

export type AssignmentType = 'default' | 'channel' | 'customer';

export class PriceListAssignmentEntity {
  id: string;

  @Tenant()
  tenantId: string;

  priceListId: string;
  assignmentType: AssignmentType;
  assignmentValue?: string; // channel code or customer/outlet ID, or NULL for default
  priority: number;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<PriceListAssignmentEntity>) {
    this.id = data.id || '';
    this.tenantId = data.tenantId || '';
    this.priceListId = data.priceListId || '';
    this.assignmentType = data.assignmentType || 'default';
    this.assignmentValue = data.assignmentValue;
    this.priority = data.priority !== undefined ? data.priority : 0;
    this.version = data.version || 1;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
