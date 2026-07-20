import { VanSalePgRepository } from '../../../infrastructure/database/repositories/van-sale.pg-repository.js';
import { CreateVanSaleUseCase } from '../../../application/usecases/van-sale/create-van-sale.usecase.js';
import { GetVanSaleUseCase } from '../../../application/usecases/van-sale/get-van-sale.usecase.js';
import { UpdateVanSaleUseCase } from '../../../application/usecases/van-sale/update-van-sale.usecase.js';
import { ListVanSalesUseCase } from '../../../application/usecases/van-sale/list-van-sales.usecase.js';
import { CreateVanSaleSchema, UpdateVanSaleSchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

const config = loadConfigSync();

export class VanSaleController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new VanSalePgRepository(this.db);
  private createUseCase = new CreateVanSaleUseCase(this.db, this.repo);
  private getUseCase = new GetVanSaleUseCase(this.db, this.repo);
  private updateUseCase = new UpdateVanSaleUseCase(this.db, this.repo);
  private listUseCase = new ListVanSalesUseCase(this.db, this.repo);
  private logger = new StructuredLogger('VanSaleController');

  static clearStore(): void {
    VanSalePgRepository.clearStore();
  }

  private getPrincipal(headers: Record<string, string>): Principal {
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId: headers['x-tenant-id'] || 'mock-tenant-uuid',
      roles: headers['x-user-roles'] ? headers['x-user-roles'].split(',') : ['agent'],
    };
  }

  async handlePostVanSale(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const principal = this.getPrincipal(headers);
    this.logger.info('Received HTTP POST van-sale request', { tenantId });

    const validationResult = CreateVanSaleSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create van-sale', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(principal, tenantId, validationResult.data);
      return {
        statusCode: 201,
        body: {
          success: true,
          vanSaleId: result.vanSaleId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create van-sale', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : (err.message.includes('already has') ? 409 : 500);
      return {
        statusCode: status,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handlePutVanSale(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const principal = this.getPrincipal(headers);
    this.logger.info('Received HTTP PUT van-sale request', { id, tenantId });

    const validationResult = UpdateVanSaleSchema.safeParse(requestBody);
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
      const result = await this.updateUseCase.execute(principal, id, tenantId, validationResult.data);
      return {
        statusCode: 200,
        body: {
          success: true,
          vanSaleId: result.id,
          status: result.status,
          version: result.version,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update van-sale', { error: err.message });
      if (err.message.includes('Optimistic locking conflict') || err.message.includes('version mismatch')) {
        return {
          statusCode: 409,
          body: {
            message: err.message,
          },
        };
      }
      const status = err.message.includes('Forbidden') ? 403 : (err.message.includes('not found') ? 404 : 500);
      return {
        statusCode: status,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetVanSale(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const principal = this.getPrincipal(headers);
    this.logger.info('Received HTTP GET van-sale request', { id, tenantId });

    try {
      const vanSale = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          vanSale: vanSale.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get van-sale', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : (err.message.includes('not found') ? 404 : 500);
      return {
        statusCode: status,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListVanSales(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const principal = this.getPrincipal(headers);
    this.logger.info('Received HTTP GET van-sales list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(principal, tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(v => v.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list van-sales', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : 500;
      return {
        statusCode: status,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleDeleteVanSale(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const principal = this.getPrincipal(headers);
    this.logger.info('Received HTTP DELETE van-sale request', { id, tenantId });

    if (!RbacGuard.can(principal, 'van_sale:delete')) {
      return {
        statusCode: 403,
        body: {
          message: 'Forbidden: Insufficient permissions',
        },
      };
    }

    try {
      await this.repo.delete(id, tenantId);

      // Log deletion audit
      await recordAudit(
        principal.id,
        tenantId,
        'van_sale.deleted',
        `VanSale session ${id} deleted`,
        {
          before: { id },
          after: null,
        }
      );

      return {
        statusCode: 200,
        body: {
          success: true,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to delete van-sale', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
