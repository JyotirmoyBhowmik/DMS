import { StructuredLogger } from '@dms/pkg-logger';
import { GeoCheckIn } from '../../../domain/entities/geo-checkin.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { GeoCheckInPgRepository } from '../../../infrastructure/database/repositories/geo-checkin.pg-repository.js';

export class GetGeoCheckInUseCase {
  private logger = new StructuredLogger('GetGeoCheckInUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: GeoCheckInPgRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<GeoCheckIn> {
    this.logger.info('Executing GetGeoCheckInUseCase', { id, tenantId });

    const activeRepo = this.repo || new GeoCheckInPgRepository(this.db);
    const checkIn = await activeRepo.findById(id, tenantId);

    if (!checkIn) {
      this.logger.warn('GeoCheckIn record not found or unauthorized', { id, tenantId });
      throw new Error(`GeoCheckIn record with ID ${id} not found or unauthorized`);
    }

    // In a real application, we would redact or project specific fields here.
    // The domain model handles serialization and filters details.
    return checkIn;
  }
}
