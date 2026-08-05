import { InvoiceValidationError } from '../entities/invoice.entity.js';

export function validateCreateInvoiceInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new InvoiceValidationError({ body: 'Input body must be a JSON object' });
  }

  // Reject unknown fields
  const allowedKeys = [
    'distributorId',
    'orderId',
    'invoiceNumber',
    'grossAmountCents',
    'discountAmountCents',
    'taxAmountCents',
    'netAmountCents',
    'currency',
    'dueDate',
    'idempotencyKey',
    'items'
  ];
  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) {
      fields[key] = `Unknown field '${key}' is not allowed`;
    }
  }

  if (!input.distributorId || typeof input.distributorId !== 'string' || input.distributorId.trim().length === 0) {
    fields.distributorId = 'REQUIRED_FIELD: distributorId must be a valid non-empty string';
  }

  if (!input.invoiceNumber || typeof input.invoiceNumber !== 'string' || input.invoiceNumber.trim().length === 0) {
    fields.invoiceNumber = 'REQUIRED_FIELD: invoiceNumber must be a valid non-empty string';
  }

  if (!input.dueDate) {
    fields.dueDate = 'REQUIRED_FIELD: dueDate is required';
  } else {
    const d = new Date(input.dueDate);
    if (isNaN(d.getTime())) {
      fields.dueDate = 'INVALID_FORMAT: dueDate must be a valid ISO date string';
    }
  }

  if (input.items !== undefined) {
    if (!Array.isArray(input.items)) {
      fields.items = 'INVALID_TYPE: items must be an array';
    } else {
      input.items.forEach((item: any, idx: number) => {
        if (!item.productId) fields[`items[${idx}].productId`] = 'REQUIRED_FIELD: productId is required';
        if (!item.description) fields[`items[${idx}].description`] = 'REQUIRED_FIELD: description is required';
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          fields[`items[${idx}].quantity`] = 'INVALID_RANGE: quantity must be a positive integer';
        }
        if (typeof item.unitPriceCents !== 'number' || item.unitPriceCents < 0) {
          fields[`items[${idx}].unitPriceCents`] = 'INVALID_RANGE: unitPriceCents must be >= 0';
        }
      });
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new InvoiceValidationError(fields);
  }
}

export function validateUpdateInvoiceInput(input: any): void {
  const fields: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    throw new InvoiceValidationError({ body: 'Input body must be a JSON object' });
  }

  if (input.version === undefined || typeof input.version !== 'number') {
    fields.version = 'REQUIRED_FIELD: version is required for optimistic concurrency check';
  }

  if (input.status !== undefined) {
    const validStatuses = ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'CREDIT_NOTE'];
    if (!validStatuses.includes(input.status)) {
      fields.status = `INVALID_ENUM: status must be one of ${validStatuses.join(', ')}`;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new InvoiceValidationError(fields);
  }
}
