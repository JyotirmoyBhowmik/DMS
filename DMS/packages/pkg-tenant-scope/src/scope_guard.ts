import type { TokenScopeClaims, ScopedResource } from './types.js';

export class ScopeGuard {
  /**
   * Customer-wide scope: empty distributorIds means all distributors in tenant.
   */
  static canAccessResource(scope: TokenScopeClaims, resource: ScopedResource): boolean {
    if (!resource.tenantId) {
      return false;
    }

    if (resource.distributorId) {
      if (scope.distributorIds.length > 0 && !scope.distributorIds.includes(resource.distributorId)) {
        return false;
      }
    }

    if (resource.outletId) {
      if (scope.outletIds.length > 0 && !scope.outletIds.includes(resource.outletId)) {
        return false;
      }
    }

    return true;
  }

  static hasModule(scope: TokenScopeClaims, moduleKey: string): boolean {
    return scope.moduleEntitlements.includes(moduleKey);
  }

  static scopeHeaders(scope: TokenScopeClaims): Record<string, string> {
    return {
      'x-org-type': scope.orgType,
      'x-persona': scope.persona,
      'x-sync-profile': scope.syncProfile,
      'x-data-clearance': scope.dataClearance,
      'x-distributor-ids': scope.distributorIds.join(','),
      'x-outlet-ids': scope.outletIds.join(','),
      'x-module-entitlements': scope.moduleEntitlements.join(','),
      ...(scope.erpConnectorId ? { 'x-erp-connector-id': scope.erpConnectorId } : {}),
    };
  }

  static parseScopeFromJwtPayload(payload: Record<string, unknown>): TokenScopeClaims | undefined {
    if (!payload.orgType || !payload.persona) {
      return undefined;
    }
    return {
      orgType: payload.orgType as TokenScopeClaims['orgType'],
      persona: payload.persona as TokenScopeClaims['persona'],
      distributorIds: (payload.distributorIds as string[]) ?? [],
      outletIds: (payload.outletIds as string[]) ?? [],
      territoryIds: (payload.territoryIds as string[]) ?? [],
      moduleEntitlements: (payload.moduleEntitlements as string[]) ?? [],
      syncProfile: (payload.syncProfile as TokenScopeClaims['syncProfile']) ?? 'field_full',
      dataClearance: (payload.dataClearance as TokenScopeClaims['dataClearance']) ?? 'INTERNAL',
      erpConnectorId: payload.erpConnectorId as string | undefined,
    };
  }
}
