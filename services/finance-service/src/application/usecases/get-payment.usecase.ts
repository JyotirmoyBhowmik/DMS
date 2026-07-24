import { PaymentRepository } from '../../domain/repositories/payment.repository.js';
import { Payment, PaymentDomainError } from '../../domain/entities/payment.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetPaymentUseCase {
  constructor(private readonly repository: PaymentRepository) {}

  async execute(principal: Principal, id: string): Promise<Payment> {
    if (!principal || !principal.tenantId) {
      throw new PaymentDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:payment:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new PaymentDomainError('Forbidden: Insufficient permissions to read payment');
    }

    const found = await this.repository.findById(id, principal.tenantId);
    if (!found) {
      throw new PaymentDomainError(`Payment with id '${id}' not found`);
    }

    return found;
  }
}
