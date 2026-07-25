import { EWayBillRepository } from '../../domain/repositories/ewaybill.repository.js';
import { EWayBill, EWayBillDomainError } from '../../domain/entities/ewaybill.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetEWayBillUseCase {
  constructor(private readonly repository: EWayBillRepository) {}

  async execute(id: string, principal: Principal): Promise<EWayBill> {
    if (!principal || !principal.tenantId) {
      throw new EWayBillDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ewaybill:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EWayBillDomainError('Forbidden: Insufficient permissions to read eWayBill');
    }

    const ewaybill = await this.repository.findById(id, principal.tenantId);
    if (!ewaybill) {
      throw new EWayBillDomainError(`EWayBill with id '${id}' not found`);
    }

    return ewaybill;
  }
}
