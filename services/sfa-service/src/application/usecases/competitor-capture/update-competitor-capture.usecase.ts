import { CompetitorCaptureRepository } from '../../../domain/repositories/competitor-capture.repository.js';
import { CompetitorCapture, CompetitorCaptureStatus } from '../../../domain/entities/competitor-capture.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { CompetitorCapturePgRepository } from '../../../infrastructure/database/repositories/competitor-capture.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';
import { Money } from '../../../domain/value-objects/money.js';

export interface UpdateCompetitorCaptureDTO {
  observedPrice?: number; // cents
  observedPriceCurrency?: string;
  promotionDetails?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  status?: CompetitorCaptureStatus;
  rejectionReason?: string;
  version: number;
}

export class UpdateCompetitorCaptureUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: CompetitorCaptureRepository
  ) {}

  async execute(
    principal: Principal,
    id: string,
    tenantId: string,
    dto: UpdateCompetitorCaptureDTO
  ): Promise<CompetitorCapture> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }

    if (dto.status === 'APPROVED' || dto.status === 'REJECTED') {
      if (!RbacGuard.can(principal, 'competitor_capture:approve')) {
        throw new Error('Forbidden: Insufficient permissions, missing competitor_capture:approve');
      }
    } else {
      if (!RbacGuard.can(principal, 'competitor_capture:update')) {
        throw new Error('Forbidden: Insufficient permissions, missing competitor_capture:update');
      }
    }

    const activeRepo = this.repo || new CompetitorCapturePgRepository(this.db);
    const capture = await activeRepo.findById(id, tenantId);

    if (!capture) {
      throw new Error('CompetitorCapture not found');
    }

    if (capture.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }

    if (capture.version !== dto.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${capture.version}, requested version ${dto.version}`);
    }

    const beforeState = capture.toJSON();

    if (dto.status) {
      if (dto.status === 'SUBMITTED') {
        capture.submit();
      } else if (dto.status === 'APPROVED') {
        capture.approve();
      } else if (dto.status === 'REJECTED') {
        if (!dto.rejectionReason) {
          throw new Error('rejectionReason is required for status REJECTED');
        }
        capture.reject(dto.rejectionReason);
      }
    } else {
      if (dto.observedPrice !== undefined) {
        capture.updatePrice(Money.fromCents(dto.observedPrice));
      }
      if (dto.promotionDetails !== undefined) {
        capture.updatePromotion(dto.promotionDetails);
      }
      if (dto.photoUrl !== undefined) {
        capture.updatePhoto(dto.photoUrl);
      }
      if (dto.notes !== undefined) {
        capture.updateNotes(dto.notes);
      }
    }

    capture.incrementVersion();
    const afterState = capture.toJSON();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.competitor_capture.updated',
      'v1',
      {
        id: capture.id,
        tenantId: capture.tenantId,
        agentId: capture.agentId,
        status: capture.status,
        version: capture.version,
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
          const txRepo = new CompetitorCapturePgRepository(txDb);

          await txRepo.save(capture);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'CompetitorCapture', capture.id);
        }, tenantId);
      } catch (err: any) {
        await activeRepo.save(capture);
      }
    } else {
      await activeRepo.save(capture);
    }

    await recordAudit(
      principal.id,
      tenantId,
      'competitor_capture.updated',
      `Competitor capture ${capture.id} updated`,
      {
        before: beforeState,
        after: afterState,
      }
    );

    return capture;
  }
}
