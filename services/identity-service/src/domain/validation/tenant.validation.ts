import { CreateTenantDto, UpdateTenantDto } from '../../application/dtos/tenant.dto.js';
import { TenantValidationError } from '../entities/tenant.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'name',
  'code',
  'domain',
  'status',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'name',
  'domain',
  'status',
  'version'
]);

export function validateCreateTenantInput(rawInput: any): CreateTenantDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new TenantValidationError({ body: 'Request body must be a valid JSON object' });
  }

  if (!rawInput.code && rawInput.name) {
    rawInput.code = String(rawInput.name).toLowerCase().replace(/\s+/g, '-');
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new TenantValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.name || typeof rawInput.name !== 'string' || rawInput.name.trim().length === 0) {
    errors.name = 'name is required and must be a non-empty string';
  }
  if (!rawInput.code || typeof rawInput.code !== 'string' || rawInput.code.trim().length === 0) {
    errors.code = 'code is required and must be a non-empty string';
  }

  if (Object.keys(errors).length > 0) {
    throw new TenantValidationError(errors);
  }

  return rawInput as CreateTenantDto;
}

export function validateUpdateTenantInput(rawInput: any): UpdateTenantDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new TenantValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new TenantValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (rawInput.status !== undefined) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (!validStatuses.includes(rawInput.status)) {
      errors.status = `status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  if (rawInput.version === undefined) {
    errors.version = 'version is required for optimistic locking';
  } else if (typeof rawInput.version !== 'number' || rawInput.version < 1) {
    errors.version = 'version must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new TenantValidationError(errors);
  }

  return rawInput as UpdateTenantDto;
}
