import { Logger } from '@dms/pkg-logger';
import { ErpConnectorFactory, IERPPort, ErpConnectorType } from '@dms/pkg-integrations';

export interface TenantSyncScheduleConfig {
  tenantId: string;
  connectorType: ErpConnectorType;
  cronSchedule: string; // e.g., '0 */2 * * *' (every 2 hours)
  retryLimit: number;
  backoffMs: number;
}

export interface SyncJobLog {
  id: string;
  tenantId: string;
  connectorType: ErpConnectorType;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RECONCILED';
  attemptCount: number;
  recordsSynced: number;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
}

export class ErpSyncScheduler {
  private static jobLogs: SyncJobLog[] = [];

  constructor(private readonly logger: Logger) {}

  /**
   * Executes a scheduled ERP sync job with exponential backoff retries.
   */
  async executeScheduledSync(
    config: TenantSyncScheduleConfig,
    connector: IERPPort,
    dataType: string = 'MasterData'
  ): Promise<SyncJobLog> {
    const jobId = `job-${Date.now().toString().slice(-6)}`;
    const log: SyncJobLog = {
      id: jobId,
      tenantId: config.tenantId,
      connectorType: config.connectorType,
      status: 'RUNNING',
      attemptCount: 0,
      recordsSynced: 0,
      startedAt: new Date().toISOString(),
    };

    ErpSyncScheduler.jobLogs.unshift(log);

    this.logger.info(`[ErpSyncScheduler] Starting scheduled sync job ${jobId} for tenant ${config.tenantId} (${config.connectorType})`);

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= config.retryLimit; attempt++) {
      log.attemptCount = attempt;
      try {
        const records = await connector.syncMasterData(dataType);
        log.status = 'SUCCESS';
        log.recordsSynced = records.length;
        log.finishedAt = new Date().toISOString();
        this.logger.info(`[ErpSyncScheduler] Sync job ${jobId} succeeded on attempt ${attempt}. Synced ${records.length} records.`);
        return log;
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`[ErpSyncScheduler] Sync job ${jobId} attempt ${attempt} failed: ${err.message}`);
        if (attempt < config.retryLimit) {
          const delay = config.backoffMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    log.status = 'FAILED';
    log.errorMessage = lastError?.message || 'Sync failed after max retries';
    log.finishedAt = new Date().toISOString();
    return log;
  }

  static getLogs(tenantId?: string): SyncJobLog[] {
    if (tenantId) {
      return this.jobLogs.filter((l) => l.tenantId === tenantId);
    }
    return [...this.jobLogs];
  }

  static reconcileJob(jobId: string): void {
    const found = this.jobLogs.find((l) => l.id === jobId);
    if (found) {
      found.status = 'RECONCILED';
      found.errorMessage = undefined;
    }
  }
}
