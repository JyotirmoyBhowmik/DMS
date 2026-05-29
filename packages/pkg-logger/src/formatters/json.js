"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
const context_1 = require("../correlation/context");
const redactor_1 = require("../redaction/redactor");
class StructuredLogger {
    serviceName;
    constructor(serviceName) {
        this.serviceName = serviceName;
    }
    log(level, message, meta) {
        const context = context_1.CorrelationContext.get() || {};
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            service: this.serviceName,
            message: redactor_1.PiiRedactor.redact(message),
            ...context,
            meta: meta ? redactor_1.PiiRedactor.redactObject(meta) : undefined,
        };
        process.stdout.write(JSON.stringify(payload) + '\n');
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
}
exports.StructuredLogger = StructuredLogger;
//# sourceMappingURL=json.js.map