"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tenant = Tenant;
function Tenant() {
    return (target, propertyKey) => {
        target.constructor.__tenantField = propertyKey;
    };
}
//# sourceMappingURL=tenant.js.map