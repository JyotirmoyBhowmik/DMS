"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const json_js_1 = require("./formatters/json.js");
const LOG_LEVEL_PRIORITY = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};
class Logger {
    bindings;
    minLevel;
    constructor(bindings = {}, minLevel) {
        this.bindings = bindings;
        this.minLevel = minLevel ?? (process.env['LOG_LEVEL'] || 'DEBUG');
    }
    shouldLog(level) {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
    }
    emit(level, msg, meta) {
        if (!this.shouldLog(level))
            return;
        const line = (0, json_js_1.formatJsonLog)(level, msg, this.bindings, meta);
        process.stdout.write(line + '\n');
    }
    info(msg, meta) {
        this.emit('INFO', msg, meta);
    }
    warn(msg, meta) {
        this.emit('WARN', msg, meta);
    }
    error(msg, meta) {
        this.emit('ERROR', msg, meta);
    }
    debug(msg, meta) {
        this.emit('DEBUG', msg, meta);
    }
    /**
     * Create a child logger that inherits all parent bindings and
     * merges additional ones. Useful for per-request or per-module
     * contextual logging.
     */
    child(bindings) {
        return new Logger({ ...this.bindings, ...bindings }, this.minLevel);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map