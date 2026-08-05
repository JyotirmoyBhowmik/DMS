import { ReturnEntity } from '../../../domain/entities/return.js';
import { ReturnPgRepository } from '../../../infrastructure/database/repositories/return.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetReturnUseCase {
  constructor(private returnRepo: ReturnPgRepository) {}

  async execute(principal: Principal, id: string): Promise<ReturnEntity | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'return:read') && !RbacGuard.can(principal, 'returns:read')) {
      throw new Error('Forbidden: Insufficient permissions to read return record');
    }

    // 2. Fetch record scoped to tenant
    const ret = await this.returnRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!ret || ret.tenantId !== principal.tenantId) {
      return null;
    }

    return ret;
  }
}
