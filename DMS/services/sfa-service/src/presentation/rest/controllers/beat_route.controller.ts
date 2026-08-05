import { CreateBeatRouteUseCase } from '../../../application/usecases/beat-route/create_beat_route.usecase.js';
import { GetBeatRouteUseCase } from '../../../application/usecases/beat-route/get_beat_route.usecase.js';
import { UpdateBeatRouteUseCase } from '../../../application/usecases/beat-route/update_beat_route.usecase.js';
import { ListBeatRoutesUseCase } from '../../../application/usecases/beat-route/list_beat_routes.usecase.js';
import { CreateBeatRouteSchema, UpdateBeatRouteSchema } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { BeatRoutePgRepository } from '../../../infrastructure/database/repositories/beat-route.pg-repository.js';

const config = loadConfigSync();

export class BeatRouteController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new BeatRoutePgRepository(this.db);
  private createUseCase = new CreateBeatRouteUseCase(this.db, this.repo);
  private getUseCase = new GetBeatRouteUseCase(this.db, this.repo);
  private updateUseCase = new UpdateBeatRouteUseCase(this.db, this.repo);
  private listUseCase = new ListBeatRoutesUseCase(this.db, this.repo);
  private logger = new StructuredLogger('BeatRouteController');

  static clearStore(): void {
    BeatRoutePgRepository.clearStore();
  }

  async handlePostBeatRoute(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP POST beat route request', { tenantId });

    const validationResult = CreateBeatRouteSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create beat route', { errors: validationResult.error.errors });
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
          beatRouteId: result.beatRouteId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create beat route', { error: err.message });
      if (err.message.includes('already exists')) {
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

  async handlePutBeatRoute(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT beat route request', { id, tenantId });

    const validationResult = UpdateBeatRouteSchema.safeParse(requestBody);
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
          beatRouteId: result.beatRouteId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update beat route', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetBeatRoute(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET beat route request', { id, tenantId });

    try {
      const route = await this.getUseCase.execute(tenantId, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          beatRoute: route.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get beat route', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListBeatRoutes(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET beat routes list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(r => r.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list beat routes', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleDeleteBeatRoute(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP DELETE beat route request', { id, tenantId });

    try {
      await this.repo.delete(id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to delete beat route', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
