import { PaymentRepository } from '../../domain/repositories/payment.repository.js';
import { Payment, PaymentDomainError } from '../../domain/entities/payment.entity.js';
import { UpdatePaymentDto } from '../dtos/payment.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdatePaymentInput } from '../../domain/validation/payment.validation.js';
import { PaymentAuditService } from '../../infrastructure/audit/payment.audit.js';

export class UpdatePaymentUseCase {
  private auditService = new PaymentAuditService();

  constructor(private readonly repository: PaymentRepository) {}

  async execute(principal: Principal, id: string, dto: UpdatePaymentDto, correlationId?: string): Promise<Payment> {
    if (!principal || !principal.tenantId) {
      throw new PaymentDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const isApproveAction = dto.status === 'COMPLETED' || dto.status === 'REFUNDED';
    const requiredPermission = isApproveAction ? 'finance:payment:approve' : 'finance:payment:update';

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes(requiredPermission) ||
      principal.permissions.includes('finance:payment:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new PaymentDomainError(`Forbidden: Insufficient permissions to update payment (${requiredPermission} required)`);
    }

    validateUpdatePaymentInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new PaymentDomainError(`Payment with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new PaymentDomainError(
        `Version conflict: Expected version ${existing.version}, got ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit logging hook
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `PAYMENT_UPDATED_${dto.status || 'STATE'}`,
      entityType: 'Payment',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
