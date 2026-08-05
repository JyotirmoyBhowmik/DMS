import { CreateEInvoiceDto, UpdateEInvoiceDto } from '../../application/dtos/einvoice.dto.js';
import { EInvoiceValidationError } from '../entities/einvoice.entity.js';

const ALLOWED_CREATE_KEYS = new Set([
  'invoiceId',
  'irn',
  'qrCode',
  'acknowledgementNumber',
  'acknowledgementDate',
  'taxAmountCents',
  'totalAmountCents',
  'idempotencyKey'
]);

const ALLOWED_UPDATE_KEYS = new Set([
  'status',
  'version'
]);

export function validateCreateEInvoiceInput(rawInput: any): CreateEInvoiceDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new EInvoiceValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  // Mass assignment defense
  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_CREATE_KEYS.has(key)) {
      throw new EInvoiceValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  if (!rawInput.invoiceId || typeof rawInput.invoiceId !== 'string' || rawInput.invoiceId.trim().length === 0) {
    errors.invoiceId = 'invoiceId is required and must be a non-empty string';
  }

  if (!rawInput.irn || typeof rawInput.irn !== 'string' || rawInput.irn.trim().length === 0) {
    errors.irn = 'irn is required and must be a non-empty string';
  }

  if (rawInput.taxAmountCents !== undefined) {
    if (typeof rawInput.taxAmountCents !== 'number' || !Number.isInteger(rawInput.taxAmountCents) || rawInput.taxAmountCents < 0) {
      errors.taxAmountCents = 'taxAmountCents must be a non-negative integer (cents)';
    }
  }

  if (rawInput.totalAmountCents !== undefined) {
    if (typeof rawInput.totalAmountCents !== 'number' || !Number.isInteger(rawInput.totalAmountCents) || rawInput.totalAmountCents < 0) {
      errors.totalAmountCents = 'totalAmountCents must be a non-negative integer (cents)';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new EInvoiceValidationError(errors);
  }

  return rawInput as CreateEInvoiceDto;
}

export function validateUpdateEInvoiceInput(rawInput: any): UpdateEInvoiceDto {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new EInvoiceValidationError({ body: 'Request body must be a valid JSON object' });
  }

  const errors: Record<string, string> = {};

  for (const key of Object.keys(rawInput)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      throw new EInvoiceValidationError({ massAssignment: `Unknown field '${key}' is not allowed` });
    }
  }

  const validStatuses = ['PENDING', 'GENERATED', 'CANCELLED', 'FAILED'];
  if (!rawInput.status || !validStatuses.includes(rawInput.status)) {
    errors.status = `status must be one of: ${validStatuses.join(', ')}`;
  }

  if (rawInput.version === undefined || typeof rawInput.version !== 'number' || rawInput.version < 1) {
    errors.version = 'version is required and must be a positive integer >= 1';
  }

  if (Object.keys(errors).length > 0) {
    throw new EInvoiceValidationError(errors);
  }

  return rawInput as UpdateEInvoiceDto;
}
