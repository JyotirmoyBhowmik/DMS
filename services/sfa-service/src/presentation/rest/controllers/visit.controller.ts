import { VisitRepository } from '../../../infrastructure/database/repositories/visit.repository.js';
import { Visit } from '../../../domain/entities/visit.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class VisitController {
  private repo = new VisitRepository();
  private logger = new StructuredLogger('VisitController');

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    // Seed a planned visit for agent-uuid-2222 at outlet Delhi (o-001)
    const visit = Visit.create({
      id: 'visit-1001',
      tenantId: 'tenant-uuid-1111',
      agentId: 'agent-uuid-2222',
      outletId: 'o-001',
      journeyPlanId: 'jp-2026-001',
      plannedDate: new Date()
    });
    this.repo.save(visit);
  }

  async handleCheckIn(
    visitId: string,
    lat: number,
    lng: number,
    headers: Record<string, string>
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received agent check-in request', { visitId, tenantId, lat: '[REDACTED]', lng: '[REDACTED]' });

    const visit = await this.repo.findById(visitId, tenantId);
    if (!visit) {
      return {
        status: 404,
        body: { error: 'Visit plan not found', code: 'VISIT_NOT_FOUND' }
      };
    }

    if (visit.status !== 'planned') {
      return {
        status: 400,
        body: { error: `Visit is already in state: ${visit.status}`, code: 'INVALID_VISIT_STATE' }
      };
    }

    // Geofencing verification (Delhi coordinates reference: 28.6139, 77.2090)
    // We check if the distance to Delhi center is <= 50 meters
    const refLat = 28.6139;
    const refLng = 77.2090;
    
    // Haversine formula
    const R = 6371e3;
    const phi1 = (refLat * Math.PI) / 180;
    const phi2 = (lat * Math.PI) / 180;
    const deltaPhi = ((lat - refLat) * Math.PI) / 180;
    const deltaLambda = ((lng - refLng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);
    
    const compliant = distanceMeters <= 50;

    if (!compliant) {
      this.logger.warn('GPS boundary compliance check FAILED', { visitId, distanceMeters });
      return {
        status: 400,
        body: {
          error: 'GPS check-in location is out of geofence bounds',
          code: 'GEOFENCE_VIOLATION',
          distanceMeters,
          allowedRadiusMeters: 50
        }
      };
    }

    // Perform check-in
    visit.checkIn(GeoPoint.create(lat, lng));
    await this.repo.save(visit);

    this.logger.info('GPS check-in verified COMPLIANT. Visit started.', { visitId, distanceMeters });

    return {
      status: 200,
      body: {
        success: true,
        visit: visit.toJSON(),
        distanceMeters,
        message: 'Check-in compliant. Visit status updated to in_progress.'
      }
    };
  }

  async handleCheckOut(
    visitId: string,
    lat: number,
    lng: number,
    headers: Record<string, string>
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received agent check-out request', { visitId, tenantId });

    const visit = await this.repo.findById(visitId, tenantId);
    if (!visit) {
      return {
        status: 404,
        body: { error: 'Visit not found', code: 'VISIT_NOT_FOUND' }
      };
    }

    if (visit.status !== 'in_progress') {
      return {
        status: 400,
        body: { error: 'Cannot check-out from a visit that has not started', code: 'INVALID_VISIT_STATE' }
      };
    }

    visit.checkOut(GeoPoint.create(lat, lng));
    await this.repo.save(visit);

    this.logger.info('Agent visit checked out successfully', { visitId });

    return {
      status: 200,
      body: {
        success: true,
        visit: visit.toJSON(),
        durationMinutes: visit.durationMinutes(),
        message: 'Visit completed successfully.'
      }
    };
  }
}
