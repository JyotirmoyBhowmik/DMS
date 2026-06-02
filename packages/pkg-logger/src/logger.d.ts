import type { LogLevel } from './formatters/json.js';
export declare class Logger {
    private readonly bindings;
    private readonly minLevel;
    constructor(bindings?: Record<string, unknown>, minLevel?: LogLevel);
    private shouldLog;
    private emit;
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
    error(msg: string, meta?: Record<string, unknown>): void;
    debug(msg: string, meta?: Record<string, unknown>): void;
    /**
     * Create a child logger that inherits all parent bindings and
     * merges additional ones. Useful for per-request or per-module
     * contextual logging.
     */
    child(bindings: Record<string, unknown>): Logger;
}
//# sourceMappingURL=logger.d.ts.map