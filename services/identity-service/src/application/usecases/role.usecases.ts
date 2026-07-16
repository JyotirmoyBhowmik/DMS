import { randomUUID } from 'node:crypto';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { Role } from '../../domain/entities/role.js';
import { RoleRepository } from '../../domain/repositories/role.repository.js';
import { RolePgRepository } from '../../infrastructure/database/repositories/role.pg-repository.js';

export interface CreateRoleInput {
  name: string;
  description?: string;
  isSystem?: boolean;
}

export interface UpdateRoleInput {
  id: string;
  name?: string;
  description?: string;
  isSystem?: boolean;
}

export class CreateRoleUseCase {
  private logger = new StructuredLogger('CreateRoleUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly roleRepo?: RoleRepository
  ) {}

  async execute(tenantId: string, input: CreateRoleInput): Promise<Role> {
    this.logger.info('Creating role', { name: input.name, tenantId });

    const roleId = randomUUID();
    const entity = new Role();
    entity.id = roleId;
    entity.tenantId = tenantId;
    entity.name = input.name;
    entity.description = input.description || null;
    entity.isSystem = input.isSystem || false;
    entity.version = 1;

    const repo = this.roleRepo || new RolePgRepository(this.db!);

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'role.created',
      'v1',
      {
        roleId,
        name: entity.name,
        isSystem: entity.isSystem,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'identity-service',
        partitionKey: roleId,
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
          }, 'Role', roleId);
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

export class GetRoleUseCase {
  constructor(private readonly roleRepo: RoleRepository) {}

  async execute(id: string, tenantId: string): Promise<Role> {
    return this.roleRepo.findById(id, tenantId);
  }
}

export class UpdateRoleUseCase {
  private logger = new StructuredLogger('UpdateRoleUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly roleRepo?: RoleRepository
  ) {}

  async execute(tenantId: string, input: UpdateRoleInput): Promise<Role> {
    this.logger.info('Updating role', { id: input.id, tenantId });

    const repo = this.roleRepo || new RolePgRepository(this.db!);
    const entity = await repo.findById(input.id, tenantId);

    if (input.name) {
      entity.name = input.name;
    }
    if (input.description !== undefined) {
      entity.description = input.description;
    }
    if (input.isSystem !== undefined) {
      entity.isSystem = input.isSystem;
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'role.updated',
      'v1',
      {
        roleId: entity.id,
        name: entity.name,
        isSystem: entity.isSystem,
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
          }, 'Role', entity.id);
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

export class DeleteRoleUseCase {
  constructor(private readonly roleRepo: RoleRepository) {}

  async execute(id: string, tenantId: string): Promise<boolean> {
    return this.roleRepo.delete(id, tenantId);
  }
}

export class ListRolesUseCase {
  constructor(private readonly roleRepo: RoleRepository) {}

  async execute(tenantId: string, options?: any): Promise<any> {
    return this.roleRepo.findAll(tenantId, options);
  }
}
