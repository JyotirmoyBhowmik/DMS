import { CreateRoleDto, UpdateRoleDto } from '../../application/dtos/role.dto.js';
import { RoleValidationError } from '../entities/role.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'name',
  'description',
  'isSystem',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'name',
  'description',
  'status',
  'version'
]);

export function validateCreateRoleInput(rawInput: any): CreateRoleDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new RoleValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new RoleValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.name || typeof rawInput.name !== 'string' || rawInput.name.trim().length === 0) {
    errors.name = 'name is required and must be a non-empty string';
  }

  if (Object.keys(errors).length > 0) {
    throw new RoleValidationError(errors);
  }

  return rawInput as CreateRoleDto;
}

export function validateUpdateRoleInput(rawInput: any): UpdateRoleDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new RoleValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new RoleValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (rawInput.status !== undefined) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
    if (!validStatuses.includes(rawInput.status)) {
      errors.status = `status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  if (rawInput.version !== undefined && (typeof rawInput.version !== 'number' || rawInput.version < 1)) {
    errors.version = 'version must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new RoleValidationError(errors);
  }

  return rawInput as UpdateRoleDto;
}
