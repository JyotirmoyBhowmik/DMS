import { DemandSignalAggregate } from '../../domain/entities/demand_signal.entity.js';
import { DemandSignalRepository } from '../../domain/repositories/demand_signal.repository.js';
import { ForecastAuditService } from '../../infrastructure/audit/forecast.audit.js';
import { DemandSignalResponseDto, UpdateDemandSignalDto } from '../dtos/demand_signal.dto.js';
import { Principal } from './create-forecast-model.usecase.js';

export class UpdateDemandSignalUseCase {
  constructor(
    private readonly repository: DemandSignalRepository,
    private readonly auditService: ForecastAuditService = new ForecastAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateDemandSignalDto): Promise<DemandSignalResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:signal:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update demand signal.');
    }

    const signal = await this.repository.findById(id, principal.tenantId);
    if (!signal) {
      throw new Error(`DemandSignal with ID '${id}' not found.`);
    }

    const oldState = { status: signal.status, signalValue: signal.signalValue, version: signal.version };

    if (dto.action === 'process') {
      signal.processSignal(dto.expectedVersion);
    } else if (dto.action === 'update_value') {
      const val = dto.signalValue ?? signal.signalValue;
      const conf = dto.confidenceScore ?? signal.confidenceScore;
      signal.updateValue(val, conf, dto.expectedVersion);
    } else if (dto.action === 'archive') {
      signal.archive(dto.expectedVersion);
    }

    await this.repository.save(signal);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'DEMAND_SIGNAL_UPDATED',
      entityId: signal.id,
      oldValue: oldState,
      newValue: { status: signal.status, signalValue: signal.signalValue, version: signal.version }
    });

    return this.mapToResponse(signal);
  }

  public async approveSignal(principal: Principal, id: string, expectedVersion: number): Promise<DemandSignalResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:signal:approve') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to approve demand signal.');
    }

    const signal = await this.repository.findById(id, principal.tenantId);
    if (!signal) {
      throw new Error(`DemandSignal with ID '${id}' not found.`);
    }

    const oldStatus = signal.status;
    signal.approve(expectedVersion);
    await this.repository.save(signal);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'DEMAND_SIGNAL_APPROVED',
      entityId: signal.id,
      oldValue: { status: oldStatus },
      newValue: { status: signal.status, version: signal.version }
    });

    return this.mapToResponse(signal);
  }

  public async deleteSignal(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:signal:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete demand signal.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`DemandSignal with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'DEMAND_SIGNAL_DELETED',
        entityId: id,
        oldValue: { signalName: existing.signalName, status: existing.status }
      });
    }

    return deleted;
  }

  private mapToResponse(signal: DemandSignalAggregate): DemandSignalResponseDto {
    return {
      id: signal.id,
      tenantId: signal.tenantId,
      signalName: signal.signalName,
      signalType: signal.signalType,
      signalValue: signal.signalValue,
      confidenceScore: signal.confidenceScore,
      status: signal.status,
      sourceChannel: signal.sourceChannel,
      version: signal.version,
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString()
    };
  }
}
