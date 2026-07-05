import { OutboxDispatcher } from '@dms/pkg-events';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { MessageBrokerClient } from '@dms/pkg-events';
import { loadConfigSync } from '@dms/pkg-config';
import { StructuredLogger } from '@dms/pkg-logger';

const config = loadConfigSync();
const logger = new StructuredLogger('PricingBackgroundWorker');

export class PricingBackgroundWorker {
  private db: PostgresDatabaseClient;
  private broker: MessageBrokerClient;
  private dispatcher: OutboxDispatcher;
  private running = false;

  constructor() {
    this.db = new PostgresDatabaseClient(config.db, new PgDriver());
    this.broker = new MessageBrokerClient({
      host: config.rabbitmq.host,
      port: config.rabbitmq.port,
      username: config.rabbitmq.user,
      password: config.rabbitmq.password,
      exchange: 'dms.events',
    });

    this.dispatcher = new OutboxDispatcher(this.db, this.broker, {
      tableName: 'pricing_outbox',
      pollIntervalMs: 200,
      batchSize: 10,
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    logger.info('Starting Pricing background worker components');
    await this.broker.connect();
    
    this.dispatcher.start();
    logger.info('Pricing background worker started successfully');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    logger.info('Stopping Pricing background worker components');
    this.dispatcher.stop();
    await this.broker.close();
    await this.db.shutdown();
    logger.info('Pricing background worker stopped successfully');
  }
}
