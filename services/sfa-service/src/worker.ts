import { OutboxDispatcher } from '@dms/pkg-events';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { MessageBrokerClient } from '@dms/pkg-events';
import { loadConfigSync } from '@dms/pkg-config';
import { OrderPlacedConsumer } from './presentation/events/order_placed_consumer.js';
import { StructuredLogger } from '@dms/pkg-logger';

const config = loadConfigSync();
const logger = new StructuredLogger('SfaBackgroundWorker');

export class SfaBackgroundWorker {
  private db: PostgresDatabaseClient;
  private broker: MessageBrokerClient;
  private dispatcher: OutboxDispatcher;
  private consumer: OrderPlacedConsumer;
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
      tableName: 'sfa_outbox',
      pollIntervalMs: 200, // fast polling for tests/validation
      batchSize: 10,
    });

    this.consumer = new OrderPlacedConsumer(this.db, this.broker);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    logger.info('Starting SFA background worker components');
    await this.broker.connect();
    
    this.dispatcher.start();
    this.consumer.start();
    logger.info('SFA background worker started successfully');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    logger.info('Stopping SFA background worker components');
    this.dispatcher.stop();
    await this.broker.close();
    await this.db.shutdown();
    logger.info('SFA background worker stopped successfully');
  }
}
