import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { UpdateVanSaleInput } from '@dms/pkg-validation';
import { VanSale } from '../../../domain/entities/van-sale.js';
import { Money } from '../../../domain/value-objects/money.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { VanSalePgRepository } from '../../../infrastructure/database/repositories/van-sale.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export class UpdateVanSaleUseCase {
  private logger = new StructuredLogger('UpdateVanSaleUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VanSalePgRepository,
  ) {}

  async execute(
    principal: Principal,
    id: string,
    tenantId: string,
    input: UpdateVanSaleInput,
  ): Promise<VanSale> {
    this.logger.info('Executing UpdateVanSaleUseCase', { id, tenantId });

    // 1. Enforce RBAC + Tenant isolation
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    
    // Check if status is transitioning to closed (requires van_sale:approve)
    const requiresApprove = input.status === 'closed';
    const requiredPerm = requiresApprove ? 'van_sale:approve' : 'van_sale:update';
    if (!RbacGuard.can(principal, requiredPerm)) {
      throw new Error(`Forbidden: Insufficient permissions, missing ${requiredPerm}`);
    }

    const activeRepo = this.repo || new VanSalePgRepository(this.db);
    const vanSale = await activeRepo.findById(id, tenantId);
    if (!vanSale) {
      throw new Error(`Van sale session not found for ID ${id}`);
    }

    if (vanSale.tenantId !== tenantId) {
      throw new Error('Forbidden: access denied to this session');
    }

    // Verify optimistic locking concurrency version check
    if (vanSale.version !== input.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${vanSale.version}, requested version ${input.version}`);
    }

    // Capture before state for auditing
    const beforeState = vanSale.toJSON();

    // Apply Loaded Items if provided during loading status
    if (input.loadedItems) {
      for (const item of input.loadedItems) {
        vanSale.addLoadedItem(item);
      }
    }

    // Apply Sold Items
    if (input.soldItems) {
      for (const item of input.soldItems) {
        vanSale.recordSale(item);
      }
    }

    // Apply Returned Items
    if (input.returnedItems) {
      for (const item of input.returnedItems) {
        vanSale.recordReturn(item);
      }
    }

    // Collect Cash / Digital Payments
    if (input.cashCollected) {
      vanSale.collectCash(Money.of(input.cashCollected.amount, input.cashCollected.currency));
    }
    if (input.digitalPayments) {
      vanSale.collectDigitalPayment(Money.of(input.digitalPayments.amount, input.digitalPayments.currency));
    }

    // Handle state transitions
    if (input.status && input.status !== vanSale.status) {
      const target = input.status;
      if (target === 'in_transit') {
        vanSale.startTransit();
      } else if (target === 'selling') {
        vanSale.startSelling();
      } else if (target === 'reconciliation') {
        vanSale.startReconciliation();
      } else if (target === 'closed') {
        vanSale.close();
      } else {
        throw new Error(`Invalid status transition to: ${target}`);
      }
    }

    // Increment version
    vanSale.incrementVersion();

    // Capture after state for auditing
    const afterState = vanSale.toJSON();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'van-sale.updated',
      'v1',
      {
        vanSaleId: vanSale.id,
        status: vanSale.status,
        version: vanSale.version,
        cashCollected: vanSale.cashCollected.toJSON(),
        digitalPayments: vanSale.digitalPayments.toJSON(),
        loadedItems: vanSale.loadedItems.map(i => ({ ...i })),
        soldItems: vanSale.soldItems.map(i => ({ ...i })),
        returnedItems: vanSale.returnedItems.map(i => ({ ...i })),
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
        this.logger.info('Saved updated van sale and outbox event transactionally');
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
      'van_sale.updated',
      `VanSale session ${vanSale.id} updated to status ${vanSale.status}`,
      {
        before: beforeState,
        after: afterState,
      }
    );

    return vanSale;
  }
}
