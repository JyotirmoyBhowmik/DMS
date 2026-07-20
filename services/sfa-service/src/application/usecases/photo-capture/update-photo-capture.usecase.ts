import { PhotoCaptureRepository } from '../../../domain/repositories/photo-capture.repository.js';
import { PhotoCapture, PhotoCaptureStatus } from '../../../domain/entities/photo-capture.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { PhotoCapturePgRepository } from '../../../infrastructure/database/repositories/photo-capture.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface UpdatePhotoCaptureDTO {
  id: string;
  tenantId: string;
  photoUrl?: string;
  tags?: string[];
  notes?: string | null;
  status?: PhotoCaptureStatus;
  rejectionReason?: string;
  version: number;
}

export class UpdatePhotoCaptureUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: PhotoCaptureRepository
  ) {}

  async execute(principal: Principal, dto: UpdatePhotoCaptureDTO): Promise<PhotoCapture> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }

    const activeRepo = this.repo || new PhotoCapturePgRepository(this.db);
    const capture = await activeRepo.findById(dto.id, dto.tenantId);

    if (!capture || capture.tenantId !== dto.tenantId) {
      throw new Error(`PhotoCapture record with ID ${dto.id} not found`);
    }

    if (capture.version !== dto.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${capture.version}, requested version ${dto.version}`);
    }

    const originalState = capture.toJSON();

    // Check RBAC based on status transition
    if (dto.status === 'APPROVED' || dto.status === 'REJECTED') {
      if (!RbacGuard.can(principal, 'photo_capture:approve') && !RbacGuard.can(principal, '*')) {
        throw new Error('Forbidden: Only admin can approve or reject photo captures');
      }
    } else {
      if (!RbacGuard.can(principal, 'photo_capture:update')) {
        throw new Error('Forbidden: Insufficient permissions to update photo capture');
      }
    }

    // Apply updates based on domain business rules
    if (dto.photoUrl !== undefined) {
      capture.updatePhotoUrl(dto.photoUrl);
    }
    if (dto.tags !== undefined) {
      capture.updateTags(dto.tags);
    }
    if (dto.notes !== undefined) {
      capture.updateNotes(dto.notes);
    }

    // Apply state transitions
    if (dto.status === 'SUBMITTED') {
      capture.submit();
    } else if (dto.status === 'APPROVED') {
      capture.approve();
    } else if (dto.status === 'REJECTED') {
      capture.reject(dto.rejectionReason || 'No reason provided');
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.photo_capture.updated',
      'v1',
      {
        id: capture.id,
        tenantId: capture.tenantId,
        agentId: capture.agentId,
        outletId: capture.outletId,
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

    capture.incrementVersion();

    await recordAudit(
      principal.id,
      dto.tenantId,
      'photo_capture.updated',
      `Photo capture updated to status ${capture.status}`,
      {
        before: originalState,
        after: capture.toJSON(),
      }
    );

    return capture;
  }
}
