import {
  CreateFieldRepUseCase,
  UpdateFieldRepUseCase,
  GetFieldRepUseCase,
  ListFieldRepsUseCase,
} from '../../../application/usecases/field-rep/field-rep.usecases.js';
import { FieldRepPgRepository } from '../../../infrastructure/database/repositories/field-rep.pg-repository.js';
import { CreateFieldRepInputSchema, UpdateFieldRepInputSchema, ListFieldRepsQuerySchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

const config = loadConfigSync();

export class FieldRepController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new FieldRepPgRepository(this.db);
  private createUseCase = new CreateFieldRepUseCase(this.db, this.repo);
  private getUseCase = new GetFieldRepUseCase(this.db, this.repo);
  private updateUseCase = new UpdateFieldRepUseCase(this.db, this.repo);
  private listUseCase = new ListFieldRepsUseCase(this.db, this.repo);
  private logger = new StructuredLogger('FieldRepController');

  static clearStore(): void {
    FieldRepPgRepository.clearStore();
  }

  private buildPrincipal(headers: Record<string, string | undefined>): Principal {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const roles = headers['x-user-roles'] ? (headers['x-user-roles'] as string).split(',') : ['agent'];
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId,
      roles,
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP POST field-rep request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateFieldRepInputSchema.parse(body);
      const rep = await this.createUseCase.execute(principal, {
        ...parsed,
        tenantId,
      });

      return {
        statusCode: 201,
        body: {
          success: true,
          fieldRep: rep.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create field-rep', { errors: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP PUT field-rep request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = UpdateFieldRepInputSchema.parse(body);
      const rep = await this.updateUseCase.execute(principal, {
        ...parsed,
        id,
        tenantId,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          fieldRep: rep.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for update field-rep', { id, error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('locking') || err.message.includes('conflict') || err.message.includes('version');
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
    this.logger.info('Received HTTP GET field-rep request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const rep = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          fieldRep: rep.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Failed to get field-rep', { id, error: err.message });
      const isForbidden = err.message.includes('Forbidden');
      const isNotFound = err.message.includes('not found');
      return {
        statusCode: isNotFound ? 404 : (isForbidden ? 403 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleList(queryParams: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP GET list field-reps request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const page = queryParams.page ? Number(queryParams.page) : undefined;
      const pageSize = queryParams.pageSize ? Number(queryParams.pageSize) : undefined;

      const parsed = ListFieldRepsQuerySchema.parse({
        ...queryParams,
        page,
        pageSize,
      });

      const result = await this.listUseCase.execute(principal, {
        ...parsed,
        tenantId,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          items: result.items.map((t) => t.toJSON()),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.warn('Failed to list field-reps', { error: err.message });
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }
}
