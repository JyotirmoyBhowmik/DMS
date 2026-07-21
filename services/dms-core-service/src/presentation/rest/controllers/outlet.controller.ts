import { CreateOutletUseCase } from '../../../application/usecases/outlet/create-outlet.usecase.js';
import { GetOutletUseCase } from '../../../application/usecases/outlet/get-outlet.usecase.js';
import { UpdateOutletUseCase } from '../../../application/usecases/outlet/update-outlet.usecase.js';
import { ListOutletsUseCase } from '../../../application/usecases/outlet/list-outlets.usecase.js';
import { OutletPgRepository } from '../../../infrastructure/database/repositories/outlet.pg-repository.js';
import { CreateOutletSchema, UpdateOutletSchema, QueryOutletSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class OutletController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new OutletPgRepository(this.db);
  private createUseCase = new CreateOutletUseCase(this.repo);
  private getUseCase = new GetOutletUseCase(this.repo);
  private updateUseCase = new UpdateOutletUseCase(this.repo);
  private listUseCase = new ListOutletsUseCase(this.repo);
  private logger = new StructuredLogger('OutletController');

  static clearStore(): void {
    OutletPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST outlet request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateOutletSchema.parse(body);
      const outlet = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          outlet: outlet.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create outlet', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const outlet = await this.getUseCase.execute(principal, id);
      if (!outlet) {
        return { statusCode: 404, body: { success: false, error: 'Outlet not found' } };
      }
      return { statusCode: 200, body: { success: true, outlet: outlet.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateOutletSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, outlet: updated.toJSON() } };
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
      const parsed = QueryOutletSchema.parse(query);
      const result = await this.listUseCase.execute(principal, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(o => o.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
