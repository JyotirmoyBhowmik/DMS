import { IERPPort } from './erp-port.interface';
import { Logger } from '@dms/pkg-logger';

export class SapBapiAdapter implements IERPPort {
  private failureCount = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;

  constructor(private readonly logger: Logger) {}

  async syncMasterData(dataType: string): Promise<any[]> {
    if (this.isCircuitOpen()) {
      this.logger.warn(`Circuit breaker open. Aborting sync for ${dataType}`);
      throw new Error('Circuit breaker open');
    }

    this.logger.info(`Starting SAP BAPI sync for master data: ${dataType}`);

    try {
      // Simulate API call
      await this.simulateApiCall();
      this.failureCount = 0; // reset on success
      this.logger.info(`Successfully synced ${dataType} from SAP BAPI`);
      return [{ id: 'mock-1', name: 'Mock Data 1' }];
    } catch (error) {
      this.failureCount++;
      this.logger.error(`Failed to sync ${dataType} from SAP BAPI`, { error });
      throw error;
    }
  }

  async postTransaction(transactionId: string, payload: any): Promise<boolean> {
    if (this.isCircuitOpen()) {
      this.logger.warn(`Circuit breaker open. Aborting post for ${transactionId}`);
      throw new Error('Circuit breaker open');
    }

    this.logger.info(`Posting transaction ${transactionId} via SAP BAPI`);

    try {
      // Simulate API call
      await this.simulateApiCall();
      this.failureCount = 0;
      this.logger.info(`Successfully posted transaction ${transactionId} to SAP BAPI`);
      return true;
    } catch (error) {
      this.failureCount++;
      this.logger.error(`Failed to post transaction ${transactionId} to SAP BAPI`, { error });
      throw error;
    }
  }

  private isCircuitOpen(): boolean {
    return this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD;
  }

  private simulateApiCall(): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.8) {
          reject(new Error('Simulated network failure'));
        } else {
          resolve();
        }
      }, 500);
    });
  }
}
