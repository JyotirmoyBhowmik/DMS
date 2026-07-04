import { randomUUID } from 'node:crypto';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { Permission } from '../../domain/entities/permission.js';
import { PermissionRepository } from '../../domain/repositories/permission.repository.js';
import { PermissionPgRepository } from '../../infrastructure/database/repositories/permission.pg-repository.js';

export interface CreatePermissionInput {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UpdatePermissionInput {
  id: string;
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
}

export class CreatePermissionUseCase {
  private logger = new StructuredLogger('CreatePermissionUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly permissionRepo?: PermissionRepository
  ) {}

  async execute(tenantId: string, input: CreatePermissionInput): Promise<Permission> {
    this.logger.info('Creating permission', { name: input.name, tenantId });

    const permissionId = randomUUID();
    const entity = new Permission();
    entity.id = permissionId;
    entity.tenantId = 'global';
    entity.name = input.name;
    entity.resource = input.resource;
    entity.action = input.action;
    entity.description = input.description || null;

    const repo = this.permissionRepo || new PermissionPgRepository(this.db!);

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'permission.created',
      'v1',
      {
        permissionId,
        name: entity.name,
        resource: entity.resource,
        action: entity.action,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'identity-service',
        partitionKey: permissionId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          await repo.save(entity, tenantId);
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'Permission', permissionId);
        }, tenantId);
      } catch (txErr) {
        await repo.save(entity, tenantId);
      }
    } else {
      await repo.save(entity, tenantId);
    }

    return entity;
  }
}

export class GetPermissionUseCase {
  constructor(private readonly permissionRepo: PermissionRepository) {}

  async execute(id: string, tenantId: string): Promise<Permission> {
    return this.permissionRepo.findById(id, tenantId);
  }
}

export class UpdatePermissionUseCase {
  private logger = new StructuredLogger('UpdatePermissionUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly permissionRepo?: PermissionRepository
  ) {}

  async execute(tenantId: string, input: UpdatePermissionInput): Promise<Permission> {
    this.logger.info('Updating permission', { id: input.id, tenantId });

    const repo = this.permissionRepo || new PermissionPgRepository(this.db!);
    const entity = await repo.findById(input.id, tenantId);

    if (input.name) {
      entity.name = input.name;
    }
    if (input.resource) {
      entity.resource = input.resource;
    }
    if (input.action) {
      entity.action = input.action;
    }
    if (input.description !== undefined) {
      entity.description = input.description;
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'permission.updated',
      'v1',
      {
        permissionId: entity.id,
        name: entity.name,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'identity-service',
        partitionKey: entity.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          await repo.update(entity, tenantId);
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'Permission', entity.id);
        }, tenantId);
      } catch (txErr) {
        await repo.update(entity, tenantId);
      }
    } else {
      await repo.update(entity, tenantId);
    }

    return entity;
  }
}

export class DeletePermissionUseCase {
  constructor(private readonly permissionRepo: PermissionRepository) {}

  async execute(id: string, tenantId: string): Promise<boolean> {
    return this.permissionRepo.delete(id, tenantId);
  }
}

export class ListPermissionsUseCase {
  constructor(private readonly permissionRepo: PermissionRepository) {}

  async execute(tenantId: string, options?: any): Promise<any> {
    return this.permissionRepo.findAll(tenantId, options);
  }
}
