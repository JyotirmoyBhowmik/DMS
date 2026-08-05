import type { PersonaKind, SyncProfileId, TokenScopeClaims } from './types.js';

/** Module keys gate mobile / web routes and API aggregates. */
export const PERSONA_MODULES: Record<PersonaKind, string[]> = {
  customer_hq: [
    'dms.full',
    'dms.analytics',
    'dms.erp.admin',
    'sfa.targets',
    'finance.read',
  ],
  sales_marketing: [
    'dms.analytics',
    'schemes',
    'pricing.read',
    'sfa.targets',
    'reports',
  ],
  distributor_admin: [
    'dms.inventory',
    'dms.orders',
    'dms.grn',
    'sfa.delivery',
    'claims',
  ],
  field_agent: [
    'sfa.visits',
    'sfa.orders',
    'sfa.geo',
    'sfa.surveys',
    'sync.push',
  ],
  van_operator: [
    'sfa.van_sale',
    'sfa.stock',
    'sync.lite',
  ],
  modern_trade: [
    'sfa.enterprise_order',
    'sfa.delivery_slots',
    'pricing.contract',
  ],
  small_shop: [
    'sfa.order_simple',
    'sfa.collection',
    'schemes.eligible',
  ],
};

export const PERSONA_SYNC_PROFILE: Record<PersonaKind, SyncProfileId> = {
  customer_hq: 'hq_web',
  sales_marketing: 'hq_web',
  distributor_admin: 'hq_web',
  field_agent: 'field_full',
  van_operator: 'van',
  modern_trade: 'shop_lite',
  small_shop: 'shop_lite',
};

export const ROLE_DEFAULT_PERSONA: Record<string, PersonaKind> = {
  admin: 'customer_hq',
  agent: 'field_agent',
  distributor: 'distributor_admin',
  van_operator: 'van_operator',
  outlet: 'small_shop',
  sales_manager: 'sales_marketing',
};

export function resolvePersonaFromRoles(roles: string[]): PersonaKind {
  for (const role of roles) {
    const persona = ROLE_DEFAULT_PERSONA[role.toLowerCase()];
    if (persona) {
      return persona;
    }
  }
  return 'field_agent';
}

export function buildDefaultScopeClaims(
  roles: string[],
  overrides?: Partial<TokenScopeClaims>,
): TokenScopeClaims {
  const persona = overrides?.persona ?? resolvePersonaFromRoles(roles);
  const orgType =
    overrides?.orgType ??
    (persona === 'distributor_admin'
      ? 'DISTRIBUTOR'
      : persona === 'small_shop' || persona === 'modern_trade'
        ? 'OUTLET'
        : 'CUSTOMER');

  return {
    orgType,
    persona,
    distributorIds: overrides?.distributorIds ?? [],
    outletIds: overrides?.outletIds ?? [],
    territoryIds: overrides?.territoryIds ?? [],
    moduleEntitlements: overrides?.moduleEntitlements ?? [...PERSONA_MODULES[persona]],
    syncProfile: overrides?.syncProfile ?? PERSONA_SYNC_PROFILE[persona],
    dataClearance: overrides?.dataClearance ?? (orgType === 'OUTLET' ? 'INTERNAL' : 'CONFIDENTIAL'),
    erpConnectorId: overrides?.erpConnectorId,
  };
}
