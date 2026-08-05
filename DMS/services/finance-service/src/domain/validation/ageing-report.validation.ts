import { CreateAgeingReportDto, UpdateAgeingReportDto } from '../../application/dtos/ageing-report.dto.js';
import { AgeingReportValidationError } from '../entities/ageing-report.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'distributorId',
  'asOfDate',
  'currentBucketCents',
  'bucket1To30Cents',
  'bucket31To60Cents',
  'bucket61To90Cents',
  'bucket90PlusCents',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'status',
  'version'
]);

export function validateCreateAgeingReportInput(rawInput: any): CreateAgeingReportDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new AgeingReportValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new AgeingReportValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.distributorId || typeof rawInput.distributorId !== 'string' || rawInput.distributorId.trim().length === 0) {
    errors.distributorId = 'distributorId is required and must be a non-empty string';
  }

  if (!rawInput.asOfDate || typeof rawInput.asOfDate !== 'string' || isNaN(Date.parse(rawInput.asOfDate))) {
    errors.asOfDate = 'asOfDate is required and must be a valid ISO date string (YYYY-MM-DD)';
  }

  const numericBuckets = ['currentBucketCents', 'bucket1To30Cents', 'bucket31To60Cents', 'bucket61To90Cents', 'bucket90PlusCents'];
  for (const bucket of numericBuckets) {
    if (rawInput[bucket] !== undefined) {
      if (typeof rawInput[bucket] !== 'number' || !Number.isInteger(rawInput[bucket]) || rawInput[bucket] < 0) {
        errors[bucket] = `${bucket} must be a non-negative integer (cents)`;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AgeingReportValidationError(errors);
  }

  return rawInput as CreateAgeingReportDto;
}

export function validateUpdateAgeingReportInput(rawInput: any): UpdateAgeingReportDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new AgeingReportValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new AgeingReportValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  const validStatuses = ['GENERATED', 'VERIFIED', 'RECONCILED', 'ARCHIVED'];
  if (!rawInput.status || !validStatuses.includes(rawInput.status)) {
    errors.status = `status must be one of: ${validStatuses.join(', ')}`;
  }

  if (rawInput.version === undefined || typeof rawInput.version !== 'number' || rawInput.version < 1) {
    errors.version = 'version is required and must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new AgeingReportValidationError(errors);
  }

  return rawInput as UpdateAgeingReportDto;
}
