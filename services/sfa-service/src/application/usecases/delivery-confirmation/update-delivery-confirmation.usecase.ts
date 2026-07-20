import { IDeliveryConfirmationRepository } from '../../../domain/repositories/delivery-confirmation.repository.js';
import { DeliveryConfirmation, DeliveryStatus } from '../../../domain/entities/delivery-confirmation.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { DeliveryConfirmationPgRepository } from '../../../infrastructure/database/repositories/delivery-confirmation.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface UpdateDeliveryConfirmationDTO {
  status?: DeliveryStatus;
  receivedBy?: string;
  signaturePhotoUrl?: string;
  rejectionReason?: string;
  version: number;
}

export class UpdateDeliveryConfirmationUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: IDeliveryConfirmationRepository
  ) {}

  async execute(
    principal: Principal,
    id: string,
    tenantId: string,
    input: UpdateDeliveryConfirmationDTO
  ): Promise<DeliveryConfirmation> {
    // 1. Enforce RBAC + Tenant isolation
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'delivery_confirmation:update')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new DeliveryConfirmationPgRepository(this.db);
    const confirmation = await activeRepo.findById(id, tenantId);

    if (!confirmation) {
      throw new Error(`DeliveryConfirmation with ID ${id} not found`);
    }

    if (confirmation.tenantId !== tenantId) {
      throw new Error('Forbidden: access denied to this confirmation');
    }

    // 2. Optimistic locking check
    if (confirmation.version !== input.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${confirmation.version}, requested version ${input.version}`);
    }

    // Capture before state
    const beforeState = confirmation.toJSON();

    // 3. Apply state transitions via aggregate methods
    const receivedBy = input.receivedBy || confirmation.receivedBy;
    const photoUrl = input.signaturePhotoUrl || confirmation.signaturePhotoUrl;

    if (input.status) {
      if (input.status === 'FULL') {
        confirmation.confirmFullDelivery(receivedBy, photoUrl);
      } else if (input.status === 'PARTIAL') {
        confirmation.confirmPartialDelivery(receivedBy, photoUrl);
      } else if (input.status === 'REJECTED') {
        if (!input.rejectionReason) {
          throw new Error('rejectionReason is required for status REJECTED');
        }
        confirmation.rejectDelivery(input.rejectionReason, receivedBy);
      }
    } else {
      // Just updating properties without changing status
      if (confirmation.status === 'FULL') {
        confirmation.confirmFullDelivery(receivedBy, photoUrl);
      } else if (confirmation.status === 'PARTIAL') {
        confirmation.confirmPartialDelivery(receivedBy, photoUrl);
      } else if (confirmation.status === 'REJECTED') {
        confirmation.rejectDelivery(input.rejectionReason || confirmation.rejectionReason || '', receivedBy);
      }
    }

    // Increment version
    confirmation.incrementVersion();

    // Capture after state
    const afterState = confirmation.toJSON();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.delivery_confirmation.updated',
      'v1',
      {
        id: confirmation.id,
        tenantId: confirmation.tenantId,
        orderId: confirmation.orderId,
        status: confirmation.status,
        version: confirmation.version,
        deliveredAt: confirmation.deliveredAt.toISOString(),
      },
      {
        tenantId: confirmation.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: confirmation.id,
        causationId: activeCtx?.causationId,
      }
    );

    // 4. Save transactionally
    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new DeliveryConfirmationPgRepository(txDb);

          await txRepo.save(confirmation);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'DeliveryConfirmation', confirmation.id);
        }, tenantId);
      } catch (err: any) {
        await activeRepo.save(confirmation);
      }
    } else {
      await activeRepo.save(confirmation);
    }

    // 5. Log audit trail
    await recordAudit(
      principal.id,
      tenantId,
      'delivery_confirmation.updated',
      `Delivery confirmation ${confirmation.id} updated`,
      {
        before: beforeState,
        after: afterState,
      }
    );

    return confirmation;
  }
}
