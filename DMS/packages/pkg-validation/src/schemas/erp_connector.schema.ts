import { z } from 'zod';

export const CreateErpConnectorSchema = z.object({
  name: z.string().min(1).max(128),
  connectorType: z.enum(['SAP_BAPI', 'SAP_ODATA', 'REST_WEBHOOK', 'SFTP_BATCH']),
  vaultSecretPath: z.string().min(1).max(512),
  entityMapJson: z.record(z.unknown()).optional(),
});

export const ErpSyncRequestSchema = z.object({
  connectorId: z.string().uuid(),
  action: z.enum(['sync-master-data', 'post-transaction']),
  dataType: z.string().optional(),
  transactionId: z.string().uuid().optional(),
  data: z.record(z.unknown()).optional(),
});

export type CreateErpConnectorDTO = z.infer<typeof CreateErpConnectorSchema>;
export type ErpSyncRequestDTO = z.infer<typeof ErpSyncRequestSchema>;
