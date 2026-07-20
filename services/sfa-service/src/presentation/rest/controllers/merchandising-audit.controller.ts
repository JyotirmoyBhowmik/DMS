import { CreateMerchandisingAuditUseCase } from '../../../application/usecases/merchandising-audit/create-merchandising-audit.usecase.js';
import { GetMerchandisingAuditUseCase } from '../../../application/usecases/merchandising-audit/get-merchandising-audit.usecase.js';
import { UpdateMerchandisingAuditUseCase } from '../../../application/usecases/merchandising-audit/update-merchandising-audit.usecase.js';
import { ListMerchandisingAuditsUseCase } from '../../../application/usecases/merchandising-audit/list-merchandising-audits.usecase.js';
import { MerchandisingAuditPgRepository } from '../../../infrastructure/database/repositories/merchandising-audit.pg-repository.js';
import { CreateMerchandisingAuditSchema, UpdateMerchandisingAuditSchema, ListMerchandisingAuditsQuerySchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

const config = loadConfigSync();

export class MerchandisingAuditController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new MerchandisingAuditPgRepository(this.db);
  private createUseCase = new CreateMerchandisingAuditUseCase(this.db, this.repo);
  private getUseCase = new GetMerchandisingAuditUseCase(this.db, this.repo);
  private updateUseCase = new UpdateMerchandisingAuditUseCase(this.db, this.repo);
  private listUseCase = new ListMerchandisingAuditsUseCase(this.db, this.repo);
  private logger = new StructuredLogger('MerchandisingAuditController');

  static clearStore(): void {
    MerchandisingAuditPgRepository.clearStore();
  }

  private getPrincipal(headers: Record<string, string>): Principal {
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId: headers['x-tenant-id'] || 'mock-tenant-uuid',
      roles: headers['x-user-roles'] ? headers['x-user-roles'].split(',') : ['agent'],
    };
  }

  async handleCreate(body: any, headers: Record<string, string>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Create merchandising audit request received', { tenantId, outletId: body.outletId });

    const validationResult = CreateMerchandisingAuditSchema.safeParse(body);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create merchandising audit', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const audit = await this.createUseCase.execute(principal, {
        ...validationResult.data,
        tenantId,
      });

      return {
        statusCode: 201,
        body: { success: true, audit: audit.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to create merchandising audit', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : 400;
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Get merchandising audit request received', { id, tenantId });

    try {
      const audit = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: { success: true, audit: audit.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to get merchandising audit', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : (err.message.includes('not found') ? 404 : 500);
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handlePut(id: string, body: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Update merchandising audit request received', { id, tenantId });

    const validationResult = UpdateMerchandisingAuditSchema.safeParse(body);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for update merchandising audit', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const audit = await this.updateUseCase.execute(principal, id, tenantId, validationResult.data);
      return {
        statusCode: 200,
        body: { success: true, audit: audit.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to update merchandising audit', { error: err.message });
      if (err.message.includes('Optimistic locking conflict') || err.message.includes('version mismatch')) {
        return {
          statusCode: 409,
          body: { success: false, message: err.message }
        };
      }
      const status = err.message.includes('Forbidden') ? 403 : (err.message.includes('not found') ? 404 : 500);
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleList(query: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('List merchandising audits request received', { tenantId });

    const validationResult = ListMerchandisingAuditsQuerySchema.safeParse(query);
    if (!validationResult.success) {
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const result = await this.listUseCase.execute(principal, tenantId, validationResult.data);
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map((a) => a.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        }
      };
    } catch (err: any) {
      this.logger.error('Failed to list merchandising audits', { error: err.message });
      const status = err.message.includes('Forbidden') ? 403 : 500;
      return {
        statusCode: status,
        body: { success: false, error: err.message }
      };
    }
  }

  async handleDelete(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.getPrincipal(headers);
    this.logger.info('Delete merchandising audit request received', { id, tenantId });

    if (!RbacGuard.can(principal, 'merchandising_audit:delete')) {
      return {
        statusCode: 403,
        body: { success: false, message: 'Forbidden: Insufficient permissions' }
      };
    }

    try {
      await this.repo.delete(id, tenantId);

      await recordAudit(
        principal.id,
        tenantId,
        'merchandising_audit.deleted',
        `Merchandising audit ${id} deleted`,
        {
          before: { id },
          after: null,
        }
      );

      return {
        statusCode: 200,
        body: { success: true }
      };
    } catch (err: any) {
      this.logger.error('Failed to delete merchandising audit', { error: err.message });
      return {
        statusCode: 500,
        body: { success: false, error: err.message }
      };
    }
  }
}
