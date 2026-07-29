import { ConfigEntryAggregate } from '../../domain/entities/config_entry.entity.js';
import { ConfigEntryRepository } from '../../domain/repositories/config_entry.repository.js';
import { ConfigAuditService } from '../../infrastructure/audit/config.audit.js';
import { ConfigEntryResponseDto, UpdateConfigEntryDto } from '../dtos/config_entry.dto.js';
import { Principal } from './create-config-entry.usecase.js';

export class UpdateConfigEntryUseCase {
  constructor(
    private readonly repository: ConfigEntryRepository,
    private readonly auditService: ConfigAuditService = new ConfigAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateConfigEntryDto): Promise<ConfigEntryResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('config:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update config entry.');
    }

    const entry = await this.repository.findById(id, principal.tenantId);
    if (!entry) {
      throw new Error(`ConfigEntry with ID '${id}' not found.`);
    }

    const oldState = { configValue: entry.configValue, status: entry.status, version: entry.version };

    if (dto.configValue !== undefined && dto.configValue !== null) {
      entry.updateValue(dto.configValue, dto.expectedVersion);
    } else if (dto.status) {
      if (dto.status === 'ACTIVE') {
        entry.activate(dto.expectedVersion);
      } else if (dto.status === 'INACTIVE') {
        entry.deactivate(dto.expectedVersion);
      } else if (dto.status === 'DEPRECATED') {
        entry.deprecate(dto.expectedVersion);
      }
    }

    await this.repository.save(entry);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'CONFIG_ENTRY_UPDATED',
      entityId: entry.id,
      oldValue: oldState,
      newValue: { configValue: entry.configValue, status: entry.status, version: entry.version }
    });

    return this.mapToResponse(entry);
  }

  public async deleteEntry(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('config:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete config entry.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`ConfigEntry with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'CONFIG_ENTRY_DELETED',
        entityId: id,
        oldValue: { configKey: existing.configKey, status: existing.status }
      });
    }

    return deleted;
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
