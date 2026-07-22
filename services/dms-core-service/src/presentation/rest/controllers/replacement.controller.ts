import { CreateReplacementUseCase } from '../../../application/usecases/replacement/create-replacement.usecase.js';
import { GetReplacementUseCase } from '../../../application/usecases/replacement/get-replacement.usecase.js';
import { UpdateReplacementUseCase } from '../../../application/usecases/replacement/update-replacement.usecase.js';
import { ListReplacementsUseCase } from '../../../application/usecases/replacement/list-replacements.usecase.js';
import { ReplacementPgRepository } from '../../../infrastructure/database/repositories/replacement.pg-repository.js';
import { CreateReplacementSchema, UpdateReplacementSchema, QueryReplacementSchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class ReplacementController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new ReplacementPgRepository(this.db);
  private createUseCase = new CreateReplacementUseCase(this.repo);
  private getUseCase = new GetReplacementUseCase(this.repo);
  private updateUseCase = new UpdateReplacementUseCase(this.repo);
  private listUseCase = new ListReplacementsUseCase(this.repo);
  private logger = new StructuredLogger('ReplacementController');

  static clearStore(): void {
    ReplacementPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST replacement request', { tenantId, idempotencyKey });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateReplacementSchema.parse(body);
      const rep = await this.createUseCase.execute(principal, parsed, idempotencyKey);

      return {
        statusCode: 201,
        body: {
          success: true,
          replacement: rep.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create replacement', { error: err.message });
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
      const rep = await this.getUseCase.execute(principal, id);
      if (!rep) {
        return { statusCode: 404, body: { success: false, error: 'Replacement record not found' } };
      }
      return { statusCode: 200, body: { success: true, replacement: rep.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateReplacementSchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, replacement: updated.toJSON() } };
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
      const parsed = QueryReplacementSchema.parse(query);
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
