import { CreatePermissionDto, UpdatePermissionDto } from '../../application/dtos/permission.dto.js';
import { PermissionValidationError } from '../entities/permission.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'name',
  'resource',
  'action',
  'description',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'name',
  'resource',
  'action',
  'description',
  'status',
  'version'
]);

export function validateCreatePermissionInput(rawInput: any): CreatePermissionDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new PermissionValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new PermissionValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.name || typeof rawInput.name !== 'string' || rawInput.name.trim().length === 0) {
    errors.name = 'name is required and must be a non-empty string';
  }
  if (!rawInput.resource || typeof rawInput.resource !== 'string' || rawInput.resource.trim().length === 0) {
    errors.resource = 'resource is required and must be a non-empty string';
  }
  if (!rawInput.action || typeof rawInput.action !== 'string' || rawInput.action.trim().length === 0) {
    errors.action = 'action is required and must be a non-empty string';
  }

  if (Object.keys(errors).length > 0) {
    throw new PermissionValidationError(errors);
  }

  return rawInput as CreatePermissionDto;
}

export function validateUpdatePermissionInput(rawInput: any): UpdatePermissionDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new PermissionValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new PermissionValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (rawInput.status !== undefined) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'DEPRECATED'];
    if (!validStatuses.includes(rawInput.status)) {
      errors.status = `status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  if (rawInput.version === undefined || typeof rawInput.version !== 'number' || rawInput.version < 1) {
    errors.version = 'version is required and must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new PermissionValidationError(errors);
  }

  return rawInput as UpdatePermissionDto;
}
