import { MerchandisingAuditRepository } from '../../../domain/repositories/merchandising-audit.repository.js';
import { MerchandisingAudit } from '../../../domain/entities/merchandising-audit.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { MerchandisingAuditPgRepository } from '../../../infrastructure/database/repositories/merchandising-audit.pg-repository.js';

export class GetMerchandisingAuditUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: MerchandisingAuditRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<MerchandisingAudit> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'merchandising_audit:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new MerchandisingAuditPgRepository(this.db);
    const audit = await activeRepo.findById(id, tenantId);

    if (!audit || audit.tenantId !== tenantId) {
      throw new Error(`MerchandisingAudit with ID ${id} not found`);
    }

    return audit;
  }
}
