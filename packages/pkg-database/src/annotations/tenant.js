"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tenant = Tenant;
exports.isTenantColumn = isTenantColumn;
exports.getTenantField = getTenantField;
require("reflect-metadata");
const TENANT_METADATA_KEY = 'dms:tenant';
/**
 * Marks a property as the tenant discriminator column.
 * Used by the RLS layer and multi-tenant query scoping
 * to automatically filter data by tenant boundary.
 */
function Tenant() {
    return (target, propertyKey) => {
        Reflect.defineMetadata(TENANT_METADATA_KEY, true, target, propertyKey);
        target.constructor.__tenantField = String(propertyKey);
    };
}
/**
 * Returns true if the given property is the tenant discriminator.
 */
function isTenantColumn(target, propertyKey) {
    return Reflect.getMetadata(TENANT_METADATA_KEY, target, propertyKey) === true;
}
/**
 * Returns the tenant discriminator field name for a given entity constructor.
 */
function getTenantField(ctor) {
    return ctor.__tenantField;
}
//# sourceMappingURL=tenant.js.map