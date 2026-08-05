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
export declare function formatJsonLog(level: LogLevel, message: string, bindings: Record<string, unknown>, meta?: Record<string, unknown>): string;
export declare class StructuredLogger {
    private serviceName;
    constructor(serviceName: string);
    private log;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=json.d.ts.map