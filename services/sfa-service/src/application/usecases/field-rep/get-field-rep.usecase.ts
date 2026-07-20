import { FieldRepRepository } from '../../../domain/repositories/field-rep.repository.js';
import { FieldRep } from '../../../domain/entities/field-rep.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { FieldRepPgRepository } from '../../../infrastructure/database/repositories/field-rep.pg-repository.js';

export class GetFieldRepUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: FieldRepRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<FieldRep> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'field_rep:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view field representatives');
    }

    const activeRepo = this.repo || new FieldRepPgRepository(this.db);
    const rep = await activeRepo.findById(id, tenantId);

    if (!rep) {
      throw new Error(`Field representative with ID ${id} not found`);
    }

    return rep;
  }
}
