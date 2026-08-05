import { formatJsonLog } from './formatters/json.js';
import type { LogLevel } from './formatters/json.js';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export class Logger {
  private readonly bindings: Record<string, unknown>;
  private readonly minLevel: LogLevel;

  constructor(bindings: Record<string, unknown> = {}, minLevel?: LogLevel) {
    this.bindings = bindings;
    this.minLevel = minLevel ?? ((process.env['LOG_LEVEL'] as LogLevel) || 'DEBUG');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const line = formatJsonLog(level, msg, this.bindings, meta);
    process.stdout.write(line + '\n');
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    this.emit('INFO', msg, meta);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    this.emit('WARN', msg, meta);
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    this.emit('ERROR', msg, meta);
  }

  debug(msg: string, meta?: Record<string, unknown>): void {
    this.emit('DEBUG', msg, meta);
  }

  /**
   * Create a child logger that inherits all parent bindings and
   * merges additional ones. Useful for per-request or per-module
   * contextual logging.
   */
  child(bindings: Record<string, unknown>): Logger {
    return new Logger({ ...this.bindings, ...bindings }, this.minLevel);
  }
}
