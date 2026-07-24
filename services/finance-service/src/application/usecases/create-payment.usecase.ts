import { PaymentRepository } from '../../domain/repositories/payment.repository.js';
import { Payment, PaymentDomainError } from '../../domain/entities/payment.entity.js';
import { CreatePaymentDto } from '../dtos/payment.dto.js';
import { validateCreatePaymentInput } from '../../domain/validation/payment.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { PaymentAuditService } from '../../infrastructure/audit/payment.audit.js';

export class CreatePaymentUseCase {
  private auditService = new PaymentAuditService();

  constructor(private readonly repository: PaymentRepository) {}

  async execute(principal: Principal, dto: CreatePaymentDto, idempotencyKey?: string, correlationId?: string): Promise<Payment> {
    if (!principal || !principal.tenantId) {
      throw new PaymentDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:payment:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new PaymentDomainError('Forbidden: Insufficient permissions to create payment (finance:payment:create required)');
    }

    validateCreatePaymentInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByPaymentReference(dto.paymentReference, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByPaymentReference(dto.paymentReference, principal.tenantId);
    if (duplicate) {
      throw new PaymentDomainError(`Payment with reference '${dto.paymentReference}' already exists`);
    }

    const payment = new Payment({
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      invoiceId: dto.invoiceId,
      paymentReference: dto.paymentReference,
      amountCents: dto.amountCents,
      paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
      currency: dto.currency || 'USD',
      status: 'DRAFT',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(payment, principal.tenantId);

    // Audit logging hook
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'PAYMENT_CREATED',
      entityType: 'Payment',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
