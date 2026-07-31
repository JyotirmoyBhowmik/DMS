import { CreateUserDto, UpdateUserDto } from '../../application/dtos/user.dto.js';
import { UserValidationError } from '../entities/user.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'email',
  'password',
  'passwordHash',
  'firstName',
  'lastName',
  'roles',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'status',
  'roles',
  'firstName',
  'lastName',
  'version'
]);

export function validateCreateUserInput(rawInput: any): CreateUserDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new UserValidationError({ body: 'Request body must be a valid JSON object' });
  }

  if (rawInput.password && !rawInput.passwordHash) {
    rawInput.passwordHash = rawInput.password;
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new UserValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.email || typeof rawInput.email !== 'string' || rawInput.email.trim().length === 0) {
    errors.email = 'email is required and must be a non-empty string';
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawInput.email)) {
      errors.email = 'email format is invalid';
    }
  }

  if (!rawInput.passwordHash || typeof rawInput.passwordHash !== 'string' || rawInput.passwordHash.trim().length === 0) {
    errors.passwordHash = 'passwordHash is required and must be a non-empty string';
  }

  if (rawInput.roles !== undefined) {
    if (!Array.isArray(rawInput.roles) || rawInput.roles.some((r: any) => typeof r !== 'string')) {
      errors.roles = 'roles must be an array of strings';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new UserValidationError(errors);
  }

  return rawInput as CreateUserDto;
}

export function validateUpdateUserInput(rawInput: any): UpdateUserDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new UserValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new UserValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (rawInput.status !== undefined) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED'];
    if (!validStatuses.includes(rawInput.status)) {
      errors.status = `status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  if (rawInput.version === undefined || typeof rawInput.version !== 'number' || rawInput.version < 1) {
    errors.version = 'version is required and must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new UserValidationError(errors);
  }

  return rawInput as UpdateUserDto;
}
