import { CreateConfigEntryDto } from '../../application/dtos/config_entry.dto.js';
import { ConfigDataType } from '../entities/config_entry.entity.js';

export function validateCreateConfigEntryInput(dto: CreateConfigEntryDto): void {
  if (!dto) {
    throw new Error('ConfigEntry payload is required.');
  }
  if (!dto.configKey || dto.configKey.trim().length === 0) {
    throw new Error('ConfigEntry configKey is required.');
  }
  if (dto.configValue === undefined || dto.configValue === null) {
    throw new Error('ConfigEntry configValue is required.');
  }

  const keyRegex = /^[A-Za-z0-9_.-]+$/;
  if (!keyRegex.test(dto.configKey.trim())) {
    throw new Error(`Invalid ConfigEntry configKey format: '${dto.configKey}'. Only alphanumeric, dot, dash, underscore allowed.`);
  }

  const validDataTypes: ConfigDataType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'JSON'];
  if (dto.dataType && !validDataTypes.includes(dto.dataType)) {
    throw new Error(`Invalid ConfigEntry dataType: ${dto.dataType}`);
  }
}
