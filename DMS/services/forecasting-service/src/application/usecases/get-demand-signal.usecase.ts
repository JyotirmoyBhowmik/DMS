import { DemandSignalAggregate } from '../../domain/entities/demand_signal.entity.js';
import { DemandSignalRepository } from '../../domain/repositories/demand_signal.repository.js';
import { DemandSignalResponseDto } from '../dtos/demand_signal.dto.js';
import { Principal } from './create-forecast-model.usecase.js';

export class GetDemandSignalUseCase {
  constructor(private readonly repository: DemandSignalRepository) {}

  public async execute(principal: Principal, id: string): Promise<DemandSignalResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:signal:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view demand signal.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('DemandSignal ID is required.');
    }

    const signal = await this.repository.findById(id, principal.tenantId);
    if (!signal) {
      throw new Error(`DemandSignal with ID '${id}' not found.`);
    }

    return this.mapToResponse(signal);
  }

  public async getByName(principal: Principal, signalName: string): Promise<DemandSignalResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:signal:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view demand signal.');
    }
    if (!signalName || signalName.trim().length === 0) {
      throw new Error('DemandSignal signalName is required.');
    }

    const signal = await this.repository.findByName(signalName.trim(), principal.tenantId);
    if (!signal) {
      throw new Error(`DemandSignal with name '${signalName.trim()}' not found.`);
    }

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
