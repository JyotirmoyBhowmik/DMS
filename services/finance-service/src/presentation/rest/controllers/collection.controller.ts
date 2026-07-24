import { CreateCollectionUseCase } from '../../../application/usecases/create-collection.usecase.js';
import { GetCollectionUseCase } from '../../../application/usecases/get-collection.usecase.js';
import { UpdateCollectionUseCase } from '../../../application/usecases/update-collection.usecase.js';
import { ListCollectionsUseCase } from '../../../application/usecases/list-collections.usecase.js';
import { CollectionPgRepository } from '../../../infrastructure/database/repositories/collection.pg-repository.js';
import { Principal } from '../../../application/usecases/create-invoice.usecase.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class CollectionController {
  private logger = new StructuredLogger('CollectionController');
  private createUseCase: CreateCollectionUseCase;
  private getUseCase: GetCollectionUseCase;
  private updateUseCase: UpdateCollectionUseCase;
  private listUseCase: ListCollectionsUseCase;

  constructor(repository = new CollectionPgRepository()) {
    this.createUseCase = new CreateCollectionUseCase(repository);
    this.getUseCase = new GetCollectionUseCase(repository);
    this.updateUseCase = new UpdateCollectionUseCase(repository);
    this.listUseCase = new ListCollectionsUseCase(repository);
  }

  private buildPrincipal(headers: Record<string, string | undefined>): Principal {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const userId = headers['x-user-id'] || 'system-user-id';
    const rolesHeader = headers['x-user-roles'] || 'admin';
    const roles = rolesHeader.split(',').map(r => r.trim());

    return {
      userId,
      tenantId,
      roles,
      permissions: [
        'finance:collection:create',
        'finance:collection:read',
        'finance:collection:update',
        'finance:collection:list',
        'finance:collection:approve',
      ],
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>, idempotencyKey?: string) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      if (headers['content-type'] && !headers['content-type'].includes('application/json')) {
        return { statusCode: 415, body: { success: false, error: 'Unsupported Content-Type. Must be application/json', correlationId } };
      }

      const collection = await this.createUseCase.execute(principal, body, idempotencyKey, correlationId);
      return {
        statusCode: 201,
        body: {
          success: true,
          collection: collection.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      this.logger.error(`Create collection failed: ${err.message}`, { correlationId });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('Insufficient');
      const isConflict = err.message.includes('already exists');
      const statusCode = isForbidden ? 403 : isConflict ? 409 : 400;

      return {
        statusCode,
        body: {
          success: false,
          error: err.message,
          fields: err.fields || undefined,
          correlationId,
        },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      const collection = await this.getUseCase.execute(principal, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          collection: collection.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      const isNotFound = err.message.includes('not found');
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isNotFound ? 404 : isForbidden ? 403 : 400,
        body: { success: false, error: err.message, correlationId },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      const collection = await this.updateUseCase.execute(principal, id, body, correlationId);
      return {
        statusCode: 200,
        body: {
          success: true,
          collection: collection.toJSON(),
          correlationId,
        },
      };
    } catch (err: any) {
      const isConflict = err.message.includes('Version conflict');
      const isNotFound = err.message.includes('not found');
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isConflict ? 409 : isNotFound ? 404 : isForbidden ? 403 : 400,
        body: { success: false, error: err.message, correlationId },
      };
    }
  }

  async handleList(query: any, headers: Record<string, string | undefined>) {
    const principal = this.buildPrincipal(headers);
    const correlationId = headers['x-correlation-id'] || `corr-${Date.now()}`;

    try {
      const result = await this.listUseCase.execute(principal, query);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
          data: result.data.map(c => c.toJSON()),
          correlationId,
        },
      };
    } catch (err: any) {
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message, correlationId },
      };
    }
  }
}
