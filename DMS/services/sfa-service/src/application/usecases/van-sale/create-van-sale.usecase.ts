import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateVanSaleInput } from '@dms/pkg-validation';
import { VanSale } from '../../../domain/entities/van-sale.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { VanSalePgRepository } from '../../../infrastructure/database/repositories/van-sale.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export class CreateVanSaleUseCase {
  private logger = new StructuredLogger('CreateVanSaleUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VanSalePgRepository,
  ) {}

  async execute(
    principal: Principal,
    tenantId: string,
    input: CreateVanSaleInput,
    idempotencyKey?: string,
  ): Promise<{ vanSaleId: string; status: string }> {
    this.logger.info('Executing CreateVanSaleUseCase', { tenantId, agentId: input.agentId, date: input.date });

    // 1. Enforce RBAC + Tenant isolation
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'van_sale:create')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new VanSalePgRepository(this.db);
    
    // Check if the exact session ID already exists (idempotency by ID)
    const vanSaleId = input.id || `van-${Date.now()}`;
    const existing = await activeRepo.findById(vanSaleId, tenantId);
    if (existing) {
      this.logger.info('Van sale session already exists, returning existing session ID', { vanSaleId });
      return {
        vanSaleId: existing.id,
        status: existing.status,
      };
    }

    // Check unique pre-conditions: one session per agent per date
    const agentSessions = await activeRepo.findByAgent(input.agentId, tenantId);
    const dateConflict = agentSessions.find((s) => s.date === input.date);
    if (dateConflict) {
      throw new Error(`Agent ${input.agentId} already has a van sale session active for date ${input.date}`);
    }

    const vanSale = VanSale.create({
      id: vanSaleId,
      tenantId,
      agentId: input.agentId,
      vehicleId: input.vehicleId,
      routeId: input.routeId,
      date: input.date,
      loadedItems: input.loadedItems || [],
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'van-sale.created',
      'v1',
      {
        vanSaleId: vanSale.id,
        agentId: vanSale.agentId,
        vehicleId: vanSale.vehicleId,
        routeId: vanSale.routeId,
        date: vanSale.date,
        loadedItems: vanSale.loadedItems.map(i => ({ ...i })),
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: vanSale.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new VanSalePgRepository(txDb);

          await txRepo.save(vanSale);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'VanSale', vanSale.id);
        }, tenantId);
        this.logger.info('Saved van sale and outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(vanSale);
      }
    } else {
      await activeRepo.save(vanSale);
    }

    // 2. Log audit event
    await recordAudit(
      principal.id,
      tenantId,
      'van_sale.created',
      `VanSale session ${vanSale.id} created`,
      {
        before: null,
        after: vanSale.toJSON(),
      }
    );

    return {
      vanSaleId: vanSale.id,
      status: vanSale.status,
    };
  }
}
