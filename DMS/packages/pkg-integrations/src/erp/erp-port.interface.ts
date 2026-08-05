export type ErpConnectorType = 'SAP_BAPI' | 'TALLY_PRIME' | 'GENERIC_REST' | 'CSV_SFTP';

export interface ErpConnectionConfig {
  baseUrl?: string;
  authType?: 'BASIC' | 'BEARER' | 'API_KEY' | 'OAUTH2' | 'SFTP_SSH';
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  sftpHost?: string;
  sftpPort?: number;
  customHeaders?: Record<string, string>;
}

export interface IERPPort {
  readonly connectorType: ErpConnectorType;
  syncMasterData(dataType: string, mapping?: Record<string, string>): Promise<any[]>;
  postTransaction(transactionId: string, payload: any, mapping?: Record<string, string>): Promise<boolean>;
  healthCheck?(): Promise<{ success: boolean; latencyMs: number; details?: string }>;
}
