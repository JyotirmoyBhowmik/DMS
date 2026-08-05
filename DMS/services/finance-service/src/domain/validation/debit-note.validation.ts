import { DebitNoteValidationError } from '../entities/debit-note.entity.js';

export function validateCreateDebitNoteInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new DebitNoteValidationError({ body: 'Input body must be a JSON object' });
  }

  // Mass-assignment protection: reject unknown fields
  const allowedKeys = [
    'distributorId',
    'invoiceId',
    'debitNoteNumber',
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

  if (!input.debitNoteNumber || typeof input.debitNoteNumber !== 'string' || input.debitNoteNumber.trim().length === 0) {
    fields.debitNoteNumber = 'REQUIRED_FIELD: debitNoteNumber must be a valid non-empty string';
  }

  if (input.amountCents === undefined || typeof input.amountCents !== 'number' || input.amountCents <= 0) {
    fields.amountCents = 'INVALID_RANGE: amountCents must be a positive integer > 0';
  }

  if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length === 0) {
    fields.reason = 'REQUIRED_FIELD: reason must be a valid non-empty string';
  }

  if (Object.keys(fields).length > 0) {
    throw new DebitNoteValidationError(fields);
  }
}

export function validateUpdateDebitNoteInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new DebitNoteValidationError({ body: 'Input body must be a JSON object' });
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
    throw new DebitNoteValidationError(fields);
  }
}
