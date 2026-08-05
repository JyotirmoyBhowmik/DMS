import { CompetitorCaptureRepository } from '../../../domain/repositories/competitor-capture.repository.js';
import { CompetitorCapture } from '../../../domain/entities/competitor-capture.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { CompetitorCapturePgRepository } from '../../../infrastructure/database/repositories/competitor-capture.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';
import { Money } from '../../../domain/value-objects/money.js';

export interface CreateCompetitorCaptureDTO {
  id?: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  captureDate: string; // YYYY-MM-DD
  brand: string;
  skuId: string;
  observedPrice: number; // cents
  observedPriceCurrency?: string;
  promotionDetails?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export class CreateCompetitorCaptureUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: CompetitorCaptureRepository
  ) {}

  async execute(principal: Principal, dto: CreateCompetitorCaptureDTO): Promise<CompetitorCapture> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'competitor_capture:create')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new CompetitorCapturePgRepository(this.db);

    // Idempotency: check if competitor capture for this agent, outlet, date, brand and sku already exists
    const existingList = await activeRepo.findByAgent(dto.agentId, dto.tenantId);
    const dup = existingList.find(
      (c) =>
        c.outletId === dto.outletId &&
        c.captureDate === dto.captureDate &&
        c.brand.toLowerCase() === dto.brand.toLowerCase() &&
        c.skuId === dto.skuId
    );
    if (dup) {
      return dup;
    }

    const capture = CompetitorCapture.create({
      id: dto.id || randomUUID(),
      tenantId: dto.tenantId,
      agentId: dto.agentId,
      outletId: dto.outletId,
      captureDate: dto.captureDate,
      brand: dto.brand,
      skuId: dto.skuId,
      observedPrice: Money.fromCents(dto.observedPrice),
      promotionDetails: dto.promotionDetails,
      photoUrl: dto.photoUrl,
      notes: dto.notes,
      status: 'DRAFT',
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.competitor_capture.created',
      'v1',
      {
        id: capture.id,
        tenantId: capture.tenantId,
        agentId: capture.agentId,
        outletId: capture.outletId,
        captureDate: capture.captureDate,
        brand: capture.brand,
        skuId: capture.skuId,
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
          const txRepo = new CompetitorCapturePgRepository(txDb);

          await txRepo.save(capture);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'CompetitorCapture', capture.id);
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
      'competitor_capture.created',
      `Competitor capture created for brand ${capture.brand} at outlet ${capture.outletId}`,
      {
        before: null,
        after: capture.toJSON(),
      }
    );

    return capture;
  }
}
