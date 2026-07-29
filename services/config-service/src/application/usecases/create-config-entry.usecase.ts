import { randomUUID } from 'node:crypto';
import { ConfigEntryAggregate } from '../../domain/entities/config_entry.entity.js';
import { ConfigEntryRepository } from '../../domain/repositories/config_entry.repository.js';
import { validateCreateConfigEntryInput } from '../../domain/validation/config_entry.validation.js';
import { ConfigAuditService } from '../../infrastructure/audit/config.audit.js';
import { CreateConfigEntryDto, ConfigEntryResponseDto } from '../dtos/config_entry.dto.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateConfigEntryUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: ConfigEntryRepository,
    private readonly auditService: ConfigAuditService = new ConfigAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateConfigEntryDto): Promise<ConfigEntryResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('config:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create config entry.');
    }

    validateCreateConfigEntryInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateConfigEntryUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateConfigEntryUseCase.processedKeys.add(key);
    }

    const existingKey = await this.repository.findByKey(dto.configKey.trim(), principal.tenantId);
    if (existingKey) {
      throw new Error(`ConfigEntry with key '${dto.configKey.trim()}' already exists for this tenant.`);
    }

    const entryId = dto.id ?? randomUUID();

    const entry = ConfigEntryAggregate.create({
      id: entryId,
      tenantId: principal.tenantId,
      configKey: dto.configKey.trim(),
      configValue: dto.configValue,
      dataType: dto.dataType,
      status: dto.status,
      isEncrypted: dto.isEncrypted
    });

    await this.repository.save(entry);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'CONFIG_ENTRY_CREATED',
      entityId: entry.id,
      newValue: { configKey: entry.configKey, dataType: entry.dataType, status: entry.status }
    });

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
