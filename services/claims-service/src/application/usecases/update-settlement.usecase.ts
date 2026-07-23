import { Settlement } from '../../domain/entities/settlement.js';
import { ISettlementRepository } from '../../infrastructure/database/repositories/settlement.pg-repository.js';
import { UpdateSettlementInput } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class UpdateSettlementUseCase {
  private logger = new StructuredLogger('UpdateSettlementUseCase');

  constructor(private repository: ISettlementRepository) {}

  async execute(principal: any, id: string, input: UpdateSettlementInput): Promise<Settlement> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('settlement:update')) {
      throw new Error('Forbidden: Insufficient permissions to update settlement');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`Settlement with ID ${id} not found`);
    }

    if (input.status) {
      existing.updateStatus(input.status, input.paymentReference);
    }

    const updated = await this.repository.update(existing, principal.tenantId);
    this.logger.info(`Updated Settlement ${id} for tenant ${principal.tenantId}`);
    return updated;
  }
}
