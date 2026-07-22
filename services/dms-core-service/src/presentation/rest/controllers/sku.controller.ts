import { CreateSkuUseCase } from '../../../application/usecases/sku/create-sku.usecase.js';
import { GetSkuUseCase } from '../../../application/usecases/sku/get-sku.usecase.js';
import { UpdateSkuUseCase } from '../../../application/usecases/sku/update-sku.usecase.js';
import { ListSkusUseCase } from '../../../application/usecases/sku/list-skus.usecase.js';
import { SkuPgRepository } from '../../../infrastructure/database/repositories/sku.pg-repository.js';
import { CreateSkuSchema, UpdateSkuSchema, QuerySkuSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class SkuController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new SkuPgRepository(this.db);
  private createUseCase = new CreateSkuUseCase(this.repo);
  private getUseCase = new GetSkuUseCase(this.repo);
  private updateUseCase = new UpdateSkuUseCase(this.repo);
  private listUseCase = new ListSkusUseCase(this.repo);
  private logger = new StructuredLogger('SkuController');

  static clearStore(): void {
    SkuPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST SKU request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateSkuSchema.parse(body);
      const skuItem = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          sku: skuItem.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create SKU', { error: err.message });
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
      const skuItem = await this.getUseCase.execute(principal, id);
      if (!skuItem) {
        return { statusCode: 404, body: { success: false, error: 'SKU not found' } };
      }
      return { statusCode: 200, body: { success: true, sku: skuItem.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateSkuSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, sku: updated.toJSON() } };
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
      const parsed = QuerySkuSchema.parse(query);
      const result = await this.listUseCase.execute(principal, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(s => s.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
