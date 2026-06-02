import { AsyncLocalStorage } from 'async_hooks';
export interface CorrelationContext {
    correlationId: string;
    causationId?: string;
    tenantId: string;
    userId?: string;
    traceId?: string;
    spanId?: string;
}
/**
 * Backward-compatible alias for consumers that used the
 * lighter shape from the first scaffolded iteration.
 */
export interface LogContext {
    correlationId?: string;
    tenantId?: string;
    userId?: string;
}
export declare const correlationStore: AsyncLocalStorage<CorrelationContext>;
/**
 * Execute `fn` with an active correlation context attached to
 * the current async continuation.
 */
export declare function withCorrelation<T>(ctx: CorrelationContext, fn: () => T): T;
/**
 * Retrieve the current correlation context, or undefined if none is set.
 */
export declare function getCorrelation(): CorrelationContext | undefined;
/**
 * Class-based facade retained for backward compatibility with the
 * StructuredLogger and any existing consumers.
 */
export declare class CorrelationContext_Class {
    private static readonly storage;
    static run<R>(context: CorrelationContext | LogContext, fn: () => R): R;
    static get(): CorrelationContext | undefined;
}
/** @deprecated Use CorrelationContext_Class or the functional API. */
export declare const CorrelationContext: typeof CorrelationContext_Class;
//# sourceMappingURL=context.d.ts.map