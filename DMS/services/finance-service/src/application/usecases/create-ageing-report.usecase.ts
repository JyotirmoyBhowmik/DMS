import { AgeingReportRepository } from '../../domain/repositories/ageing-report.repository.js';
import { AgeingReport, AgeingReportDomainError } from '../../domain/entities/ageing-report.entity.js';
import { CreateAgeingReportDto } from '../dtos/ageing-report.dto.js';
import { validateCreateAgeingReportInput } from '../../domain/validation/ageing-report.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { AgeingReportAuditService } from '../../infrastructure/audit/ageing-report.audit.js';

export class CreateAgeingReportUseCase {
  private auditService = new AgeingReportAuditService();

  constructor(private readonly repository: AgeingReportRepository) {}

  async execute(principal: Principal, dto: CreateAgeingReportDto, idempotencyKey?: string, correlationId?: string): Promise<AgeingReport> {
    if (!principal || !principal.tenantId) {
      throw new AgeingReportDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ageing_report:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new AgeingReportDomainError('Forbidden: Insufficient permissions to create ageing report');
    }

    validateCreateAgeingReportInput(dto);

    const asOfDate = new Date(dto.asOfDate);
    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByDistributorAndDate(dto.distributorId, asOfDate, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByDistributorAndDate(dto.distributorId, asOfDate, principal.tenantId);
    if (duplicate) {
      throw new AgeingReportDomainError(
        `Ageing report for distributor '${dto.distributorId}' on date '${dto.asOfDate}' already exists`
      );
    }

    const report = new AgeingReport({
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      asOfDate,
      currentBucketCents: dto.currentBucketCents || 0,
      bucket1To30Cents: dto.bucket1To30Cents || 0,
      bucket31To60Cents: dto.bucket31To60Cents || 0,
      bucket61To90Cents: dto.bucket61To90Cents || 0,
      bucket90PlusCents: dto.bucket90PlusCents || 0,
      status: 'GENERATED',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(report, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'AGEING_REPORT_CREATED',
      entityType: 'AgeingReport',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
