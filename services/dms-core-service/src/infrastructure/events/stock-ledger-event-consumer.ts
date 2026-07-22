import { StockLedgerPgRepository } from '../database/repositories/stock_ledger.pg-repository.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class StockLedgerEventConsumer {
  private logger = new StructuredLogger('StockLedgerEventConsumer');

  constructor(private stockLedgerRepo: StockLedgerPgRepository) {}

  async processEvent(envelope: any): Promise<void> {
    this.logger.info('Inbound stock ledger event received for projection', {
      eventId: envelope.eventId,
      type: envelope.type,
      tenantId: envelope.tenantId,
    });
  }
}
