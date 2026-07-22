import { CreateStockLedgerUseCase } from '../../../application/usecases/stock_ledger/create-stock-ledger.usecase.js';
import { GetStockLedgerUseCase } from '../../../application/usecases/stock_ledger/get-stock-ledger.usecase.js';
import { UpdateStockLedgerUseCase } from '../../../application/usecases/stock_ledger/update-stock-ledger.usecase.js';
import { ListStockLedgersUseCase } from '../../../application/usecases/stock_ledger/list-stock-ledgers.usecase.js';
import { StockLedgerPgRepository } from '../../../infrastructure/database/repositories/stock_ledger.pg-repository.js';
import { CreateStockLedgerSchema, UpdateStockLedgerSchema, QueryStockLedgerSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class StockLedgerController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new StockLedgerPgRepository(this.db);
  private createUseCase = new CreateStockLedgerUseCase(this.repo);
  private getUseCase = new GetStockLedgerUseCase(this.repo);
  private updateUseCase = new UpdateStockLedgerUseCase(this.repo);
  private listUseCase = new ListStockLedgersUseCase(this.repo);
  private logger = new StructuredLogger('StockLedgerController');

  static clearStore(): void {
    StockLedgerPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST stock ledger request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateStockLedgerSchema.parse(body);
      const entry = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          stockLedger: entry.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create stock ledger', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('409 Conflict');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const entry = await this.getUseCase.execute(principal, id);
      if (!entry) {
        return { statusCode: 404, body: { success: false, error: 'StockLedger entry not found' } };
      }
      return { statusCode: 200, body: { success: true, stockLedger: entry.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateStockLedgerSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, stockLedger: updated.toJSON() } };
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
      const parsed = QueryStockLedgerSchema.parse(query);
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
