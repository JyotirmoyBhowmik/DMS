import { StructuredLogger } from '@dms/pkg-logger';
import { AuditBlock } from '../../domain/entities/audit-block.js';
import { AuditRepository } from '../../domain/repositories/audit.repository.js';
import { makeEnvelope } from '@dms/pkg-events';

export interface RecordAuditResult {
  blockNumber: number;
  hash: string;
  event: any;
}

export class RecordAuditUseCase {
  private logger = new StructuredLogger('RecordAuditUseCase');

  async execute(
    repo: AuditRepository,
    tenantId: string,
    eventPayload: any
  ): Promise<RecordAuditResult> {
    this.logger.info('Recording audit event in append-only cryptographic store', { tenantId, eventId: eventPayload?.eventId });

    const lastBlock = await repo.getLastBlock();
    if (!lastBlock) {
      throw new Error('Genesis block missing in repository');
    }

    const nextBlockNumber = lastBlock.blockNumber + 1;
    const prevHash = lastBlock.hash;

    const block = AuditBlock.create({
      blockNumber: nextBlockNumber,
      prevHash,
      data: eventPayload,
      tenantId,
    });

    await repo.append(block);

    // Emit audit.recorded.v1 outbox event for compliance audits
    const auditEvent = makeEnvelope(
      'audit.recorded',
      'v1',
      {
        blockNumber: block.blockNumber,
        blockHash: block.hash,
        prevHash: block.prevHash,
        targetTenantId: tenantId,
        recordedAt: block.timestamp,
      },
      {
        tenantId,
        correlationId: eventPayload?.metadata?.correlationId ?? 'correlation-uuid-mock',
        producer: 'audit-service',
        partitionKey: String(block.blockNumber),
      }
    );

    this.logger.info('Audit block appended and audit.recorded event raised', {
      blockNumber: block.blockNumber,
      hash: block.hash.slice(0, 16) + '...',
      eventId: auditEvent.eventId,
    });

    return {
      blockNumber: block.blockNumber,
      hash: block.hash,
      event: auditEvent,
    };
  }
}
