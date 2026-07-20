import { IDeliveryConfirmationRepository } from '../../../domain/repositories/delivery-confirmation.repository.js';
import { DeliveryConfirmation, DeliveryStatus } from '../../../domain/entities/delivery-confirmation.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { DeliveryConfirmationPgRepository } from '../../../infrastructure/database/repositories/delivery-confirmation.pg-repository.js';

export class ListDeliveryConfirmationsUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: IDeliveryConfirmationRepository
  ) {}

  async execute(
    principal: Principal,
    tenantId: string,
    query: {
      page?: number;
      pageSize?: number;
      status?: DeliveryStatus;
      orderId?: string;
    } = {}
  ): Promise<{ data: DeliveryConfirmation[]; total: number; page: number; pageSize: number }> {
    // 1. Enforce RBAC + Tenant isolation
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'delivery_confirmation:read')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new DeliveryConfirmationPgRepository(this.db);
    let list = await activeRepo.findByTenant(tenantId, 1000, 0);

    // Apply filtering
    if (query.status) {
      list = list.filter(c => c.status === query.status);
    }
    if (query.orderId) {
      list = list.filter(c => c.orderId === query.orderId);
    }

    const total = list.length;
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 100, 100);
    const startIdx = (page - 1) * pageSize;
    const paginatedData = list.slice(startIdx, startIdx + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
    };
  }
}
