import { MerchandisingAuditRepository } from '../../../domain/repositories/merchandising-audit.repository.js';
import { MerchandisingAudit, ShelfPhoto, BrandShelfShare, PricingAuditItem, MerchandisingAuditStatus } from '../../../domain/entities/merchandising-audit.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { MerchandisingAuditPgRepository } from '../../../infrastructure/database/repositories/merchandising-audit.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';
import { Money } from '../../../domain/value-objects/money.js';

export interface UpdateMerchandisingAuditDTO {
  planogramCompliance?: number;
  shelfPhotos?: Array<{ photoUrl: string; category: string; timestamp?: string }>;
  shelfShareByBrand?: BrandShelfShare[];
  outOfStockSkus?: string[];
  pricingAudit?: Array<{ skuId: string; listedPrice: number; actualPrice: number }>;
  displayScore?: number;
  notes?: string | null;
  status?: MerchandisingAuditStatus;
  rejectionReason?: string;
  version: number;
}

export class UpdateMerchandisingAuditUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: MerchandisingAuditRepository
  ) {}

  async execute(
    principal: Principal,
    id: string,
    tenantId: string,
    dto: UpdateMerchandisingAuditDTO
  ): Promise<MerchandisingAudit> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }

    // Role verification (approve vs update)
    if (dto.status === 'APPROVED' || dto.status === 'REJECTED') {
      if (!RbacGuard.can(principal, 'merchandising_audit:approve')) {
        throw new Error('Forbidden: Insufficient permissions, missing merchandising_audit:approve');
      }
    } else {
      if (!RbacGuard.can(principal, 'merchandising_audit:update')) {
        throw new Error('Forbidden: Insufficient permissions, missing merchandising_audit:update');
      }
    }

    const activeRepo = this.repo || new MerchandisingAuditPgRepository(this.db);
    const audit = await activeRepo.findById(id, tenantId);

    if (!audit) {
      throw new Error(`MerchandisingAudit with ID ${id} not found`);
    }

    if (audit.tenantId !== tenantId) {
      throw new Error('Forbidden: access denied to this audit');
    }

    // Version optimistic locking concurrency check
    if (audit.version !== dto.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${audit.version}, requested version ${dto.version}`);
    }

    const beforeState = audit.toJSON();

    // Mutate audit depending on status transitions
    if (dto.status) {
      if (dto.status === 'SUBMITTED') {
        audit.submit();
      } else if (dto.status === 'APPROVED') {
        audit.approve();
      } else if (dto.status === 'REJECTED') {
        if (!dto.rejectionReason) {
          throw new Error('rejectionReason is required for status REJECTED');
        }
        audit.reject(dto.rejectionReason);
      }
    } else {
      // Just updating attributes (allowed only in DRAFT status)
      if (dto.planogramCompliance !== undefined) {
        audit.updatePlanogramCompliance(dto.planogramCompliance);
      }
      if (dto.shelfPhotos !== undefined) {
        // Clear and reload
        const draftPhotos = audit.shelfPhotos as ShelfPhoto[];
        draftPhotos.length = 0;
        for (const p of dto.shelfPhotos) {
          audit.addShelfPhoto({
            photoUrl: p.photoUrl,
            category: p.category,
            timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
          });
        }
      }
      if (dto.shelfShareByBrand !== undefined) {
        audit.updateShelfShare(dto.shelfShareByBrand);
      }
      if (dto.outOfStockSkus !== undefined) {
        const draftOos = audit.outOfStockSkus as string[];
        draftOos.length = 0;
        for (const s of dto.outOfStockSkus) {
          audit.addOutOfStockSku(s);
        }
      }
      if (dto.pricingAudit !== undefined) {
        const draftPricing = audit.pricingAudit as PricingAuditItem[];
        draftPricing.length = 0;
        for (const p of dto.pricingAudit) {
          audit.addPricingAuditItem({
            skuId: p.skuId,
            listedPrice: Money.fromCents(p.listedPrice),
            actualPrice: Money.fromCents(p.actualPrice),
          });
        }
      }
      if (dto.displayScore !== undefined) {
        audit.updateDisplayScore(dto.displayScore);
      }
      if (dto.notes !== undefined && dto.notes !== null) {
        audit.updateNotes(dto.notes);
      }
    }

    audit.incrementVersion();
    const afterState = audit.toJSON();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.merchandising_audit.updated',
      'v1',
      {
        id: audit.id,
        tenantId: audit.tenantId,
        agentId: audit.agentId,
        status: audit.status,
        version: audit.version,
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
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'MerchandisingAudit', audit.id);
        }, tenantId);
      } catch (err: any) {
        await activeRepo.save(audit);
      }
    } else {
      await activeRepo.save(audit);
    }

    await recordAudit(
      principal.id,
      tenantId,
      'merchandising_audit.updated',
      `Merchandising audit ${audit.id} updated`,
      {
        before: beforeState,
        after: afterState,
      }
    );

    return audit;
  }
}
