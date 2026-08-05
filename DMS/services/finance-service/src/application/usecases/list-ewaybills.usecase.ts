import { EWayBillRepository, ListEWayBillsOptions } from '../../domain/repositories/ewaybill.repository.js';
import { EWayBill, EWayBillDomainError } from '../../domain/entities/ewaybill.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class ListEWayBillsUseCase {
  constructor(private readonly repository: EWayBillRepository) {}

  async execute(principal: Principal, options?: ListEWayBillsOptions): Promise<{ items: EWayBill[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new EWayBillDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ewaybill:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EWayBillDomainError('Forbidden: Insufficient permissions to list eWayBills');
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(Math.max(1, options?.limit || 20), 100); // Mandatory max cap 100

    const { items, total } = await this.repository.list(principal.tenantId, {
      ...options,
      page,
      limit,
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }
}
