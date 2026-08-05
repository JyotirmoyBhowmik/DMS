import { Settlement } from '../../domain/entities/settlement.js';
import { ISettlementRepository } from '../../infrastructure/database/repositories/settlement.pg-repository.js';


export class GetSettlementUseCase {
  constructor(private repository: ISettlementRepository) {}

  async execute(principal: any, id: string): Promise<Settlement> {
    if (!principal.tenantId) {
      throw new Error('Forbidden: Tenant context is required');
    }

    if (!principal.roles?.includes('admin') && !principal.permissions?.includes('settlement:read')) {
      throw new Error('Forbidden: Insufficient permissions to read settlement');
    }

    const settlement = await this.repository.findById(id, principal.tenantId);
    if (!settlement) {
      throw new Error(`Settlement with ID ${id} not found`);
    }

    return settlement;
  }
}
