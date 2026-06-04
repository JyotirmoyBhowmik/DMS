"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryUnitOfWork = void 0;
/**
 * Reference no-op implementation for testing.  Real adapters live in
 * the infrastructure layer.
 */
class InMemoryUnitOfWork {
    async run(fn) {
        const tx = {
            async query(_sql, _params) {
                return undefined;
            },
            getRepository(_token) {
                return undefined;
            },
        };
        return fn(tx);
    }
}
exports.InMemoryUnitOfWork = InMemoryUnitOfWork;
//# sourceMappingURL=uow.js.map