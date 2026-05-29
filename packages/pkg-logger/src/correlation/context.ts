import { AsyncLocalStorage } from 'async_hooks';

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
}

export class CorrelationContext {
  private static readonly storage = new AsyncLocalStorage<LogContext>();

  static run<R>(context: LogContext, fn: () => R): R {
    return this.storage.run(context, fn);
  }

  static get(): LogContext | undefined {
    return this.storage.getStore();
  }
}
