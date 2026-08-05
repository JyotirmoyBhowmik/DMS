import { OutletCensusPgRepository } from '../../../infrastructure/database/repositories/outlet-census.pg-repository.js';
import { CreateOutletCensusUseCase } from '../../../application/usecases/outlet-census/create_outlet_census.usecase.js';
import { GetOutletCensusUseCase } from '../../../application/usecases/outlet-census/get_outlet_census.usecase.js';
import { UpdateOutletCensusUseCase } from '../../../application/usecases/outlet-census/update_outlet_census.usecase.js';
import { ListOutletCensusesUseCase } from '../../../application/usecases/outlet-census/list_outlet_censuses.usecase.js';
import { CreateOutletCensusSchema, UpdateOutletCensusSchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class OutletCensusController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new OutletCensusPgRepository(this.db);
  private createUseCase = new CreateOutletCensusUseCase(this.db, this.repo);
  private getUseCase = new GetOutletCensusUseCase(this.db, this.repo);
  private updateUseCase = new UpdateOutletCensusUseCase(this.db, this.repo);
  private listUseCase = new ListOutletCensusesUseCase(this.db, this.repo);
  private logger = new StructuredLogger('OutletCensusController');

  static clearStore(): void {
    OutletCensusPgRepository.clearStore();
  }

  async handlePostOutletCensus(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP POST outlet-census request', { tenantId });

    const validationResult = CreateOutletCensusSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create outlet-census', { errors: validationResult.error.errors });
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
          outletCensusId: result.outletCensusId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create outlet-census', { error: err.message });
      if (err.message.includes('already has a draft')) {
        return {
          statusCode: 409,
          body: { message: err.message },
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

  async handlePutOutletCensus(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT outlet-census request', { id, tenantId });

    const validationResult = UpdateOutletCensusSchema.safeParse(requestBody);
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
          outletCensusId: result.outletCensusId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update outlet-census', { error: err.message });
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

  async handleGetOutletCensus(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET outlet-census request', { id, tenantId });

    try {
      const census = await this.getUseCase.execute(tenantId, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          outletCensus: census.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get outlet-census', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListOutletCensuses(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET outlet-censuses list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(c => c.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list outlet-censuses', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
