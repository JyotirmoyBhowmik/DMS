import { OutstandingValidationError } from '../entities/outstanding.entity.js';

export function validateCreateOutstandingInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new OutstandingValidationError({ body: 'Input body must be a JSON object' });
  }

  // Mass-assignment protection: reject unknown fields
  const allowedKeys = [
    'distributorId',
    'invoiceId',
    'outstandingReference',
    'amountCents',
    'dueDate',
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

  if (!input.outstandingReference || typeof input.outstandingReference !== 'string' || input.outstandingReference.trim().length === 0) {
    fields.outstandingReference = 'REQUIRED_FIELD: outstandingReference must be a valid non-empty string';
  }

  if (input.amountCents === undefined || typeof input.amountCents !== 'number' || input.amountCents < 0) {
    fields.amountCents = 'INVALID_RANGE: amountCents must be an integer >= 0';
  }

  if (Object.keys(fields).length > 0) {
    throw new OutstandingValidationError(fields);
  }
}

export function validateUpdateOutstandingInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new OutstandingValidationError({ body: 'Input body must be a JSON object' });
  }

  if (input.version === undefined || typeof input.version !== 'number') {
    fields.version = 'REQUIRED_FIELD: version is required for optimistic concurrency check';
  }

  if (input.status !== undefined) {
    const validStatuses = ['OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'WRITTEN_OFF'];
    if (!validStatuses.includes(input.status)) {
      fields.status = `INVALID_ENUM: status must be one of ${validStatuses.join(', ')}`;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new OutstandingValidationError(fields);
  }
}
