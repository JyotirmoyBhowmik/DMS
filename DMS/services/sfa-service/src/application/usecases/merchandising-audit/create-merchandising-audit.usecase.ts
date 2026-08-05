import { MerchandisingAuditRepository } from '../../../domain/repositories/merchandising-audit.repository.js';
import { MerchandisingAudit, ShelfPhoto, BrandShelfShare, PricingAuditItem } from '../../../domain/entities/merchandising-audit.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { MerchandisingAuditPgRepository } from '../../../infrastructure/database/repositories/merchandising-audit.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';
import { Money } from '../../../domain/value-objects/money.js';

export interface CreateMerchandisingAuditDTO {
  id?: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  visitId?: string | null;
  auditDate: string;
  shelfPhotos: Array<{ photoUrl: string; category: string; timestamp?: string }>;
  planogramCompliance: number;
  shelfShareByBrand: BrandShelfShare[];
  outOfStockSkus: string[];
  pricingAudit: Array<{ skuId: string; listedPrice: number; actualPrice: number }>;
  displayScore: number;
  notes?: string | null;
}

export class CreateMerchandisingAuditUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: MerchandisingAuditRepository
  ) {}

  async execute(principal: Principal, dto: CreateMerchandisingAuditDTO): Promise<MerchandisingAudit> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'merchandising_audit:create')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new MerchandisingAuditPgRepository(this.db);

    // Idempotency: search for existing audit with same agent, outlet and date
    const existingList = await activeRepo.findByAgent(dto.agentId, dto.tenantId);
    const dup = existingList.find((e) => e.outletId === dto.outletId && e.auditDate === dto.auditDate);
    if (dup) {
      return dup;
    }

    const pricingItems = dto.pricingAudit.map((p) => ({
      skuId: p.skuId,
      listedPrice: Money.fromCents(p.listedPrice),
      actualPrice: Money.fromCents(p.actualPrice),
    }));

    const audit = MerchandisingAudit.create({
      id: dto.id || randomUUID(),
      tenantId: dto.tenantId,
      agentId: dto.agentId,
      outletId: dto.outletId,
      visitId: dto.visitId,
      auditDate: dto.auditDate,
      shelfPhotos: dto.shelfPhotos.map(p => ({
        photoUrl: p.photoUrl,
        category: p.category,
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      })),
      planogramCompliance: dto.planogramCompliance,
      shelfShareByBrand: dto.shelfShareByBrand,
      outOfStockSkus: dto.outOfStockSkus,
      pricingAudit: pricingItems,
      displayScore: dto.displayScore,
      notes: dto.notes,
      status: 'DRAFT',
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.merchandising_audit.created',
      'v1',
      {
        id: audit.id,
        tenantId: audit.tenantId,
        agentId: audit.agentId,
        outletId: audit.outletId,
        auditDate: audit.auditDate,
        status: audit.status,
      },
      {
        tenantId: audit.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: audit.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new MerchandisingAuditPgRepository(txDb);

          await txRepo.save(audit);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'MerchandisingAudit', audit.id);
        }, dto.tenantId);
      } catch (err: any) {
        await activeRepo.save(audit);
      }
    } else {
      await activeRepo.save(audit);
    }

    await recordAudit(
      principal.id,
      dto.tenantId,
      'merchandising_audit.created',
      `Merchandising audit created for outlet ${audit.outletId}`,
      {
        before: null,
        after: audit.toJSON(),
      }
    );

    return audit;
  }
}
