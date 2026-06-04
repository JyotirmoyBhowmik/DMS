import { IDeliveryConfirmationRepository } from '../../../domain/repositories/delivery-confirmation.repository';
import { DeliveryConfirmation, DeliveryStatus } from '../../../domain/entities/delivery-confirmation';
import { GeoPoint } from '../../../domain/value-objects/geo-point';
import { makeEnvelope } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';

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
  constructor(
    private readonly repo: IDeliveryConfirmationRepository
  ) {}

  async execute(dto: CreateDeliveryConfirmationDTO): Promise<DeliveryConfirmation> {
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

    await this.repo.save(confirmation);

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

    // Event could be published to an outbox repo here

    return confirmation;
  }
}
