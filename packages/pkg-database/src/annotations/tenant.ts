import 'reflect-metadata';

const TENANT_METADATA_KEY = 'dms:tenant';

/**
 * Marks a property as the tenant discriminator column.
 * Used by the RLS layer and multi-tenant query scoping
 * to automatically filter data by tenant boundary.
 */
export function Tenant(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(TENANT_METADATA_KEY, true, target, propertyKey);
    (target.constructor as { __tenantField?: string }).__tenantField = String(propertyKey);
  };
}

/**
 * Returns true if the given property is the tenant discriminator.
 */
export function isTenantColumn(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(TENANT_METADATA_KEY, target, propertyKey) === true;
}

/**
 * Returns the tenant discriminator field name for a given entity constructor.
 */
export function getTenantField(ctor: Function): string | undefined {
  return (ctor as { __tenantField?: string }).__tenantField;
}
