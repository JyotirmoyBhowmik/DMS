"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationContext = exports.CorrelationContext_Class = exports.correlationStore = void 0;
exports.withCorrelation = withCorrelation;
exports.getCorrelation = getCorrelation;
const async_hooks_1 = require("async_hooks");
exports.correlationStore = new async_hooks_1.AsyncLocalStorage();
/**
 * Execute `fn` with an active correlation context attached to
 * the current async continuation.
 */
function withCorrelation(ctx, fn) {
    return exports.correlationStore.run(ctx, fn);
}
/**
 * Retrieve the current correlation context, or undefined if none is set.
 */
function getCorrelation() {
    return exports.correlationStore.getStore();
}
/**
 * Class-based facade retained for backward compatibility with the
 * StructuredLogger and any existing consumers.
 */
class CorrelationContext_Class {
    static storage = exports.correlationStore;
    static run(context, fn) {
        const full = {
            correlationId: context.correlationId ?? '',
            tenantId: context.tenantId ?? context.tenantId ?? '',
            userId: context.userId,
            ...(context.causationId !== undefined
                ? { causationId: context.causationId }
                : {}),
            ...(context.traceId !== undefined
                ? { traceId: context.traceId }
                : {}),
            ...(context.spanId !== undefined
                ? { spanId: context.spanId }
                : {}),
        };
        return this.storage.run(full, fn);
    }
    static get() {
        return this.storage.getStore();
    }
}
exports.CorrelationContext_Class = CorrelationContext_Class;
/** @deprecated Use CorrelationContext_Class or the functional API. */
exports.CorrelationContext = CorrelationContext_Class;
//# sourceMappingURL=context.js.map