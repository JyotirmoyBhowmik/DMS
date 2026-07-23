import { ISettlementRepository } from '../../infrastructure/database/repositories/settlement.pg-repository.js';
import { Settlement } from '../../domain/entities/settlement.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class SettlementProjectionHandler {
  private logger = new StructuredLogger('SettlementProjectionHandler');
  private processedEventIds = new Set<string>();

  constructor(private repository: ISettlementRepository) {}

  async handle(event: { id: string; name: string; tenantId: string; payload: any }): Promise<void> {
    if (this.processedEventIds.has(event.id)) {
      this.logger.info(`Duplicate event ${event.id} skipped (idempotent consumer)`);
      return;
    }

    if (event.name === 'claims.settlement.created') {
      const existing = await this.repository.findById(event.payload.id, event.tenantId);
      if (!existing) {
        const settlement = new Settlement({
          id: event.payload.id,
          tenantId: event.tenantId,
          settlementCode: event.payload.settlementCode,
          claimId: event.payload.claimId,
          distributorId: event.payload.distributorId,
          amountCents: event.payload.amountCents,
          paymentReference: event.payload.paymentReference,
          status: event.payload.status,
        });
        await this.repository.save(settlement, event.tenantId);
      }
    } else if (event.name === 'claims.settlement.status_updated') {
      const existing = await this.repository.findById(event.payload.settlementId, event.tenantId);
      if (existing) {
        existing.updateStatus(event.payload.newStatus, event.payload.paymentReference);
        await this.repository.update(existing, event.tenantId);
      }
    }

    this.processedEventIds.add(event.id);
  }
}
