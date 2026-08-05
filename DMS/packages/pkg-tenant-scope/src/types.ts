export type OrgType = 'CUSTOMER' | 'DISTRIBUTOR' | 'OUTLET' | 'PLATFORM';

export type DataClearance = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type SyncProfileId = 'field_full' | 'van' | 'shop_lite' | 'hq_web';

export type PersonaKind =
  | 'customer_hq'
  | 'sales_marketing'
  | 'distributor_admin'
  | 'field_agent'
  | 'van_operator'
  | 'modern_trade'
  | 'small_shop';

/** Claims embedded in JWT access tokens for downstream scope enforcement. */
export interface TokenScopeClaims {
  orgType: OrgType;
  persona: PersonaKind;
  distributorIds: string[];
  outletIds: string[];
  territoryIds: string[];
  moduleEntitlements: string[];
  syncProfile: SyncProfileId;
  dataClearance: DataClearance;
  erpConnectorId?: string;
}

export interface ScopedResource {
  tenantId: string;
  distributorId?: string;
  outletId?: string;
}

export interface TenantBootstrapPayload {
  tenantId: string;
  persona: PersonaKind;
  orgType: OrgType;
  modules: string[];
  syncProfile: SyncProfileId;
  dataClearance: DataClearance;
  featureFlags: Record<string, boolean>;
  minAppVersion: string;
  apiBasePath: string;
}
