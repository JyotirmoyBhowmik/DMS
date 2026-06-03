import { VisitRepository } from '../../../infrastructure/database/repositories/visit.repository.js';
import { Visit } from '../../../domain/entities/visit.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { CompleteVisitUseCase } from '../../../application/usecases/complete_visit.usecase.js';
import { JourneyPolicy } from '../../../domain/policies/journey_policy.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class VisitController {
  private repo = new VisitRepository();
  private completeUseCase = new CompleteVisitUseCase();
  private logger = new StructuredLogger('VisitController');

  // Hardcoded outlet location for Delhi check-in geofence
  private static OUTLET_LAT = 28.6139;
  private static OUTLET_LNG = 77.2090;

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
    const agentLoc = { lat, lng };
    const outletLoc = { lat: VisitController.OUTLET_LAT, lng: VisitController.OUTLET_LNG };
    const distanceMeters = JourneyPolicy.calculateDistance(agentLoc, outletLoc);
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

    try {
      const result = await this.completeUseCase.execute(
        visit,
        lat,
        lng,
        VisitController.OUTLET_LAT,
        VisitController.OUTLET_LNG
      );
      await this.repo.save(visit);

      return {
        status: 200,
        body: {
          success: true,
          visit: visit.toJSON(),
          durationMinutes: result.durationMinutes,
          isGeofenceAdherent: result.isAdherent,
          message: 'Visit completed successfully.'
        }
      };
    } catch (err: any) {
      return {
        status: 400,
        body: { error: err.message, code: 'INVALID_VISIT_STATE' }
      };
    }
  }

  async handleSuggestReroute(
    agentLat: number,
    agentLng: number,
    headers: Record<string, string>
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received agent detour beat rerouting request', { tenantId });

    // Mock unvisited outlets
    const unvisited = [
      { id: 'o-101', name: 'Metro Retail Store Delhi West', location: { lat: 28.6250, lng: 77.2150 } },
      { id: 'o-102', name: 'Noida Grocery Outlet', location: { lat: 28.5355, lng: 77.3910 } },
      { id: 'o-103', name: 'Connaught Place Supermarket', location: { lat: 28.6304, lng: 77.2177 } },
    ];

    const agentLoc = { lat: agentLat, lng: agentLng };
    const suggestions = JourneyPolicy.suggestReroute(agentLoc, unvisited);

    return {
      status: 200,
      body: {
        agentLocation: agentLoc,
        recommendations: suggestions,
        count: suggestions.length,
      }
    };
  }
}
