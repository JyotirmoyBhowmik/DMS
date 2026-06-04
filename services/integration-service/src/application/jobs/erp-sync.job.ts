import { InboundEvent, IConsumerDatabaseClient, IdempotentConsumer } from '@dms/pkg-events';
import { MessageBrokerClient } from '@dms/pkg-events';
import { Logger } from '@dms/pkg-logger';
import { IERPPort } from '@dms/pkg-integrations';

export class ErpSyncJob {
  private consumer: IdempotentConsumer;

  constructor(
    private readonly erpAdapter: IERPPort,
    private readonly db: IConsumerDatabaseClient,
    private readonly broker: MessageBrokerClient,
    private readonly logger: Logger
  ) {
    this.consumer = new IdempotentConsumer(
      this.db,
      this.broker,
      this.handleEvent.bind(this),
      { consumerGroup: 'integration-service-erp-sync' }
    );
  }

  public start() {
    this.logger.info('Starting ERP Sync Job...');
    this.consumer.subscribe('erp.sync.requested.v1');
  }

  private async handleEvent(event: InboundEvent<any>): Promise<void> {
    this.logger.info(`Received sync event: ${event.eventId} for type: ${event.eventType}`);
    
    try {
      const payload = event.payload;
      
      if (payload.action === 'sync-master-data') {
        await this.erpAdapter.syncMasterData(payload.dataType);
      } else if (payload.action === 'post-transaction') {
        await this.erpAdapter.postTransaction(payload.transactionId, payload.data);
      } else {
        this.logger.warn(`Unknown action ${payload.action} in ERP sync event`);
      }
      
    } catch (error) {
      this.logger.error(`Error processing ERP sync event: ${event.eventId}`, { error });
      throw error;
    }
  }
}
