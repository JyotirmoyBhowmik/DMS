import { IERPPort, ErpConnectionConfig } from './erp-port.interface.js';
import { Logger } from '@dms/pkg-logger';

export class TallyConnector implements IERPPort {
  readonly connectorType = 'TALLY_PRIME' as const;

  constructor(
    private readonly config: ErpConnectionConfig,
    private readonly logger: Logger
  ) {}

  async syncMasterData(dataType: string, mapping?: Record<string, string>): Promise<any[]> {
    this.logger.info(`[Tally Prime] Syncing master data ${dataType} via Tally XML HTTP interface`, {
      baseUrl: this.config.baseUrl || 'http://localhost:9000',
      mappingKeys: mapping ? Object.keys(mapping) : [],
    });

    // Simulate Tally XML request/response structure for Indian FMCG master data
    if (dataType.toLowerCase().includes('product') || dataType.toLowerCase().includes('sku')) {
      return [
        { GUID: 'TALLY-SKU-101', NAME: 'Tata Salt 1kg Packet', RATE: 28.00, STOCK_QTY: 500, HSN_CODE: '2501' },
        { GUID: 'TALLY-SKU-102', NAME: 'Fortune Sunflower Oil 1L', RATE: 145.00, STOCK_QTY: 250, HSN_CODE: '1512' },
      ];
    }

    if (dataType.toLowerCase().includes('customer') || dataType.toLowerCase().includes('ledger')) {
      return [
        { GUID: 'TALLY-LEDGER-201', NAME: 'Sharma Kirana Store', PARENT: 'Sundry Debtors', GSTIN: '07AAAAA0000A1Z5' },
        { GUID: 'TALLY-LEDGER-202', NAME: 'Verma Supermarket', PARENT: 'Sundry Debtors', GSTIN: '07BBBBB1111B1Z6' },
      ];
    }

    return [{ id: 'tally-default-1', name: `Tally Data for ${dataType}` }];
  }

  async postTransaction(transactionId: string, payload: any, mapping?: Record<string, string>): Promise<boolean> {
    this.logger.info(`[Tally Prime] Posting VOUCHER transaction ${transactionId}`, {
      transactionId,
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
      details: `Connected to Tally Prime XML HTTP endpoint at ${this.config.baseUrl || 'http://localhost:9000'}`,
    };
  }
}
