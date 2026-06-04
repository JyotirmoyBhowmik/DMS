import { Logger } from '@dms/pkg-logger';
import { SapBapiAdapter, IndiaNicGstAdapter } from '@dms/pkg-integrations';
import { ErpSyncJob } from './application/jobs/erp-sync.job';
import { MessageBrokerClient, IConsumerDatabaseClient } from '@dms/pkg-events';

class MockConsumerDatabaseClient implements IConsumerDatabaseClient {
  async query<T = unknown>(): Promise<{ rows: T[]; rowCount: number }> {
    return { rows: [], rowCount: 0 };
  }
  async transaction<T>(operations: (conn: any) => Promise<T>): Promise<T> {
    const mockConn = {
      query: async () => ({ rows: [], rowCount: 0 })
    };
    return operations(mockConn);
  }
}

async function bootstrap() {
  const logger = new Logger({ service: 'integration-service' });
  logger.info('Starting Integration Service...');

  const db = new MockConsumerDatabaseClient();
  const broker = new MessageBrokerClient({ host: 'localhost' });
  
  const erpAdapter = new SapBapiAdapter(logger);
  const taxAdapter = new IndiaNicGstAdapter(logger);
  
  const erpSyncJob = new ErpSyncJob(erpAdapter, db, broker, logger);
  
  erpSyncJob.start();
  
  logger.info('Integration Service started successfully');
  
  // Keep process alive
  process.on('SIGINT', () => {
    logger.info('Shutting down Integration Service');
    process.exit(0);
  });
}

bootstrap().catch(err => {
  console.error('Failed to start Integration Service', err);
  process.exit(1);
});
