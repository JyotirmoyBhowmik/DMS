import { ConfigEntryAggregate, ConfigDataType, ConfigStatus } from '../entities/config_entry.entity.js';

export interface ConfigEntryFilter {
  tenantId: string;
  configKey?: string;
  dataType?: ConfigDataType;
  status?: ConfigStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'configKey';
  sortOrder?: 'asc' | 'desc';
}

export interface ConfigEntryRepository {
  save(entry: ConfigEntryAggregate): Promise<ConfigEntryAggregate>;
  findById(id: string, tenantId: string): Promise<ConfigEntryAggregate | null>;
  findByKey(configKey: string, tenantId: string): Promise<ConfigEntryAggregate | null>;
  findAll(filter: ConfigEntryFilter): Promise<{ entries: ConfigEntryAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
