import { OutletProfilePgRepository } from '../../../infrastructure/database/repositories/outlet-profile.pg-repository.js';
import { CreateOutletProfileUseCase } from '../../../application/usecases/outlet-profile/create-outlet-profile.usecase.js';
import { GetOutletProfileUseCase } from '../../../application/usecases/outlet-profile/get-outlet-profile.usecase.js';
import { UpdateOutletProfileUseCase } from '../../../application/usecases/outlet-profile/update-outlet-profile.usecase.js';
import { ListOutletProfilesUseCase } from '../../../application/usecases/outlet-profile/list-outlet-profiles.usecase.js';
import { CreateOutletProfileSchema, UpdateOutletProfileSchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class OutletProfileController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new OutletProfilePgRepository(this.db);
  private createUseCase = new CreateOutletProfileUseCase(this.db, this.repo);
  private getUseCase = new GetOutletProfileUseCase(this.db, this.repo);
  private updateUseCase = new UpdateOutletProfileUseCase(this.db, this.repo);
  private listUseCase = new ListOutletProfilesUseCase(this.db, this.repo);
  private logger = new StructuredLogger('OutletProfileController');

  static clearStore(): void {
    OutletProfilePgRepository.clearStore();
  }

  async handlePostOutletProfile(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP POST outlet-profile request', { tenantId });

    const validationResult = CreateOutletProfileSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create outlet-profile', { errors: validationResult.error.errors });
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
          outletProfileId: result.outletProfileId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create outlet-profile', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handlePutOutletProfile(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT outlet-profile request', { id, tenantId });

    const validationResult = UpdateOutletProfileSchema.safeParse(requestBody);
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
      const result = await this.updateUseCase.execute(id, tenantId, validationResult.data);
      return {
        statusCode: 200,
        body: {
          success: true,
          outletProfileId: result.id,
          status: result.status,
          version: result.version,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update outlet-profile', { error: err.message });
      if (err.message.includes('Optimistic locking conflict') || err.message.includes('version mismatch')) {
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

  async handleGetOutletProfile(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET outlet-profile request', { id, tenantId });

    try {
      const profile = await this.getUseCase.execute(id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          outletProfile: profile.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get outlet-profile', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListOutletProfiles(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET outlet-profiles list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(p => p.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list outlet-profiles', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleDeleteOutletProfile(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP DELETE outlet-profile request', { id, tenantId });

    try {
      await this.repo.delete(id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to delete outlet-profile', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
