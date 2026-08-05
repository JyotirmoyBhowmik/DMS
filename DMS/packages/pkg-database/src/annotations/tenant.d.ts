import 'reflect-metadata';
/**
 * Marks a property as the tenant discriminator column.
 * Used by the RLS layer and multi-tenant query scoping
 * to automatically filter data by tenant boundary.
 */
export declare function Tenant(): PropertyDecorator;
/**
 * Returns true if the given property is the tenant discriminator.
 */
export declare function isTenantColumn(target: object, propertyKey: string | symbol): boolean;
/**
 * Returns the tenant discriminator field name for a given entity constructor.
 */
export declare function getTenantField(ctor: Function): string | undefined;
//# sourceMappingURL=tenant.d.ts.map