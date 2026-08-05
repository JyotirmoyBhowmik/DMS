import { ConfigDataType, ConfigStatus } from '../../domain/entities/config_entry.entity.js';

export interface CreateConfigEntryDto {
  id?: string;
  configKey: string;
  configValue: string;
  dataType?: ConfigDataType;
  status?: ConfigStatus;
  isEncrypted?: boolean;
  idempotencyKey?: string;
}

export interface UpdateConfigEntryDto {
  configValue?: string;
  status?: ConfigStatus;
  expectedVersion: number;
}

export interface ConfigEntryResponseDto {
  id: string;
  tenantId: string;
  configKey: string;
  configValue: string;
  dataType: ConfigDataType;
  status: ConfigStatus;
  isEncrypted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListConfigEntriesQueryDto {
  configKey?: string;
  dataType?: ConfigDataType;
  status?: ConfigStatus;
  page?: number;
  pageSize?: number;
}
