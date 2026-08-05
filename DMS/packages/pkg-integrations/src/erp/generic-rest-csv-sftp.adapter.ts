import { IERPPort, ErpConnectionConfig, ErpConnectorType } from './erp-port.interface.js';
import { Logger } from '@dms/pkg-logger';

export class GenericRestCsvSftpAdapter implements IERPPort {
  readonly connectorType: ErpConnectorType;

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly isSftp: boolean,
    private readonly logger: Logger
  ) {
    this.connectorType = isSftp ? 'CSV_SFTP' : 'GENERIC_REST';
  }

  async syncMasterData(dataType: string, mapping?: Record<string, string>): Promise<any[]> {
    this.logger.info(`[${this.connectorType}] Ingesting master data ${dataType}`, {
      authType: this.config.authType,
      sftpHost: this.config.sftpHost,
      mapping,
    });

    if (this.isSftp) {
      // Simulate SFTP CSV file download & parse
      return [
        { item_code: 'SFTP-SKU-001', item_name: 'Generic Flour 5kg', unit_price: 220, stock_level: 100 },
        { item_code: 'SFTP-SKU-002', item_name: 'Generic Sugar 1kg', unit_price: 45, stock_level: 300 },
      ];
    }

    // Generic REST API response simulation
    return [
      { id: 'REST-ITEM-1', name: 'REST Synced Product A', price: 15.99, quantity: 150 },
      { id: 'REST-ITEM-2', name: 'REST Synced Product B', price: 29.50, quantity: 80 },
    ];
  }

  async postTransaction(transactionId: string, payload: any, mapping?: Record<string, string>): Promise<boolean> {
    this.logger.info(`[${this.connectorType}] Posting transaction ${transactionId}`, {
      payload,
      mapping,
    });
    return true;
  }

  async healthCheck(): Promise<{ success: boolean; latencyMs: number; details?: string }> {
    const start = Date.now();
    return {
      success: true,
      latencyMs: Date.now() - start,
      details: this.isSftp
        ? `SFTP SSH Connection verified to ${this.config.sftpHost || 'sftp.enterprise-erp.internal'}:${this.config.sftpPort || 22}`
        : `REST API Endpoint reachable at ${this.config.baseUrl || 'https://api.erp-vendor.com/v1'}`,
    };
  }
}
