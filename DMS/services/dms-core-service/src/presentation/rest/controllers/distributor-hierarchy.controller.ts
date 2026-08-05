import { GetDistributorHierarchyUseCase } from '../../../application/usecases/distributor-hierarchy/get-distributor-hierarchy.usecase.js';
import { UpdateDistributorHierarchyUseCase } from '../../../application/usecases/distributor-hierarchy/update-distributor-hierarchy.usecase.js';
import { ListDistributorHierarchiesUseCase } from '../../../application/usecases/distributor-hierarchy/list-distributor-hierarchies.usecase.js';
import { DistributorHierarchyPgRepository } from '../../../infrastructure/database/repositories/distributor-hierarchy.pg-repository.js';
import { CreateDistributorHierarchySchema, UpdateDistributorHierarchySchema, QueryDistributorHierarchySchema } from '@dms/pkg-validation';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { DistributorHierarchy } from '../../../domain/entities/distributor-hierarchy.js';
import { randomUUID } from 'node:crypto';

const config = loadConfigSync();

export class DistributorHierarchyController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new DistributorHierarchyPgRepository(this.db);
  private getUseCase = new GetDistributorHierarchyUseCase(this.repo);
  private updateUseCase = new UpdateDistributorHierarchyUseCase(this.repo);
  private listUseCase = new ListDistributorHierarchiesUseCase(this.repo);
  private logger = new StructuredLogger('DistributorHierarchyController');

  static clearStore(): void {
    DistributorHierarchyPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST distributor hierarchy request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      if (!RbacGuard.can(principal, 'distributor_hierarchy:create')) {
        return { statusCode: 403, body: { success: false, error: 'Forbidden: Insufficient permissions' } };
      }

      const parsed = CreateDistributorHierarchySchema.parse(body);
      const hierarchy = DistributorHierarchy.create({
        id: randomUUID(),
        tenantId,
        parentDistributorId: parsed.parentDistributorId,
        childDistributorId: parsed.childDistributorId,
        hierarchyLevel: parsed.hierarchyLevel as any,
        territory: parsed.territory,
        effectiveFrom: parsed.effectiveFrom,
        effectiveTo: parsed.effectiveTo,
        isActive: parsed.isActive ?? true,
      });

      await this.repo.save(hierarchy);

      return {
        statusCode: 201,
        body: {
          success: true,
          hierarchy: hierarchy.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create distributor hierarchy', { error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('already exists') || err.message.includes('Unique');
      return {
        statusCode: isForbidden ? 403 : (isConflict ? 409 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const result = await this.getUseCase.execute(principal, id);
      if (!result) {
        return { statusCode: 404, body: { success: false, error: 'DistributorHierarchy not found' } };
      }
      return { statusCode: 200, body: { success: true, hierarchy: result.toJSON() } };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    try {
      const parsed = UpdateDistributorHierarchySchema.parse(body);
      const updated = await this.updateUseCase.execute(principal, id, parsed);
      return { statusCode: 200, body: { success: true, hierarchy: updated.toJSON() } };
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
      const parsed = QueryDistributorHierarchySchema.parse(query);
      const result = await this.listUseCase.execute(principal, parsed);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(h => h.toJSON()),
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return { statusCode: isForbidden ? 403 : 400, body: { success: false, error: err.message } };
    }
  }
}
