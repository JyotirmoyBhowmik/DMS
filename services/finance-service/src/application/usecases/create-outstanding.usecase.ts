import { OutstandingRepository } from '../../domain/repositories/outstanding.repository.js';
import { Outstanding, OutstandingDomainError } from '../../domain/entities/outstanding.entity.js';
import { CreateOutstandingDto } from '../dtos/outstanding.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateCreateOutstandingInput } from '../../domain/validation/outstanding.validation.js';
import { OutstandingAuditService } from '../../infrastructure/audit/outstanding.audit.js';

export class CreateOutstandingUseCase {
  private auditService = new OutstandingAuditService();

  constructor(private readonly repository: OutstandingRepository) {}

  async execute(principal: Principal, dto: CreateOutstandingDto, idempotencyKey?: string, correlationId?: string): Promise<Outstanding> {
    if (!principal || !principal.tenantId) {
      throw new OutstandingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:outstanding:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new OutstandingDomainError('Forbidden: Insufficient permissions to create outstanding record');
    }

    validateCreateOutstandingInput(dto);

    // Idempotency deduplication check
    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;
    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByOutstandingReference(dto.outstandingReference, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    // Reference uniqueness check
    const existingRef = await this.repository.findByOutstandingReference(dto.outstandingReference, principal.tenantId);
    if (existingRef) {
      throw new OutstandingDomainError(`Outstanding record with reference '${dto.outstandingReference}' already exists`);
    }

    const outstanding = new Outstanding({
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      invoiceId: dto.invoiceId,
      outstandingReference: dto.outstandingReference,
      amountCents: dto.amountCents,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      idempotencyKey: effectiveIdempotencyKey,
      status: 'OPEN',
      version: 1,
    });

    const saved = await this.repository.save(outstanding, principal.tenantId);

    // Audit logging hook
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'OUTSTANDING_CREATED',
      entityType: 'Outstanding',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
