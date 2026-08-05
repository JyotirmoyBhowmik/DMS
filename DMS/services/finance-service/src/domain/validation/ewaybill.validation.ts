import { CreateEWayBillDto, UpdateEWayBillDto } from '../../application/dtos/ewaybill.dto.js';
import { EWayBillValidationError } from '../entities/ewaybill.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'invoiceId',
  'ewayBillNumber',
  'validUntil',
  'vehicleNumber',
  'transporterId',
  'distanceKm',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'status',
  'version'
]);

export function validateCreateEWayBillInput(rawInput: any): CreateEWayBillDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new EWayBillValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new EWayBillValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.invoiceId || typeof rawInput.invoiceId !== 'string' || rawInput.invoiceId.trim().length === 0) {
    errors.invoiceId = 'invoiceId is required and must be a non-empty string';
  }

  if (!rawInput.ewayBillNumber || typeof rawInput.ewayBillNumber !== 'string' || rawInput.ewayBillNumber.trim().length === 0) {
    errors.ewayBillNumber = 'ewayBillNumber is required and must be a non-empty string';
  }

  if (rawInput.distanceKm !== undefined) {
    if (typeof rawInput.distanceKm !== 'number' || !Number.isInteger(rawInput.distanceKm) || rawInput.distanceKm < 0) {
      errors.distanceKm = 'distanceKm must be a non-negative integer';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new EWayBillValidationError(errors);
  }

  return rawInput as CreateEWayBillDto;
}

export function validateUpdateEWayBillInput(rawInput: any): UpdateEWayBillDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new EWayBillValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new EWayBillValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  const validStatuses = ['GENERATED', 'ACTIVE', 'CANCELLED', 'EXPIRED'];
  if (!rawInput.status || !validStatuses.includes(rawInput.status)) {
    errors.status = `status must be one of: ${validStatuses.join(', ')}`;
  }

  if (rawInput.version === undefined || typeof rawInput.version !== 'number' || rawInput.version < 1) {
    errors.version = 'version is required and must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new EWayBillValidationError(errors);
  }

  return rawInput as UpdateEWayBillDto;
}
