import { DemandSignalAggregate } from '../../domain/entities/demand_signal.entity.js';
import { DemandSignalRepository } from '../../domain/repositories/demand_signal.repository.js';
import { ListDemandSignalsQueryDto, DemandSignalResponseDto } from '../dtos/demand_signal.dto.js';
import { Principal } from './create-forecast-model.usecase.js';

export interface PaginatedDemandSignalsResponseDto {
  signals: DemandSignalResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListDemandSignalsUseCase {
  constructor(private readonly repository: DemandSignalRepository) {}

  public async execute(principal: Principal, query: ListDemandSignalsQueryDto): Promise<PaginatedDemandSignalsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:signal:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list demand signals.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      signalName: query.signalName,
      signalType: query.signalType,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      signals: result.signals.map(s => this.mapToResponse(s)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
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
