import { UpsertUserScopeSchema } from '@dms/pkg-validation';
import { buildDefaultScopeClaims } from '@dms/pkg-tenant-scope';
import type { TokenScopeClaims } from '@dms/pkg-tenant-scope';
import type { UserScopeRepository } from '../../domain/repositories/user_scope.repository.js';

export interface ScopePrincipal {
  id: string;
  tenantId: string;
  roles: string[];
}

export class UpsertUserScopeUseCase {
  constructor(private readonly repo: UserScopeRepository) {}

  async execute(principal: ScopePrincipal, body: unknown): Promise<TokenScopeClaims> {
    if (!principal.roles.includes('admin')) {
      throw new Error('Forbidden: admin role required to manage user scopes');
    }

    const dto = UpsertUserScopeSchema.parse(body);
    const base = buildDefaultScopeClaims(principal.roles, {
      orgType: dto.orgType,
      persona: dto.persona,
      distributorIds: dto.distributorIds,
      outletIds: dto.outletIds,
      territoryIds: dto.territoryIds,
      moduleEntitlements: dto.moduleEntitlements,
      syncProfile: dto.syncProfile,
      dataClearance: dto.dataClearance,
      erpConnectorId: dto.erpConnectorId,
    });

    return this.repo.upsert(principal.tenantId, dto.userId, base);
  }
}

export class GetUserScopeUseCase {
  constructor(private readonly repo: UserScopeRepository) {}

  async execute(tenantId: string, userKey: string, roles: string[]): Promise<TokenScopeClaims> {
    const stored = await this.repo.findByUser(tenantId, userKey);
    return stored ?? buildDefaultScopeClaims(roles);
  }
}
