import { randomUUID } from 'node:crypto';
import { DemandSignalAggregate } from '../../domain/entities/demand_signal.entity.js';
import { DemandSignalRepository } from '../../domain/repositories/demand_signal.repository.js';
import { validateCreateDemandSignalInput } from '../../domain/validation/demand_signal.validation.js';
import { ForecastAuditService } from '../../infrastructure/audit/forecast.audit.js';
import { CreateDemandSignalDto, DemandSignalResponseDto } from '../dtos/demand_signal.dto.js';
import { Principal } from './create-forecast-model.usecase.js';

export class CreateDemandSignalUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: DemandSignalRepository,
    private readonly auditService: ForecastAuditService = new ForecastAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateDemandSignalDto): Promise<DemandSignalResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:signal:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create demand signal.');
    }

    validateCreateDemandSignalInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateDemandSignalUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateDemandSignalUseCase.processedKeys.add(key);
    }

    const existing = await this.repository.findByName(dto.signalName.trim(), principal.tenantId);
    if (existing) {
      throw new Error(`DemandSignal with name '${dto.signalName.trim()}' already exists for this tenant.`);
    }

    const signalId = dto.id ?? randomUUID();

    const signal = DemandSignalAggregate.create({
      id: signalId,
      tenantId: principal.tenantId,
      signalName: dto.signalName.trim(),
      signalType: dto.signalType,
      signalValue: dto.signalValue,
      confidenceScore: dto.confidenceScore,
      sourceChannel: dto.sourceChannel
    });

    await this.repository.save(signal);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'DEMAND_SIGNAL_CREATED',
      entityId: signal.id,
      newValue: { signalName: signal.signalName, signalType: signal.signalType, signalValue: signal.signalValue }
    });

    return this.mapToResponse(signal);
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
