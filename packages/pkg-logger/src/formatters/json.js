"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
exports.formatJsonLog = formatJsonLog;
const context_js_1 = require("../correlation/context.js");
const redactor_js_1 = require("../redaction/redactor.js");
/**
 * Formats a log message as a single-line JSON string.
 * Automatically pulls correlation context from AsyncLocalStorage
 * and redacts any sensitive fields from the metadata.
 */
function formatJsonLog(level, message, bindings, meta) {
    const ctx = (0, context_js_1.getCorrelation)();
    const entry = {
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
        ...(meta ? (0, redactor_js_1.redact)(meta) : {}),
    };
    // Strip undefined values for cleaner output
    const cleaned = {};
    for (const [k, v] of Object.entries(entry)) {
        if (v !== undefined) {
            cleaned[k] = v;
        }
    }
    return JSON.stringify(cleaned);
}
// ── Backward-compatible class ──────────────────────────────────
class StructuredLogger {
    serviceName;
    constructor(serviceName) {
        this.serviceName = serviceName;
    }
    log(level, message, meta) {
        const line = formatJsonLog(level, message, { service: this.serviceName }, meta);
        process.stdout.write(line + '\n');
    }
    info(message, meta) {
        this.log('INFO', message, meta);
    }
    warn(message, meta) {
        this.log('WARN', message, meta);
    }
    error(message, meta) {
        this.log('ERROR', message, meta);
    }
    debug(message, meta) {
        this.log('DEBUG', message, meta);
    }
}
exports.StructuredLogger = StructuredLogger;
//# sourceMappingURL=json.js.map