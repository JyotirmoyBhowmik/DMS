import { PhotoCaptureRepository } from '../../../domain/repositories/photo-capture.repository.js';
import { PhotoCapture } from '../../../domain/entities/photo-capture.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { PhotoCapturePgRepository } from '../../../infrastructure/database/repositories/photo-capture.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface CreatePhotoCaptureDTO {
  id?: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  captureDate: string; // YYYY-MM-DD
  photoUrl: string;
  tags?: string[];
  notes?: string | null;
}

export class CreatePhotoCaptureUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: PhotoCaptureRepository
  ) {}

  async execute(principal: Principal, dto: CreatePhotoCaptureDTO): Promise<PhotoCapture> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'photo_capture:create')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new PhotoCapturePgRepository(this.db);

    // Idempotency check: agent, outlet and same photoUrl
    const existingList = await activeRepo.findByAgent(dto.agentId, dto.tenantId);
    const dup = existingList.find(
      (c) =>
        c.outletId === dto.outletId &&
        c.photoUrl === dto.photoUrl
    );
    if (dup) {
      return dup;
    }

    const capture = PhotoCapture.create({
      id: dto.id || randomUUID(),
      tenantId: dto.tenantId,
      agentId: dto.agentId,
      outletId: dto.outletId,
      captureDate: dto.captureDate,
      photoUrl: dto.photoUrl,
      tags: dto.tags,
      notes: dto.notes,
      status: 'DRAFT',
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.photo_capture.created',
      'v1',
      {
        id: capture.id,
        tenantId: capture.tenantId,
        agentId: capture.agentId,
        outletId: capture.outletId,
        captureDate: capture.captureDate,
        photoUrl: capture.photoUrl,
        status: capture.status,
      },
      {
        tenantId: capture.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: capture.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new PhotoCapturePgRepository(txDb);

          await txRepo.save(capture);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'PhotoCapture', capture.id);
        }, dto.tenantId);
      } catch (err: any) {
        await activeRepo.save(capture);
      }
    } else {
      await activeRepo.save(capture);
    }

    await recordAudit(
      principal.id,
      dto.tenantId,
      'photo_capture.created',
      `Photo capture created for outlet ${capture.outletId}`,
      {
        before: null,
        after: capture.toJSON(),
      }
    );

    return capture;
  }
}
