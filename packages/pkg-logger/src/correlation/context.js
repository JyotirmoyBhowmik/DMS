"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationContext = void 0;
const async_hooks_1 = require("async_hooks");
class CorrelationContext {
    static storage = new async_hooks_1.AsyncLocalStorage();
    static run(context, fn) {
        return this.storage.run(context, fn);
    }
    static get() {
        return this.storage.getStore();
    }
}
exports.CorrelationContext = CorrelationContext;
//# sourceMappingURL=context.js.map