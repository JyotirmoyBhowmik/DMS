import { EWayBillRepository } from '../../domain/repositories/ewaybill.repository.js';
import { EWayBill, EWayBillDomainError } from '../../domain/entities/ewaybill.entity.js';
import { CreateEWayBillDto } from '../dtos/ewaybill.dto.js';
import { validateCreateEWayBillInput } from '../../domain/validation/ewaybill.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { EWayBillAuditService } from '../../infrastructure/audit/ewaybill.audit.js';

export class CreateEWayBillUseCase {
  private auditService = new EWayBillAuditService();

  constructor(private readonly repository: EWayBillRepository) {}

  async execute(principal: Principal, dto: CreateEWayBillDto, idempotencyKey?: string, correlationId?: string): Promise<EWayBill> {
    if (!principal || !principal.tenantId) {
      throw new EWayBillDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ewaybill:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EWayBillDomainError('Forbidden: Insufficient permissions to create eWayBill');
    }

    validateCreateEWayBillInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByEWayBillNumber(dto.ewayBillNumber, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByEWayBillNumber(dto.ewayBillNumber, principal.tenantId);
    if (duplicate) {
      throw new EWayBillDomainError(`eWayBill with number '${dto.ewayBillNumber}' already exists`);
    }

    const ewaybill = new EWayBill({
      tenantId: principal.tenantId,
      invoiceId: dto.invoiceId,
      ewayBillNumber: dto.ewayBillNumber,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      vehicleNumber: dto.vehicleNumber,
      transporterId: dto.transporterId,
      distanceKm: dto.distanceKm || 0,
      status: 'GENERATED',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(ewaybill, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'EWAYBILL_CREATED',
      entityType: 'EWayBill',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
