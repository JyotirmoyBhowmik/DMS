export interface LogContext {
    correlationId?: string;
    tenantId?: string;
    userId?: string;
}
export declare class CorrelationContext {
    private static readonly storage;
    static run<R>(context: LogContext, fn: () => R): R;
    static get(): LogContext | undefined;
}
//# sourceMappingURL=context.d.ts.map