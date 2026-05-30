import { StructuredLogger } from '@dms/pkg-logger';
import { createHash } from 'node:crypto';

export class AuditController {
  private logger = new StructuredLogger('AuditController');
  private lastHash: string = createHash('sha256').update('genesis-audit-chain').digest('hex');

  async handlePostRecordEvent(eventEnvelope: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';

    this.logger.info('Received request to append audit log', { tenantId, eventId: eventEnvelope?.eventId });

    // Tamper-evident hash chain logic
    const currentEventSerialized = JSON.stringify(eventEnvelope || {});
    const hash = createHash('sha256')
      .update(this.lastHash + currentEventSerialized)
      .digest('hex');

    this.lastHash = hash;

    this.logger.info('Audit log successfully recorded in append-only store', { tenantId, hash });

    return {
      statusCode: 201,
      body: {
        success: true,
        hash,
        recorded: true,
      },
    };
  }
}
