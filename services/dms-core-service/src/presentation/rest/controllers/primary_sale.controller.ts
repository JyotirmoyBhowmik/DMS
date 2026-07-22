import { CreatePrimarySaleUseCase } from '../../../application/usecases/primary_sale/create-primary-sale.usecase.js';
import { GetPrimarySaleUseCase } from '../../../application/usecases/primary_sale/get-primary-sale.usecase.js';
import { UpdatePrimarySaleUseCase } from '../../../application/usecases/primary_sale/update-primary-sale.usecase.js';
import { ListPrimarySalesUseCase } from '../../../application/usecases/primary_sale/list-primary-sales.usecase.js';
import { PrimarySalePgRepository } from '../../../infrastructure/database/repositories/primary_sale.pg-repository.js';
import { CreatePrimarySaleSchema, UpdatePrimarySaleSchema, QueryPrimarySaleSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class PrimarySaleController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new PrimarySalePgRepository(this.db);
  private createUseCase = new CreatePrimarySaleUseCase(this.repo);
  private getUseCase = new GetPrimarySaleUseCase(this.repo);
  private updateUseCase = new UpdatePrimarySaleUseCase(this.repo);
  private listUseCase = new ListPrimarySalesUseCase(this.repo);
  private logger = new StructuredLogger('PrimarySaleController');

  static clearStore(): void {
    PrimarySalePgRepository.clearStore();
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
    const idempotencyKey = headers['x-idempotency-key'];
    this.logger.info('Received HTTP POST primary sale request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreatePrimarySaleSchema.parse(body);
      const sale = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          primarySale: sale.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create primary sale', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('409 Conflict') || err.message.includes('already exists');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const sale = await this.getUseCase.execute(principal, id);
      if (!sale) {
        return { statusCode: 404, body: { success: false, error: 'PrimarySale record not found' } };
      }
      return { statusCode: 200, body: { success: true, primarySale: sale.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdatePrimarySaleSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, primarySale: updated.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      const isConflict = err.message.includes('Conflict') || err.message.includes('version');
      const isNotFound = err.message.includes('not found');
      let statusCode = 400;
      if (isForbidden) statusCode = 403;
      else if (isConflict) statusCode = 409;
      else if (isNotFound) statusCode = 404;
      return { statusCode, body: { success: false, error: err.message } };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = QueryPrimarySaleSchema.parse(query);
      const result = await this.listUseCase.execute(principal, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(i => i.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
