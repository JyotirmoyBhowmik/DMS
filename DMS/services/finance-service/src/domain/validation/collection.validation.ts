import { CollectionValidationError } from '../entities/collection.entity.js';

export function validateCreateCollectionInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new CollectionValidationError({ body: 'Input body must be a JSON object' });
  }

  // Mass-assignment protection: reject unknown fields
  const allowedKeys = [
    'distributorId',
    'invoiceId',
    'collectionReference',
    'amountCents',
    'collectionMode',
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

  if (!input.collectionReference || typeof input.collectionReference !== 'string' || input.collectionReference.trim().length === 0) {
    fields.collectionReference = 'REQUIRED_FIELD: collectionReference must be a valid non-empty string';
  }

  if (input.amountCents === undefined || typeof input.amountCents !== 'number' || input.amountCents <= 0) {
    fields.amountCents = 'INVALID_RANGE: amountCents must be a positive integer > 0';
  }

  if (Object.keys(fields).length > 0) {
    throw new CollectionValidationError(fields);
  }
}

export function validateUpdateCollectionInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new CollectionValidationError({ body: 'Input body must be a JSON object' });
  }

  if (input.version === undefined || typeof input.version !== 'number') {
    fields.version = 'REQUIRED_FIELD: version is required for optimistic concurrency check';
  }

  if (input.status !== undefined) {
    const validStatuses = ['DRAFT', 'PENDING', 'COLLECTED', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(input.status)) {
      fields.status = `INVALID_ENUM: status must be one of ${validStatuses.join(', ')}`;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new CollectionValidationError(fields);
  }
}
