import { EInvoiceRepository } from '../../domain/repositories/einvoice.repository.js';
import { EInvoice, EInvoiceDomainError } from '../../domain/entities/einvoice.entity.js';
import { CreateEInvoiceDto } from '../dtos/einvoice.dto.js';
import { validateCreateEInvoiceInput } from '../../domain/validation/einvoice.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { EInvoiceAuditService } from '../../infrastructure/audit/einvoice.audit.js';

export class CreateEInvoiceUseCase {
  private auditService = new EInvoiceAuditService();

  constructor(private readonly repository: EInvoiceRepository) {}

  async execute(principal: Principal, dto: CreateEInvoiceDto, idempotencyKey?: string, correlationId?: string): Promise<EInvoice> {
    if (!principal || !principal.tenantId) {
      throw new EInvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:einvoice:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EInvoiceDomainError('Forbidden: Insufficient permissions to create eInvoice');
    }

    validateCreateEInvoiceInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByIrn(dto.irn, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByIrn(dto.irn, principal.tenantId);
    if (duplicate) {
      throw new EInvoiceDomainError(`eInvoice with IRN '${dto.irn}' already exists`);
    }

    const einvoice = new EInvoice({
      tenantId: principal.tenantId,
      invoiceId: dto.invoiceId,
      irn: dto.irn,
      qrCode: dto.qrCode,
      acknowledgementNumber: dto.acknowledgementNumber,
      acknowledgementDate: dto.acknowledgementDate ? new Date(dto.acknowledgementDate) : undefined,
      taxAmountCents: dto.taxAmountCents || 0,
      totalAmountCents: dto.totalAmountCents || 0,
      status: 'PENDING',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(einvoice, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'EINVOICE_CREATED',
      entityType: 'EInvoice',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
