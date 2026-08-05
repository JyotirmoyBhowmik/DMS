import { CreateTaxFilingDto, UpdateTaxFilingDto } from '../../application/dtos/tax-filing.dto.js';
import { TaxFilingValidationError } from '../entities/tax-filing.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'period',
  'taxType',
  'taxableAmountCents',
  'taxAmountCents',
  'acknowledgementNumber',
  'filingDate',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'status',
  'acknowledgementNumber',
  'version'
]);

export function validateCreateTaxFilingInput(rawInput: any): CreateTaxFilingDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new TaxFilingValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new TaxFilingValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.period || typeof rawInput.period !== 'string' || rawInput.period.trim().length === 0) {
    errors.period = 'period is required and must be a non-empty string';
  }

  if (!rawInput.taxType || typeof rawInput.taxType !== 'string' || rawInput.taxType.trim().length === 0) {
    errors.taxType = 'taxType is required and must be a non-empty string';
  }

  if (rawInput.taxableAmountCents !== undefined) {
    if (typeof rawInput.taxableAmountCents !== 'number' || !Number.isInteger(rawInput.taxableAmountCents) || rawInput.taxableAmountCents < 0) {
      errors.taxableAmountCents = 'taxableAmountCents must be a non-negative integer';
    }
  }

  if (rawInput.taxAmountCents !== undefined) {
    if (typeof rawInput.taxAmountCents !== 'number' || !Number.isInteger(rawInput.taxAmountCents) || rawInput.taxAmountCents < 0) {
      errors.taxAmountCents = 'taxAmountCents must be a non-negative integer';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new TaxFilingValidationError(errors);
  }

  return rawInput as CreateTaxFilingDto;
}

export function validateUpdateTaxFilingInput(rawInput: any): UpdateTaxFilingDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new TaxFilingValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new TaxFilingValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  const validStatuses = ['DRAFT', 'FILED', 'ACCEPTED', 'REJECTED'];
  if (!rawInput.status || !validStatuses.includes(rawInput.status)) {
    errors.status = `status must be one of: ${validStatuses.join(', ')}`;
  }

  if (rawInput.version === undefined || typeof rawInput.version !== 'number' || rawInput.version < 1) {
    errors.version = 'version is required and must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new TaxFilingValidationError(errors);
  }

  return rawInput as UpdateTaxFilingDto;
}
