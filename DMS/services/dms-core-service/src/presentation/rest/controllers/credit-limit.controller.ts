import { CreateCreditLimitUseCase } from '../../../application/usecases/credit-limit/create-credit-limit.usecase.js';
import { GetCreditLimitUseCase } from '../../../application/usecases/credit-limit/get-credit-limit.usecase.js';
import { UpdateCreditLimitUseCase } from '../../../application/usecases/credit-limit/update-credit-limit.usecase.js';
import { ListCreditLimitsUseCase } from '../../../application/usecases/credit-limit/list-credit-limits.usecase.js';
import { CreditLimitPgRepository } from '../../../infrastructure/database/repositories/credit-limit.pg-repository.js';
import { CreateCreditLimitSchema, UpdateCreditLimitSchema, UtilizeCreditSchema, QueryCreditLimitSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class CreditLimitController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new CreditLimitPgRepository(this.db);
  private createUseCase = new CreateCreditLimitUseCase(this.repo);
  private getUseCase = new GetCreditLimitUseCase(this.repo);
  private updateUseCase = new UpdateCreditLimitUseCase(this.repo);
  private listUseCase = new ListCreditLimitsUseCase(this.repo);
  private logger = new StructuredLogger('CreditLimitController');

  static clearStore(): void {
    CreditLimitPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST credit limit request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateCreditLimitSchema.parse(body);
      const cl = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          creditLimit: cl.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create credit limit', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('409 Conflict') || err.message.includes('already configured');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const cl = await this.getUseCase.execute(principal, id);
      if (!cl) {
        return { statusCode: 404, body: { success: false, error: 'CreditLimit not found' } };
      }
      return { statusCode: 200, body: { success: true, creditLimit: cl.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateCreditLimitSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, creditLimit: updated.toJSON() } };
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

  async handleUtilize(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UtilizeCreditSchema.parse(body);
      const updated = await this.updateUseCase.utilize(principal, id, parsed);
      return { statusCode: 200, body: { success: true, creditLimit: updated.toJSON() } };
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
      const parsed = QueryCreditLimitSchema.parse(query);
      const result = await this.listUseCase.execute(principal, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(cl => cl.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
