import { CreateReportDto } from '../../application/dtos/report.dto.js';
import { ReportType } from '../entities/report.entity.js';

export function validateCreateReportInput(dto: CreateReportDto): void {
  if (!dto) {
    throw new Error('Report payload is required.');
  }
  if (!dto.name || dto.name.trim().length === 0) {
    throw new Error('Report name is required.');
  }

  const validTypes: ReportType[] = ['SALES', 'INVENTORY', 'FINANCIAL', 'AUDIT', 'CUSTOM'];
  if (!dto.type || !validTypes.includes(dto.type)) {
    throw new Error(`Invalid Report type: ${dto.type}`);
  }
}

export function sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params || {})) {
    // Redact any sensitive parameter names
    if (/password|token|secret|ssn|creditCard/i.test(key)) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
