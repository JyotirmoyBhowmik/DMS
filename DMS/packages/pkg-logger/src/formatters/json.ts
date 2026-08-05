import { getCorrelation } from '../correlation/context.js';
import { redact, PiiRedactor } from '../redaction/redactor.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service?: string;
  correlationId?: string;
  causationId?: string;
  tenantId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

/**
 * Formats a log message as a single-line JSON string.
 * Automatically pulls correlation context from AsyncLocalStorage
 * and redacts any sensitive fields from the metadata.
 */
export function formatJsonLog(
  level: LogLevel,
  message: string,
  bindings: Record<string, unknown>,
  meta?: Record<string, unknown>,
): string {
  const ctx = getCorrelation();
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(ctx
      ? {
          correlationId: ctx.correlationId || undefined,
          causationId: ctx.causationId || undefined,
          tenantId: ctx.tenantId || undefined,
          userId: ctx.userId || undefined,
          traceId: ctx.traceId || undefined,
          spanId: ctx.spanId || undefined,
        }
      : {}),
    ...bindings,
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
  };

  // Strip undefined values for cleaner output
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (v !== undefined) {
      cleaned[k] = v;
    }
  }

  return JSON.stringify(cleaned);
}

// ── Backward-compatible class ──────────────────────────────────

export class StructuredLogger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const line = formatJsonLog(level, message, { service: this.serviceName }, meta);
    process.stdout.write(line + '\n');
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('ERROR', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('DEBUG', message, meta);
  }
}
