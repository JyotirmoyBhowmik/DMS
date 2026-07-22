import { CreateBatchSchema, UpdateBatchSchema, QueryBatchSchema } from '@dms/pkg-validation';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { BatchPgRepository } from '../../../infrastructure/database/repositories/batch.pg-repository.js';
import { Batch } from '../../../domain/entities/batch.js';
import { randomUUID } from 'node:crypto';

const config = loadConfigSync();

export class BatchController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new BatchPgRepository(this.db);
  private logger = new StructuredLogger('BatchController');

  static clearStore(): void {
    BatchPgRepository.clearStore();
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
    const principal = this.buildPrincipal(headers);
    if (!RbacGuard.can(principal, 'batch:create')) {
      return { statusCode: 403, body: { success: false, error: 'Forbidden: Insufficient permissions to create batch' } };
    }

    try {
      const parsed = CreateBatchSchema.parse(body);
      const batch = new Batch({
        id: randomUUID(),
        tenantId: principal.tenantId,
        productId: parsed.productId,
        batchNumber: parsed.batchNumber,
        manufacturingDate: new Date().toISOString(),
        expiryDate: parsed.expiryDate,
        quantity: parsed.quantity,
      });
      await this.repo.save(batch);

      return { statusCode: 201, body: { success: true, batch: batch.toJSON() } };
    } catch (err: any) {
      return { statusCode: 400, body: { success: false, error: err.message } };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    if (!RbacGuard.can(principal, 'batch:read') && !RbacGuard.can(principal, 'batches:read')) {
      return { statusCode: 403, body: { success: false, error: 'Forbidden' } };
    }

    const batch = await this.repo.findById(principal.tenantId, id);
    if (!batch) return { statusCode: 404, body: { success: false, error: 'Batch not found' } };
    return { statusCode: 200, body: { success: true, batch: batch.toJSON() } };
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    if (!RbacGuard.can(principal, 'batch:read') && !RbacGuard.can(principal, 'batches:read')) {
      return { statusCode: 403, body: { success: false, error: 'Forbidden' } };
    }

    try {
      const parsed = QueryBatchSchema.parse(query);
      const items = await this.repo.findAll(principal.tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          data: items.map(b => b.toJSON()),
          total: items.length,
          page: parsed.page,
          pageSize: parsed.pageSize,
        },
      };
    } catch (err: any) {
      return { statusCode: 400, body: { success: false, error: err.message } };
    }
  }
}
