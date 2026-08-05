import { StructuredLogger } from '@dms/pkg-logger';
import { VanSale } from '../../../domain/entities/van-sale.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { VanSalePgRepository } from '../../../infrastructure/database/repositories/van-sale.pg-repository.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';

export class GetVanSaleUseCase {
  private logger = new StructuredLogger('GetVanSaleUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VanSalePgRepository,
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<VanSale> {
    this.logger.info('Executing GetVanSaleUseCase', { id, tenantId });

    // 1. Enforce RBAC + Tenant isolation
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'van_sale:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new VanSalePgRepository(this.db);
    const vanSale = await activeRepo.findById(id, tenantId);
    
    if (!vanSale) {
      this.logger.warn('Van sale session not found', { id, tenantId });
      throw new Error(`Van sale session not found for ID ${id}`);
    }

    if (vanSale.tenantId !== tenantId) {
      this.logger.warn('Tenant mismatch forbidden access', { id, tenantId, entityTenant: vanSale.tenantId });
      throw new Error('Forbidden: access denied to this session');
    }

    return vanSale;
  }
}
