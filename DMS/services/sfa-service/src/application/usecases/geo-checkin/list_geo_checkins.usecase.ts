import { StructuredLogger } from '@dms/pkg-logger';
import { GeoCheckIn } from '../../../domain/entities/geo-checkin.js';
import { GeoCheckInPgRepository } from '../../../infrastructure/database/repositories/geo-checkin.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListGeoCheckInsQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  outletId?: string;
  visitId?: string;
  spoofingDetected?: boolean;
  isWithinGeofence?: boolean;
}

export class ListGeoCheckInsUseCase {
  private logger = new StructuredLogger('ListGeoCheckInsUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: GeoCheckInPgRepository,
  ) {}

  async execute(tenantId: string, query: ListGeoCheckInsQuery): Promise<{ data: GeoCheckIn[]; page: number; pageSize: number }> {
    this.logger.info('Executing ListGeoCheckInsUseCase', { query, tenantId });

    const activeRepo = this.repo || new GeoCheckInPgRepository(this.db);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20)); // cap at 100

    let list = await activeRepo.findAll(tenantId);
    
    // Fallback if list is empty (for offline/in-memory mode)
    if (list.length === 0) {
      list = Array.from(GeoCheckInPgRepository.inMemoryDb.values()).filter(g => g.tenantId === tenantId);
    }

    // Apply filters
    if (query.agentId) {
      list = list.filter(g => g.agentId === query.agentId);
    }
    if (query.outletId) {
      list = list.filter(g => g.outletId === query.outletId);
    }
    if (query.visitId) {
      list = list.filter(g => g.visitId === query.visitId);
    }
    if (query.spoofingDetected !== undefined) {
      list = list.filter(g => g.spoofingDetected === query.spoofingDetected);
    }
    if (query.isWithinGeofence !== undefined) {
      list = list.filter(g => g.isWithinGeofence === query.isWithinGeofence);
    }

    // Pagination slicing
    const startIndex = (page - 1) * pageSize;
    const paginated = list.slice(startIndex, startIndex + pageSize);

    return {
      data: paginated,
      page,
      pageSize,
    };
  }
}
