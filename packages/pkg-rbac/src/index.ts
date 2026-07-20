import 'reflect-metadata';

export interface Principal {
  id: string;
  tenantId: string;
  roles: string[];
}

export type Permission = string;

export interface Role {
  name: string;
  permissions: Permission[];
}

const PERMISSION_METADATA_KEY = Symbol('dms:required-permissions');

/**
 * Decorator to enforce required permissions on a class method.
 */
export function RequirePermissions(...permissions: Permission[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): void => {
    Reflect.defineMetadata(PERMISSION_METADATA_KEY, permissions, target, propertyKey);
  };
}

/**
 * Returns required permissions for a method if defined.
 */
export function getRequiredPermissions(target: object, propertyKey: string | symbol): Permission[] {
  return Reflect.getMetadata(PERMISSION_METADATA_KEY, target, propertyKey) ?? [];
}

export class RbacGuard {
  private static rolePermissions: Record<string, Permission[]> = {
    admin: ['*'],
    agent: [
      'visit:create',
      'visit:read',
      'order:create',
      'order:read',
      'sync:push',
      'file:upload',
      'van_sale:create',
      'van_sale:read',
      'van_sale:update',
      'van-sales:read',
      'delivery_confirmation:create',
      'delivery_confirmation:read',
      'delivery_confirmation:update',
      'delivery-confirmations:read',
      'merchandising_audit:create',
      'merchandising_audit:read',
      'merchandising_audit:update',
      'merchandising-audits:read',
      'competitor_capture:create',
      'competitor_capture:read',
      'competitor_capture:update',
      'competitor-captures:read',
      'photo_capture:create',
      'photo_capture:read',
      'photo_capture:update',
      'photo-captures:read',
      'sales_target:read',
      'sales-targets:read',
      'kpi_achievement:read',
      'kpi-achievements:read',
      'field_rep:read',
      'field-reps:read',
      'survey:create',
      'survey:read',
      'survey:update',
      'surveys:read'
    ],
    distributor: [
      'inventory:read',
      'inventory:update',
      'order:read',
      'claims:create',
      'claims:read'
    ],
    auditor: [
      'audit:read',
      'audit:verify'
    ]
  };

  /**
   * Predicate checks if a principal has the required permission.
   * Wildcards are supported (e.g. '*' allows everything, or 'visit:*' allows all visit scopes).
   */
  static can(principal: Principal, requiredPermission: Permission): boolean {
    if (!principal || !Array.isArray(principal.roles)) {
      return false;
    }

    for (const role of principal.roles) {
      const perms = this.rolePermissions[role.toLowerCase()];
      if (perms) {
        // Admin wildcard
        if (perms.includes('*')) {
          return true;
        }

        // Exact match
        if (perms.includes(requiredPermission)) {
          return true;
        }

        // Action wildcard (e.g. required: 'visit:create', assigned: 'visit:*')
        const requiredScope = requiredPermission.split(':')[0];
        if (requiredScope && perms.includes(`${requiredScope}:*`)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Helper class to validate method invocation permissions against a principal.
   */
  static checkPermission(principal: Principal, target: object, propertyKey: string | symbol): boolean {
    const required = getRequiredPermissions(target, propertyKey);
    if (required.length === 0) {
      return true;
    }
    return required.every(perm => this.can(principal, perm));
  }
}
