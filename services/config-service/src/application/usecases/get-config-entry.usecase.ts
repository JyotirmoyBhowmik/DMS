import { ConfigEntryAggregate } from '../../domain/entities/config_entry.entity.js';
import { ConfigEntryRepository } from '../../domain/repositories/config_entry.repository.js';
import { ConfigEntryResponseDto } from '../dtos/config_entry.dto.js';
import { Principal } from './create-config-entry.usecase.js';

export class GetConfigEntryUseCase {
  constructor(private readonly repository: ConfigEntryRepository) {}

  public async execute(principal: Principal, id: string): Promise<ConfigEntryResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('config:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view config entry.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('ConfigEntry ID is required.');
    }

    const entry = await this.repository.findById(id, principal.tenantId);
    if (!entry) {
      throw new Error(`ConfigEntry with ID '${id}' not found.`);
    }

    return this.mapToResponse(entry);
  }

  public async getByKey(principal: Principal, configKey: string): Promise<ConfigEntryResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('config:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view config entry.');
    }
    if (!configKey || configKey.trim().length === 0) {
      throw new Error('ConfigEntry configKey is required.');
    }

    const entry = await this.repository.findByKey(configKey.trim(), principal.tenantId);
    if (!entry) {
      throw new Error(`ConfigEntry with key '${configKey.trim()}' not found.`);
    }

    return this.mapToResponse(entry);
  }

  private mapToResponse(entry: ConfigEntryAggregate): ConfigEntryResponseDto {
    return {
      id: entry.id,
      tenantId: entry.tenantId,
      configKey: entry.configKey,
      configValue: entry.configValue,
      dataType: entry.dataType,
      status: entry.status,
      isEncrypted: entry.isEncrypted,
      version: entry.version,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString()
    };
  }
}
