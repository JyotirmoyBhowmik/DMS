import { ConfigEntryAggregate } from '../../domain/entities/config_entry.entity.js';
import { ConfigEntryRepository } from '../../domain/repositories/config_entry.repository.js';
import { ListConfigEntriesQueryDto, ConfigEntryResponseDto } from '../dtos/config_entry.dto.js';
import { Principal } from './create-config-entry.usecase.js';

export interface PaginatedConfigEntriesResponseDto {
  entries: ConfigEntryResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListConfigEntriesUseCase {
  constructor(private readonly repository: ConfigEntryRepository) {}

  public async execute(principal: Principal, query: ListConfigEntriesQueryDto): Promise<PaginatedConfigEntriesResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('config:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list config entries.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      configKey: query.configKey,
      dataType: query.dataType,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      entries: result.entries.map(e => this.mapToResponse(e)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
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
