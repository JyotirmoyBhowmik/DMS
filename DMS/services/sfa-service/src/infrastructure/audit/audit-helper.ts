import { AuditController } from '../../../../audit-service/src/presentation/rest/controllers/audit.controller.js';
import { randomUUID } from 'node:crypto';
import { getCorrelation } from '@dms/pkg-logger';

export async function recordAudit(
  actor: string,
  tenantId: string,
  type: string,
  result: string,
  metadata: {
    before?: Record<string, any> | null;
    after?: Record<string, any> | null;
    source?: string;
  }
): Promise<void> {
  try {
    const activeCtx = getCorrelation();
    const correlationId = activeCtx?.correlationId ?? `corr-${randomUUID()}`;
    const auditController = AuditController.getInstance();
    
    await auditController.handlePostRecordEvent(
      {
        eventId: `evt-${randomUUID()}`,
        type,
        actor,
        tenantId,
        result,
        metadata: {
          timestamp: new Date().toISOString(),
          correlationId,
          source: metadata.source || 'API',
          before: metadata.before || null,
          after: metadata.after || null,
        },
      },
      { 'x-tenant-id': tenantId }
    );
  } catch {
    // Non-blocking fallback
  }
}
