import { CreateCompetitorCaptureUseCase } from '../../../application/usecases/competitor-capture/create-competitor-capture.usecase.js';
import { GetCompetitorCaptureUseCase } from '../../../application/usecases/competitor-capture/get-competitor-capture.usecase.js';
import { UpdateCompetitorCaptureUseCase } from '../../../application/usecases/competitor-capture/update-competitor-capture.usecase.js';
import { ListCompetitorCapturesUseCase } from '../../../application/usecases/competitor-capture/list-competitor-captures.usecase.js';
import { CompetitorCapturePgRepository } from '../../../infrastructure/database/repositories/competitor-capture.pg-repository.js';
import { CreateCompetitorCaptureSchema, UpdateCompetitorCaptureSchema, ListCompetitorCapturesQuerySchema } from '@dms/pkg-validation';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

const config = loadConfigSync();

export class CompetitorCaptureController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new CompetitorCapturePgRepository(this.db);
  private createUseCase = new CreateCompetitorCaptureUseCase(this.db, this.repo);
  private getUseCase = new GetCompetitorCaptureUseCase(this.db, this.repo);
  private updateUseCase = new UpdateCompetitorCaptureUseCase(this.db, this.repo);
  private listUseCase = new ListCompetitorCapturesUseCase(this.db, this.repo);
  private logger = new StructuredLogger('CompetitorCaptureController');

  static clearStore(): void {
    CompetitorCapturePgRepository.clearStore();
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
    this.logger.info('Create competitor capture request received', { tenantId, outletId: body.outletId });

    const validationResult = CreateCompetitorCaptureSchema.safeParse(body);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create competitor capture', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const capture = await this.createUseCase.execute(principal, {
        ...validationResult.data,
        tenantId,
      });

      return {
        statusCode: 201,
        body: { success: true, capture: capture.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to create competitor capture', { error: err.message });
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
    this.logger.info('Get competitor capture request received', { id, tenantId });

    try {
      const capture = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: { success: true, capture: capture.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to get competitor capture', { error: err.message });
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
    this.logger.info('Update competitor capture request received', { id, tenantId });

    const validationResult = UpdateCompetitorCaptureSchema.safeParse(body);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for update competitor capture', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: { success: false, message: 'Bad Request', errors: validationResult.error.errors }
      };
    }

    try {
      const capture = await this.updateUseCase.execute(principal, id, tenantId, validationResult.data);
      return {
        statusCode: 200,
        body: { success: true, capture: capture.toJSON() }
      };
    } catch (err: any) {
      this.logger.error('Failed to update competitor capture', { error: err.message });
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
    this.logger.info('List competitor captures request received', { tenantId });

    const validationResult = ListCompetitorCapturesQuerySchema.safeParse(query);
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
          data: result.data.map((c) => c.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        }
      };
    } catch (err: any) {
      this.logger.error('Failed to list competitor captures', { error: err.message });
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
    this.logger.info('Delete competitor capture request received', { id, tenantId });

    if (!RbacGuard.can(principal, 'competitor_capture:delete')) {
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
        'competitor_capture.deleted',
        `Competitor capture ${id} deleted`,
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
      this.logger.error('Failed to delete competitor capture', { error: err.message });
      return {
        statusCode: 500,
        body: { success: false, error: err.message }
      };
    }
  }
}
