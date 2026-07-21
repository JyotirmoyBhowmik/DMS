import { CreateDistributorUseCase } from '../../../application/usecases/distributor/create-distributor.usecase.js';
import { GetDistributorUseCase } from '../../../application/usecases/distributor/get-distributor.usecase.js';
import { UpdateDistributorUseCase } from '../../../application/usecases/distributor/update-distributor.usecase.js';
import { ListDistributorsUseCase } from '../../../application/usecases/distributor/list-distributors.usecase.js';
import { DistributorPgRepository } from '../../../infrastructure/database/repositories/distributor.pg-repository.js';
import { CreateDistributorSchema, UpdateDistributorSchema, ListDistributorsSchema } from '@dms/pkg-validation';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class DistributorController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new DistributorPgRepository(this.db);
  private createUseCase = new CreateDistributorUseCase(this.db, this.repo);
  private getUseCase = new GetDistributorUseCase(this.repo);
  private updateUseCase = new UpdateDistributorUseCase(this.db, this.repo);
  private listUseCase = new ListDistributorsUseCase(this.repo);
  private logger = new StructuredLogger('DistributorController');

  static clearStore(): void {
    DistributorPgRepository.clearStore();
  }

  private buildPrincipal(headers: Record<string, string | undefined>): Principal {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const roles = headers['x-user-roles'] ? (headers['x-user-roles'] as string).split(',') : ['admin'];
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId,
      roles,
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP POST distributor request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateDistributorSchema.parse(body);
      const distributor = await this.createUseCase.execute(principal, {
        ...parsed,
        tenantId,
      });

      return {
        statusCode: 201,
        body: {
          success: true,
          distributor: distributor.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create distributor', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('already exists') || err.message.includes('Unique');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP PUT distributor request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = UpdateDistributorSchema.parse({ ...body, id });
      const distributor = await this.updateUseCase.execute(principal, {
        ...parsed,
        tenantId,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          distributor: distributor.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for update distributor', { id, error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('conflict') || err.message.includes('version') || err.message.includes('already exists');
      const isNotFound = err.message.includes('not found');

      let statusCode = 400;
      if (isForbidden) statusCode = 403;
      else if (isConflict) statusCode = 409;
      else if (isNotFound) statusCode = 404;

      return {
        statusCode,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP GET distributor request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const distributor = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          distributor: distributor.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Failed to get distributor', { id, error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isNotFound = err.message.includes('not found');

      let statusCode = 400;
      if (isForbidden) statusCode = 403;
      else if (isNotFound) statusCode = 404;

      return {
        statusCode,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP GET list distributors request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsedQuery = ListDistributorsSchema.parse(query);
      const result = await this.listUseCase.execute(principal, {
        ...parsedQuery,
        tenantId,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(d => d.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        },
      };
    } catch (err: any) {
      this.logger.warn('Failed to list distributors', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleDelete(id: string, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP DELETE distributor request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      if (!RbacGuard.can(principal, 'distributor:delete')) {
        throw new Error('Forbidden: Insufficient permissions to delete distributor');
      }
      const success = await this.repo.delete(id, tenantId);
      if (!success) {
        return {
          statusCode: 404,
          body: { success: false, error: 'Distributor not found' },
        };
      }
      return {
        statusCode: 200,
        body: { success: true },
      };
    } catch (err: any) {
      this.logger.warn('Failed to delete distributor', { id, error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }
}
