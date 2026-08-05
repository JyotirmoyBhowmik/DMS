import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { Visit } from '../../domain/entities/visit.js';
import { GeoPoint } from '../../domain/value-objects/geo-point.js';
import { JourneyPolicy } from '../../domain/policies/journey_policy.js';
import { makeEnvelope } from '@dms/pkg-events';

export interface CompleteVisitResult {
  visitId: string;
  durationMinutes: number;
  isAdherent: boolean;
  event: any;
}

export class CompleteVisitUseCase {
  private logger = new StructuredLogger('CompleteVisitUseCase');

  async execute(
    visit: Visit,
    checkoutLat: number,
    checkoutLng: number,
    outletLat: number,
    outletLng: number
  ): Promise<CompleteVisitResult> {
    this.logger.info('Completing sales agent visit', { visitId: visit.id });

    if (visit.status !== 'in_progress') {
      throw new Error(`Cannot complete a visit that is in state: ${visit.status}`);
    }

    // 1. Verify beat geofence adherence at checkout
    const agentLoc = { lat: checkoutLat, lng: checkoutLng };
    const outletLoc = { lat: outletLat, lng: outletLng };
    const isAdherent = JourneyPolicy.isBeatAdherent(agentLoc, outletLoc, 50); // 50m max radius

    if (!isAdherent) {
      this.logger.warn('Agent checkout violates geofence radius. Logging deviation warning.', { visitId: visit.id });
    }

    // 2. Perform checkout
    visit.checkOut(GeoPoint.create(checkoutLat, checkoutLng));
    const duration = visit.durationMinutes() ?? 0;

    // 3. Emit visit.completed.v1 event for outbox
    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'visit.completed',
      'v1',
      {
        visitId: visit.id,
        agentId: visit.agentId,
        outletId: visit.outletId,
        durationMinutes: duration,
        checkInTime: visit.checkInTime?.toISOString(),
        checkOutTime: visit.checkOutTime?.toISOString(),
        isGeofenceAdherent: isAdherent,
      },
      {
        tenantId: visit.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: visit.id,
        causationId: activeCtx?.causationId,
      }
    );

    this.logger.info('Visit completed successfully. Emitted visit.completed.v1 outbox event.', {
      visitId: visit.id,
      duration,
      eventId: event.eventId,
    });

    return {
      visitId: visit.id,
      durationMinutes: duration,
      isAdherent,
      event,
    };
  }
}
