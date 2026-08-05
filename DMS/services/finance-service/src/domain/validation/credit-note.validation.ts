import { CreditNoteValidationError } from '../entities/credit-note.entity.js';

export function validateCreateCreditNoteInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new CreditNoteValidationError({ body: 'Input body must be a JSON object' });
  }

  // Mass-assignment protection: reject unknown fields
  const allowedKeys = [
    'distributorId',
    'invoiceId',
    'creditNoteNumber',
    'amountCents',
    'currency',
    'reason',
    'idempotencyKey'
  ];
  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) {
      fields[key] = `Unknown field '${key}' is not allowed`;
    }
  }

  if (!input.distributorId || typeof input.distributorId !== 'string' || input.distributorId.trim().length === 0) {
    fields.distributorId = 'REQUIRED_FIELD: distributorId must be a valid non-empty string';
  }

  if (!input.creditNoteNumber || typeof input.creditNoteNumber !== 'string' || input.creditNoteNumber.trim().length === 0) {
    fields.creditNoteNumber = 'REQUIRED_FIELD: creditNoteNumber must be a valid non-empty string';
  }

  if (input.amountCents === undefined || typeof input.amountCents !== 'number' || input.amountCents <= 0) {
    fields.amountCents = 'INVALID_RANGE: amountCents must be a positive integer > 0';
  }

  if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length === 0) {
    fields.reason = 'REQUIRED_FIELD: reason must be a valid non-empty string';
  }

  if (Object.keys(fields).length > 0) {
    throw new CreditNoteValidationError(fields);
  }
}

export function validateUpdateCreditNoteInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new CreditNoteValidationError({ body: 'Input body must be a JSON object' });
  }

  if (input.version === undefined || typeof input.version !== 'number') {
    fields.version = 'REQUIRED_FIELD: version is required for optimistic concurrency check';
  }

  if (input.status !== undefined) {
    const validStatuses = ['DRAFT', 'APPROVED', 'APPLIED', 'CANCELLED'];
    if (!validStatuses.includes(input.status)) {
      fields.status = `INVALID_ENUM: status must be one of ${validStatuses.join(', ')}`;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new CreditNoteValidationError(fields);
  }
}
