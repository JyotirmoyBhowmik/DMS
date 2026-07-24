import { PaymentValidationError } from '../entities/payment.entity.js';

export function validateCreatePaymentInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new PaymentValidationError({ body: 'Input body must be a JSON object' });
  }

  // Mass-assignment protection: reject unknown fields
  const allowedKeys = [
    'distributorId',
    'invoiceId',
    'paymentReference',
    'amountCents',
    'paymentMethod',
    'currency',
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

  if (!input.paymentReference || typeof input.paymentReference !== 'string' || input.paymentReference.trim().length === 0) {
    fields.paymentReference = 'REQUIRED_FIELD: paymentReference must be a valid non-empty string';
  }

  if (input.amountCents === undefined || typeof input.amountCents !== 'number' || input.amountCents <= 0) {
    fields.amountCents = 'INVALID_RANGE: amountCents must be a positive integer > 0';
  }

  if (Object.keys(fields).length > 0) {
    throw new PaymentValidationError(fields);
  }
}

export function validateUpdatePaymentInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new PaymentValidationError({ body: 'Input body must be a JSON object' });
  }

  if (input.version === undefined || typeof input.version !== 'number') {
    fields.version = 'REQUIRED_FIELD: version is required for optimistic concurrency check';
  }

  if (input.status !== undefined) {
    const validStatuses = ['DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'];
    if (!validStatuses.includes(input.status)) {
      fields.status = `INVALID_ENUM: status must be one of ${validStatuses.join(', ')}`;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new PaymentValidationError(fields);
  }
}
