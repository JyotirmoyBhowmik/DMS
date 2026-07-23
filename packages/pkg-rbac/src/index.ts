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
      'surveys:read',
      'distributor:read',
      'distributors:read',
      'distributor_hierarchy:create',
      'distributor_hierarchy:read',
      'distributor_hierarchy:update',
      'distributor-hierarchies:read',
      'kyc_document:create',
      'kyc_document:read',
      'kyc_document:update',
      'kyc-documents:read',
      'credit_limit:create',
      'credit_limit:read',
      'credit_limit:update',
      'credit-limits:read',
      'outlet:create',
      'outlet:read',
      'outlet:update',
      'outlets:read',
      'product:create',
      'product:read',
      'product:update',
      'products:read',
      'product_category:create',
      'product_category:read',
      'product_category:update',
      'product_categories:read',
      'sku:create',
      'sku:read',
      'sku:update',
      'skus:read',
      'inventory:create',
      'inventory:read',
      'inventory:update',
      'inventories:read',
      'batch:create',
      'batch:read',
      'batch:update',
      'batches:read',
      'stock_ledger:create',
      'stock_ledger:read',
      'stock_ledger:update',
      'stock_ledgers:read',
      'stock_transfer:create',
      'stock_transfer:read',
      'stock_transfer:update',
      'stock_transfers:read',
      'goods_receipt:create',
      'goods_receipt:read',
      'goods_receipt:update',
      'goods_receipts:read',
      'purchase_order:create',
      'purchase_order:read',
      'purchase_order:update',
      'purchase_orders:read',
      'return:create',
      'return:read',
      'return:update',
      'returns:read',
      'replacement:create',
      'replacement:read',
      'replacement:update',
      'replacements:read',
      'primary_sale:create',
      'primary_sale:read',
      'primary_sale:update',
      'primary_sales:read',
      'secondary_sale:create',
      'secondary_sale:read',
      'secondary_sale:update',
      'secondary_sales:read',
      'tertiary_sale:create',
      'tertiary_sale:read',
      'tertiary_sale:update',
      'tertiary_sales:read',
      'price_list:create',
      'price_list:read',
      'price_list:update',
      'price_lists:read',
      'price_slab:create',
      'price_slab:read',
      'price_slab:update',
      'price_slabs:read',
      'geo_price_rule:create',
      'geo_price_rule:read',
      'geo_price_rule:update',
      'geo_price_rules:read',
      'channel_price_rule:create',
      'channel_price_rule:read',
      'channel_price_rule:update',
      'channel_price_rules:read',
      'discount:create',
      'discount:read',
      'discount:update',
      'discounts:read',
      'tax_rule:create',
      'tax_rule:read',
      'tax_rule:update',
      'tax_rules:read',
      'scheme:create',
      'scheme:read',
      'scheme:update',
      'schemes:read',
      'scheme_promotion:create',
      'scheme_promotion:read',
      'scheme_promotion:update',
      'scheme_promotions:read',
      'eligibility_rule:create',
      'eligibility_rule:read',
      'eligibility_rule:update',
      'eligibility_rules:read',
      'scheme_budget:create',
      'scheme_budget:read',
      'scheme_budget:update',
      'scheme_budgets:read',
      'slab_reward:create',
      'slab_reward:read',
      'slab_reward:update',
      'slab_rewards:read',
      'scheme_payout:create',
      'scheme_payout:read',
      'scheme_payout:update',
      'scheme_payouts:read',
      'claim:create',
      'claim:read',
      'claim:update',
      'claims:read'
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
