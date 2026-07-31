import { MFADeviceValidationError, MfaType } from '../entities/mfa_device.entity.js';
import { CreateMFADeviceInputDTO, UpdateMFADeviceInputDTO } from '../../application/dtos/mfa_device.dto.js';

export function validateCreateMFADeviceInput(input: any): CreateMFADeviceInputDTO {
  if (!input || typeof input !== 'object') {
    throw new MFADeviceValidationError('Invalid input payload: body must be an object');
  }

  const allowedKeys = ['userId', 'type', 'secretEncrypted', 'isActive', 'idempotencyKey'];
  const unknownKeys = Object.keys(input).filter(key => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new MFADeviceValidationError(`Mass assignment violation: Unknown fields [${unknownKeys.join(', ')}] are forbidden`);
  }

  const errors: Record<string, string> = {};

  if (!input.userId || typeof input.userId !== 'string' || input.userId.trim().length === 0) {
    errors.userId = 'userId is required and must be a non-empty string';
  }

  const validTypes: MfaType[] = ['TOTP', 'SMS', 'EMAIL', 'SECURITY_KEY'];
  if (!input.type || !validTypes.includes(input.type)) {
    errors.type = `type must be one of: ${validTypes.join(', ')}`;
  }

  if (!input.secretEncrypted || typeof input.secretEncrypted !== 'string' || input.secretEncrypted.trim().length === 0) {
    errors.secretEncrypted = 'secretEncrypted is required and must be a non-empty string';
  }

  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
    errors.isActive = 'isActive must be a boolean';
  }

  if (Object.keys(errors).length > 0) {
    throw new MFADeviceValidationError('Validation failed for CreateMFADevice input', errors);
  }

  return {
    userId: input.userId.trim(),
    type: input.type,
    secretEncrypted: input.secretEncrypted.trim(),
    isActive: input.isActive !== undefined ? input.isActive : true,
    idempotencyKey: input.idempotencyKey ? String(input.idempotencyKey) : undefined,
  };
}

export function validateUpdateMFADeviceInput(input: any): UpdateMFADeviceInputDTO {
  if (!input || typeof input !== 'object') {
    throw new MFADeviceValidationError('Invalid input payload: body must be an object');
  }

  const allowedKeys = ['secretEncrypted', 'isActive', 'version'];
  const unknownKeys = Object.keys(input).filter(key => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new MFADeviceValidationError(`Mass assignment violation: Unknown fields [${unknownKeys.join(', ')}] are forbidden`);
  }

  const errors: Record<string, string> = {};

  if (input.version !== undefined && (typeof input.version !== 'number' || input.version < 1)) {
    errors.version = 'version must be a positive integer >= 1';
  }

  if (input.secretEncrypted !== undefined && (typeof input.secretEncrypted !== 'string' || input.secretEncrypted.trim().length === 0)) {
    errors.secretEncrypted = 'secretEncrypted must be a non-empty string';
  }

  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
    errors.isActive = 'isActive must be a boolean';
  }

  if (Object.keys(errors).length > 0) {
    throw new MFADeviceValidationError('Validation failed for UpdateMFADevice input', errors);
  }

  return {
    secretEncrypted: input.secretEncrypted ? input.secretEncrypted.trim() : undefined,
    isActive: input.isActive,
    version: input.version,
  };
}
