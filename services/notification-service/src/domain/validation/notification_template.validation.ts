import { NotificationTemplateValidationError, NotificationChannel, NotificationTemplateStatus } from '../entities/notification_template.entity.js';
import { CreateNotificationTemplateInputDTO, UpdateNotificationTemplateInputDTO } from '../../application/dtos/notification_template.dto.js';

export function validateCreateNotificationTemplateInput(input: any): CreateNotificationTemplateInputDTO {
  if (!input || typeof input !== 'object') {
    throw new NotificationTemplateValidationError('Invalid input payload: body must be an object');
  }

  const allowedKeys = ['code', 'name', 'channel', 'subject', 'bodyTemplate', 'status', 'idempotencyKey'];
  const unknownKeys = Object.keys(input).filter(key => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new NotificationTemplateValidationError(`Mass assignment violation: Unknown fields [${unknownKeys.join(', ')}] are forbidden`);
  }

  const errors: Record<string, string> = {};

  if (!input.code || typeof input.code !== 'string' || input.code.trim().length === 0) {
    errors.code = 'code is required and must be a non-empty string';
  } else if (!/^[A-Z0-9_-]{3,64}$/i.test(input.code.trim())) {
    errors.code = 'code must be alphanumeric with underscores/dashes (3-64 characters)';
  }

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    errors.name = 'name is required and must be a non-empty string';
  }

  const validChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
  if (!input.channel || !validChannels.includes(input.channel)) {
    errors.channel = `channel must be one of: ${validChannels.join(', ')}`;
  }

  if (!input.bodyTemplate || typeof input.bodyTemplate !== 'string' || input.bodyTemplate.trim().length === 0) {
    errors.bodyTemplate = 'bodyTemplate is required and must be a non-empty string';
  }

  const validStatuses: NotificationTemplateStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
  if (input.status && !validStatuses.includes(input.status)) {
    errors.status = `status must be one of: ${validStatuses.join(', ')}`;
  }

  if (Object.keys(errors).length > 0) {
    throw new NotificationTemplateValidationError('Validation failed for CreateNotificationTemplate input', errors);
  }

  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    channel: input.channel,
    subject: input.subject !== undefined && input.subject !== null ? String(input.subject).trim() : null,
    bodyTemplate: input.bodyTemplate.trim(),
    status: input.status || 'ACTIVE',
    idempotencyKey: input.idempotencyKey ? String(input.idempotencyKey) : undefined,
  };
}

export function validateUpdateNotificationTemplateInput(input: any): UpdateNotificationTemplateInputDTO {
  if (!input || typeof input !== 'object') {
    throw new NotificationTemplateValidationError('Invalid input payload: body must be an object');
  }

  const allowedKeys = ['name', 'subject', 'bodyTemplate', 'status', 'version'];
  const unknownKeys = Object.keys(input).filter(key => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new NotificationTemplateValidationError(`Mass assignment violation: Unknown fields [${unknownKeys.join(', ')}] are forbidden`);
  }

  const errors: Record<string, string> = {};

  if (input.version === undefined || typeof input.version !== 'number' || input.version < 1) {
    errors.version = 'version is required and must be a positive integer >= 1';
  }

  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
    errors.name = 'name must be a non-empty string';
  }

  if (input.bodyTemplate !== undefined && (typeof input.bodyTemplate !== 'string' || input.bodyTemplate.trim().length === 0)) {
    errors.bodyTemplate = 'bodyTemplate must be a non-empty string';
  }

  const validStatuses: NotificationTemplateStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
  if (input.status !== undefined && !validStatuses.includes(input.status)) {
    errors.status = `status must be one of: ${validStatuses.join(', ')}`;
  }

  if (Object.keys(errors).length > 0) {
    throw new NotificationTemplateValidationError('Validation failed for UpdateNotificationTemplate input', errors);
  }

  return {
    name: input.name ? input.name.trim() : undefined,
    subject: input.subject !== undefined ? (input.subject ? String(input.subject).trim() : null) : undefined,
    bodyTemplate: input.bodyTemplate ? input.bodyTemplate.trim() : undefined,
    status: input.status,
    version: input.version,
  };
}
