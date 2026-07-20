import { IDeliveryConfirmationRepository } from '../../../domain/repositories/delivery-confirmation.repository.js';
import { DeliveryConfirmation, DeliveryStatus } from '../../../domain/entities/delivery-confirmation.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { DeliveryConfirmationPgRepository } from '../../../infrastructure/database/repositories/delivery-confirmation.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface CreateDeliveryConfirmationDTO {
  tenantId: string;
  orderId: string;
  deliveredAt: string;
  receivedBy: string;
  signaturePhotoUrl?: string;
  gpsLocation: { latitude: number; longitude: number };
  status: DeliveryStatus;
  rejectionReason?: string;
}

export class CreateDeliveryConfirmationUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: IDeliveryConfirmationRepository
  ) {}

  async execute(principal: Principal, dto: CreateDeliveryConfirmationDTO): Promise<DeliveryConfirmation> {
    // 1. Enforce RBAC + Tenant isolation
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'delivery_confirmation:create')) {
      throw new Error('Forbidden: Insufficient permissions');
    }

    const activeRepo = this.repo || new DeliveryConfirmationPgRepository(this.db);

    // 2. Idempotency Check: search by orderId
    const existing = await activeRepo.findByOrder(dto.orderId, dto.tenantId);
    if (existing) {
      return existing;
    }

    // 3. Construct Aggregate
    const confirmation = DeliveryConfirmation.create({
      id: randomUUID(),
      tenantId: dto.tenantId,
      orderId: dto.orderId,
      deliveredAt: new Date(dto.deliveredAt),
      receivedBy: dto.receivedBy,
      signaturePhotoUrl: dto.signaturePhotoUrl,
      gpsLocation: GeoPoint.create(dto.gpsLocation.latitude, dto.gpsLocation.longitude),
      status: dto.status,
      rejectionReason: dto.rejectionReason,
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.delivery_confirmation.created',
      'v1',
      {
        id: confirmation.id,
        tenantId: confirmation.tenantId,
        orderId: confirmation.orderId,
        status: confirmation.status,
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

    // 4. Save Transactionally
    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new DeliveryConfirmationPgRepository(txDb);

          await txRepo.save(confirmation);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'DeliveryConfirmation', confirmation.id);
        }, dto.tenantId);
      } catch (err: any) {
        // Fallback to memory / basic save
        await activeRepo.save(confirmation);
      }
    } else {
      await activeRepo.save(confirmation);
    }

    // 5. Log audit trail
    await recordAudit(
      principal.id,
      dto.tenantId,
      'delivery_confirmation.created',
      `Delivery confirmation created for order ${confirmation.orderId}`,
      {
        before: null,
        after: confirmation.toJSON(),
      }
    );

    return confirmation;
  }
}
