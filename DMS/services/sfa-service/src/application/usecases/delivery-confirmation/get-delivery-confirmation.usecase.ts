import { IDeliveryConfirmationRepository } from '../../../domain/repositories/delivery-confirmation.repository.js';
import { DeliveryConfirmation } from '../../../domain/entities/delivery-confirmation.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { DeliveryConfirmationPgRepository } from '../../../infrastructure/database/repositories/delivery-confirmation.pg-repository.js';

export class GetDeliveryConfirmationUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: IDeliveryConfirmationRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<DeliveryConfirmation> {
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
    const confirmation = await activeRepo.findById(id, tenantId);

    if (!confirmation) {
      throw new Error(`DeliveryConfirmation with ID ${id} not found`);
    }

    if (confirmation.tenantId !== tenantId) {
      throw new Error('Forbidden: access denied to this confirmation');
    }

    return confirmation;
  }
}
