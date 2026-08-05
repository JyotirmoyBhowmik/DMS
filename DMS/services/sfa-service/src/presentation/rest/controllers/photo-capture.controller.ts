import { CreatePhotoCaptureUseCase } from '../../../application/usecases/photo-capture/create-photo-capture.usecase.js';
import { GetPhotoCaptureUseCase } from '../../../application/usecases/photo-capture/get-photo-capture.usecase.js';
import { UpdatePhotoCaptureUseCase } from '../../../application/usecases/photo-capture/update-photo-capture.usecase.js';
import { ListPhotoCapturesUseCase } from '../../../application/usecases/photo-capture/list-photo-captures.usecase.js';
import { PhotoCapturePgRepository } from '../../../infrastructure/database/repositories/photo-capture.pg-repository.js';
import {
  CreatePhotoCaptureSchema,
  UpdatePhotoCaptureSchema,
  ListPhotoCapturesQuerySchema,
} from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

const config = loadConfigSync();

export class PhotoCaptureController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new PhotoCapturePgRepository(this.db);
  private createUseCase = new CreatePhotoCaptureUseCase(this.db, this.repo);
  private getUseCase = new GetPhotoCaptureUseCase(this.db, this.repo);
  private updateUseCase = new UpdatePhotoCaptureUseCase(this.db, this.repo);
  private listUseCase = new ListPhotoCapturesUseCase(this.db, this.repo);
  private logger = new StructuredLogger('PhotoCaptureController');

  static clearStore(): void {
    PhotoCapturePgRepository.clearStore();
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

  async handleCreate(body: any, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: any }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreatePhotoCaptureSchema.parse({ ...body, tenantId });
      const capture = await this.createUseCase.execute(principal, { ...parsed, tenantId });
      return {
        statusCode: 201,
        body: { success: true, capture: capture.toJSON() },
      };
    } catch (err: any) {
      this.logger.error('Failed to create photo capture', { error: err.message });
      if (err.message.includes('Forbidden')) {
        return { statusCode: 403, body: { success: false, error: err.message } };
      }
      return {
        statusCode: 400,
        body: { success: false, error: err.message || 'Validation failed' },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: any }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.buildPrincipal(headers);

    try {
      const capture = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: { success: true, capture: capture.toJSON() },
      };
    } catch (err: any) {
      this.logger.error('Failed to get photo capture', { id, error: err.message });
      if (err.message.includes('Forbidden')) {
        return { statusCode: 403, body: { success: false, error: err.message } };
      }
      return {
        statusCode: 404,
        body: { success: false, error: err.message || 'Not found' },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: any }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = UpdatePhotoCaptureSchema.parse(body);
      const capture = await this.updateUseCase.execute(principal, {
        id,
        tenantId,
        ...parsed,
      });
      return {
        statusCode: 200,
        body: { success: true, capture: capture.toJSON() },
      };
    } catch (err: any) {
      this.logger.error('Failed to update photo capture', { id, error: err.message });
      if (err.message.includes('Forbidden')) {
        return { statusCode: 403, body: { success: false, error: err.message } };
      }
      if (err.message.includes('locking conflict') || err.message.includes('version mismatch')) {
        return { statusCode: 409, body: { success: false, error: err.message } };
      }
      return {
        statusCode: 400,
        body: { success: false, error: err.message || 'Validation failed' },
      };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: any }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.buildPrincipal(headers);

    try {
      const parsedQuery = ListPhotoCapturesQuerySchema.parse({
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
        agentId: query.agentId || undefined,
        outletId: query.outletId || undefined,
        status: query.status || undefined,
        tag: query.tag || undefined,
      });

      const result = await this.listUseCase.execute(principal, tenantId, parsedQuery);
      return {
        statusCode: 200,
        body: {
          success: true,
          captures: result.items.map((c) => c.toJSON()),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list photo captures', { error: err.message });
      if (err.message.includes('Forbidden')) {
        return { statusCode: 403, body: { success: false, error: err.message } };
      }
      return {
        statusCode: 400,
        body: { success: false, error: err.message || 'Bad Request' },
      };
    }
  }

  async handleDelete(id: string, headers: Record<string, string | undefined>): Promise<{ statusCode: number; body: any }> {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const principal = this.buildPrincipal(headers);

    if (!principal) {
      return { statusCode: 401, body: { success: false, error: 'Authentication required' } };
    }
    if (principal.tenantId !== tenantId) {
      return { statusCode: 403, body: { success: false, error: 'Tenant context mismatch' } };
    }
    // Delete requires photo_capture:delete, or admin wildcard '*'
    const canDelete = principal.roles.includes('admin') || principal.roles.includes('distributor'); // or check permission
    // But default-deny: let's enforce admin role for delete (like competitor capture does)
    if (!principal.roles.includes('admin')) {
      return { statusCode: 403, body: { success: false, error: 'Forbidden: Insufficient permissions to delete photo capture' } };
    }

    try {
      const capture = await this.repo.findById(id, tenantId);
      if (!capture) {
        return { statusCode: 404, body: { success: false, error: 'Not found' } };
      }

      await this.repo.delete(id, tenantId);

      await recordAudit(
        principal.id,
        tenantId,
        'photo_capture.deleted',
        `Photo capture with ID ${id} deleted`,
        { before: capture.toJSON(), after: null }
      );

      return {
        statusCode: 200,
        body: { success: true },
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: { success: false, error: err.message },
      };
    }
  }
}
