import { CreateAuditLogDto } from '../../application/dtos/audit_log.dto.js';
import { AuditLogSource, AuditLogStatus } from '../entities/audit_log.entity.js';

export function validateCreateAuditLogInput(dto: CreateAuditLogDto): void {
  if (!dto) {
    throw new Error('AuditLog input payload is required.');
  }
  if (!dto.actorId || dto.actorId.trim().length === 0) {
    throw new Error('AuditLog actorId is required.');
  }
  if (!dto.action || dto.action.trim().length === 0) {
    throw new Error('AuditLog action is required.');
  }
  if (!dto.entityType || dto.entityType.trim().length === 0) {
    throw new Error('AuditLog entityType is required.');
  }
  if (!dto.entityId || dto.entityId.trim().length === 0) {
    throw new Error('AuditLog entityId is required.');
  }

  if (dto.source) {
    const validSources: AuditLogSource[] = ['WEB', 'MOBILE', 'API', 'SYSTEM'];
    if (!validSources.includes(dto.source)) {
      throw new Error(`Invalid AuditLog source: ${dto.source}`);
    }
  }

  if (dto.status) {
    const validStatuses: AuditLogStatus[] = ['SUCCESS', 'FAILURE', 'SUSPICIOUS'];
    if (!validStatuses.includes(dto.status)) {
      throw new Error(`Invalid AuditLog status: ${dto.status}`);
    }
  }

  if (dto.details !== undefined && (typeof dto.details !== 'object' || dto.details === null)) {
    throw new Error('AuditLog details must be an object.');
  }
}

export function redactSensitiveAuditDetails(details: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'secret', 'token', 'ssn', 'creditCard', 'authHeader'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = redactSensitiveAuditDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
