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

export const correlationStore = new AsyncLocalStorage<CorrelationContext>();

/**
 * Execute `fn` with an active correlation context attached to
 * the current async continuation.
 */
export function withCorrelation<T>(ctx: CorrelationContext, fn: () => T): T {
  return correlationStore.run(ctx, fn);
}

/**
 * Retrieve the current correlation context, or undefined if none is set.
 */
export function getCorrelation(): CorrelationContext | undefined {
  return correlationStore.getStore();
}

/**
 * Class-based facade retained for backward compatibility with the
 * StructuredLogger and any existing consumers.
 */
export class CorrelationContext_Class {
  private static readonly storage = correlationStore;

  static run<R>(context: CorrelationContext | LogContext, fn: () => R): R {
    const full: CorrelationContext = {
      correlationId: context.correlationId ?? '',
      tenantId: (context as CorrelationContext).tenantId ?? (context as LogContext).tenantId ?? '',
      userId: context.userId,
      ...((context as CorrelationContext).causationId !== undefined
        ? { causationId: (context as CorrelationContext).causationId }
        : {}),
      ...((context as CorrelationContext).traceId !== undefined
        ? { traceId: (context as CorrelationContext).traceId }
        : {}),
      ...((context as CorrelationContext).spanId !== undefined
        ? { spanId: (context as CorrelationContext).spanId }
        : {}),
    };
    return this.storage.run(full, fn);
  }

  static get(): CorrelationContext | undefined {
    return this.storage.getStore();
  }
}

/** @deprecated Use CorrelationContext_Class or the functional API. */
export const CorrelationContext = CorrelationContext_Class;
