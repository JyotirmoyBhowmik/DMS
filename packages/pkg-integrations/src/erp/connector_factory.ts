import { IERPPort, ErpConnectorType, ErpConnectionConfig } from './erp-port.interface.js';
import { SapBapiAdapter } from './sap-bapi.adapter.js';
import { TallyConnector } from './tally-connector.adapter.js';
import { GenericRestCsvSftpAdapter } from './generic-rest-csv-sftp.adapter.js';
import { Logger } from '@dms/pkg-logger';

export class ErpConnectorFactory {
  static createConnector(
    type: ErpConnectorType,
    config: ErpConnectionConfig,
    logger: Logger
  ): IERPPort {
    switch (type) {
      case 'SAP_BAPI':
        return new SapBapiAdapter(logger);
      case 'TALLY_PRIME':
        return new TallyConnector(config, logger);
      case 'GENERIC_REST':
        return new GenericRestCsvSftpAdapter(config, false, logger);
      case 'CSV_SFTP':
        return new GenericRestCsvSftpAdapter(config, true, logger);
      default:
        throw new Error(`Unsupported ERP connector type: ${type}`);
    }
  }
}
