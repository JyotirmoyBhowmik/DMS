import { GeoCheckInPgRepository } from '../../../infrastructure/database/repositories/geo-checkin.pg-repository.js';
import { CreateGeoCheckInUseCase } from '../../../application/usecases/geo-checkin/create_geo_checkin.usecase.js';
import { GetGeoCheckInUseCase } from '../../../application/usecases/geo-checkin/get_geo_checkin.usecase.js';
import { UpdateGeoCheckInUseCase } from '../../../application/usecases/geo-checkin/update_geo_checkin.usecase.js';
import { ListGeoCheckInsUseCase } from '../../../application/usecases/geo-checkin/list_geo_checkins.usecase.js';
import { CreateGeoCheckInSchema, UpdateGeoCheckInSchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class GeoCheckInController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new GeoCheckInPgRepository(this.db);
  private createUseCase = new CreateGeoCheckInUseCase(this.db, this.repo);
  private getUseCase = new GetGeoCheckInUseCase(this.db, this.repo);
  private updateUseCase = new UpdateGeoCheckInUseCase(this.db, this.repo);
  private listUseCase = new ListGeoCheckInsUseCase(this.db, this.repo);
  private logger = new StructuredLogger('GeoCheckInController');

  static clearStore(): void {
    GeoCheckInPgRepository.clearStore();
  }

  async handlePostGeoCheckIn(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP POST geo-checkin request', { tenantId });

    const validationResult = CreateGeoCheckInSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create geo-checkin', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(tenantId, validationResult.data);
      return {
        statusCode: 201,
        body: {
          success: true,
          geoCheckInId: result.geoCheckInId,
          isWithinGeofence: result.isWithinGeofence,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create geo-checkin', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handlePutGeoCheckIn(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT geo-checkin request', { id, tenantId });

    const validationResult = UpdateGeoCheckInSchema.safeParse(requestBody);
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
      const expectedVersion = requestBody.version !== undefined ? Number(requestBody.version) : undefined;
      const result = await this.updateUseCase.execute(tenantId, id, validationResult.data, expectedVersion);
      return {
        statusCode: 200,
        body: {
          success: true,
          geoCheckInId: result.geoCheckInId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update geo-checkin', { error: err.message });
      if (err.message.includes('Conflict') || err.message.includes('version mismatch')) {
        return {
          statusCode: 409,
          body: {
            message: err.message,
          },
        };
      }
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetGeoCheckIn(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET geo-checkin request', { id, tenantId });

    try {
      const geoCheckIn = await this.getUseCase.execute(tenantId, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          geoCheckIn: geoCheckIn.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get geo-checkin', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListGeoCheckIns(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET geo-checkins list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(g => g.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list geo-checkins', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
