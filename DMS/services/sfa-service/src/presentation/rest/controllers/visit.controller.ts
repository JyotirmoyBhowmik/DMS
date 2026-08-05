import { VisitRepository } from '../../../infrastructure/database/repositories/visit.repository.js';
import { Visit } from '../../../domain/entities/visit.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { CompleteVisitUseCase } from '../../../application/usecases/complete_visit.usecase.js';
import { JourneyPolicy } from '../../../domain/policies/journey_policy.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { CreateVisitUseCase } from '../../../application/usecases/visit/create_visit.usecase.js';
import { GetVisitUseCase } from '../../../application/usecases/visit/get_visit.usecase.js';
import { UpdateVisitUseCase } from '../../../application/usecases/visit/update_visit.usecase.js';
import { ListVisitsUseCase } from '../../../application/usecases/visit/list_visits.usecase.js';
import { CreateVisitSchema, UpdateVisitSchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';

const config = loadConfigSync();

export class VisitController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new VisitRepository(this.db);
  private completeUseCase = new CompleteVisitUseCase();
  private createUseCase = new CreateVisitUseCase(this.db, this.repo);
  private getUseCase = new GetVisitUseCase(this.db, this.repo);
  private updateUseCase = new UpdateVisitUseCase(this.db, this.repo);
  private listUseCase = new ListVisitsUseCase(this.db, this.repo);
  private logger = new StructuredLogger('VisitController');

  // Dynamic outlet location for Delhi check-in geofence
  private static OUTLET_LAT = config.seeds.outletLat;
  private static OUTLET_LNG = config.seeds.outletLng;

  constructor() {
    if (config.seeds.seedMockData) {
      this.seedMockData();
    }
  }

  static clearStore(): void {
    VisitRepository.clearStore();
  }

  private seedMockData() {
    // Seed a planned visit for agent at outlet Delhi (o-001)
    const visit = Visit.create({
      id: 'visit-1001',
      tenantId: config.seeds.tenantId,
      agentId: config.seeds.agentId,
      outletId: 'o-001',
      journeyPlanId: 'jp-2026-001',
      plannedDate: new Date()
    });
    void this.repo.save(visit);
  }

  async handlePostVisit(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const agentId = headers['x-agent-id'] || 'mock-agent';
    this.logger.info('Received HTTP POST visit request', { tenantId, agentId });

    const validationResult = CreateVisitSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create visit', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(tenantId, agentId, validationResult.data);
      return {
        statusCode: 201,
        body: {
          success: true,
          visitId: result.visitId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create visit', { error: err.message });
      if (err.message.includes('already scheduled')) {
        return {
          statusCode: 409,
          body: {
            success: false,
            message: err.message,
          },
        };
      }
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handlePutVisit(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT visit request', { id, tenantId });

    const validationResult = UpdateVisitSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.updateUseCase.execute(tenantId, id, validationResult.data);
      return {
        statusCode: 200,
        body: {
          success: true,
          visitId: result.visitId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update visit', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetVisit(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET visit request', { id, tenantId });

    try {
      const visit = await this.getUseCase.execute(tenantId, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          visit: visit.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get visit', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListVisits(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET visits list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(v => v.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list visits', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleCheckIn(
    visitId: string,
    lat: number,
    lng: number,
    headers: Record<string, string>
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || config.seeds.tenantId;
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
    const tenantId = headers['x-tenant-id'] || config.seeds.tenantId;
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
    const tenantId = headers['x-tenant-id'] || config.seeds.tenantId;
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
