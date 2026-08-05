import { StructuredLogger } from '@dms/pkg-logger';

interface SyncMutation {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  row: {
    id: string;
    version: number;
    [key: string]: any;
  };
  clientTimestamp: number;
}

interface ConflictRecord {
  mutationId: string;
  table: string;
  rowId: string;
  clientVersion: number;
  serverVersion: number;
  resolvedRow: any;
  resolution: 'LWW' | 'MANUAL_REVIEW_REQUIRED';
}

export class SyncController {
  private logger = new StructuredLogger('SyncController');
  
  // A mock database store on the server to check for versions and demonstrate conflict detection
  private serverDbState: Record<string, Record<string, { version: number; data: any }>> = {
    'orders': {
      'ord-101': { version: 2, data: { id: 'ord-101', totalAmount: 150, status: 'completed', updatedAt: Date.now() - 5000 } }
    },
    'inventory_records': {
      'inv-001': { version: 3, data: { id: 'inv-001', sku: 'SKU-FMCG-001', stock: 120, updatedAt: Date.now() - 2000 } }
    }
  };

  async handlePostPush(mutations: SyncMutation[], headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received push synchronization request', { tenantId, count: mutations?.length });

    const conflicts: ConflictRecord[] = [];
    let processedCount = 0;

    if (mutations && Array.isArray(mutations)) {
      for (const mut of mutations) {
        const { table, row, clientTimestamp } = mut;
        const rowId = row.id;

        // Ensure table bucket exists in mock DB
        if (!this.serverDbState[table]) {
          this.serverDbState[table] = {};
        }

        const serverRecord = this.serverDbState[table][rowId];

        if (serverRecord) {
          // Conflict Detection: If client version is less than server version
          if (row.version < serverRecord.version) {
            this.logger.warn('Conflict detected during synchronization', {
              table,
              rowId,
              clientVersion: row.version,
              serverVersion: serverRecord.version
            });

            // Auto-resolve if clientTimestamp is newer (Last-Write-Wins), else flag for manual review
            const serverUpdatedAt = serverRecord.data.updatedAt || 0;
            if (clientTimestamp > serverUpdatedAt) {
              // LWW Resolution
              this.serverDbState[table][rowId] = {
                version: serverRecord.version + 1,
                data: {
                  ...serverRecord.data,
                  ...row,
                  version: serverRecord.version + 1,
                  updatedAt: clientTimestamp
                }
              };
              conflicts.push({
                mutationId: mut.id,
                table,
                rowId,
                clientVersion: row.version,
                serverVersion: serverRecord.version,
                resolvedRow: this.serverDbState[table][rowId].data,
                resolution: 'LWW'
              });
            } else {
              // Manual review required
              conflicts.push({
                mutationId: mut.id,
                table,
                rowId,
                clientVersion: row.version,
                serverVersion: serverRecord.version,
                resolvedRow: serverRecord.data, // Fallback to server version
                resolution: 'MANUAL_REVIEW_REQUIRED'
              });
            }
          } else {
            // No conflict: Client version is equal or greater. Standard update.
            this.serverDbState[table][rowId] = {
              version: row.version + 1,
              data: {
                ...row,
                version: row.version + 1,
                updatedAt: clientTimestamp || Date.now()
              }
            };
            processedCount++;
          }
        } else {
          // Insert new record
          this.serverDbState[table][rowId] = {
            version: 1,
            data: {
              ...row,
              version: 1,
              updatedAt: clientTimestamp || Date.now()
            }
          };
          processedCount++;
        }
      }
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        processed: processedCount,
        conflictsCount: conflicts.length,
        conflicts,
      },
    };
  }
}
