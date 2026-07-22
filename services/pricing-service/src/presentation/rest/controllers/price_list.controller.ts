import { CreatePriceListUseCase } from '../../../application/usecases/create-price-list.usecase.js';
import { GetPriceListUseCase } from '../../../application/usecases/get-price-list.usecase.js';
import { UpdatePriceListUseCase } from '../../../application/usecases/update-price-list.usecase.js';
import { ListPriceListsUseCase } from '../../../application/usecases/list-price-lists.usecase.js';
import { PriceListPgRepository } from '../../../infrastructure/database/repositories/price_list.pg-repository.js';
import { CreatePriceListSchema, UpdatePriceListSchema, QueryPriceListSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class PriceListController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new PriceListPgRepository(this.db);
  private createUseCase = new CreatePriceListUseCase(this.repo);
  private getUseCase = new GetPriceListUseCase(this.repo);
  private updateUseCase = new UpdatePriceListUseCase(this.repo);
  private listUseCase = new ListPriceListsUseCase(this.repo);
  private logger = new StructuredLogger('PriceListController');

  static clearStore(): void {
    PriceListPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST price list request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreatePriceListSchema.parse(body);
      const list = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          priceList: list.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create price list', { error: err.message });
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
      const list = await this.getUseCase.execute(principal, id);
      if (!list) {
        return { statusCode: 404, body: { success: false, error: 'PriceList record not found' } };
      }
      return { statusCode: 200, body: { success: true, priceList: list.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdatePriceListSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, priceList: updated.toJSON() } };
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
      const parsed = QueryPriceListSchema.parse(query);
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
