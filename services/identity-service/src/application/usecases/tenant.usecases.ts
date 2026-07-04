import { randomUUID } from 'node:crypto';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { Tenant } from '../../domain/entities/tenant.js';
import { TenantRepository } from '../../domain/repositories/tenant.repository.js';
import { TenantPgRepository } from '../../infrastructure/database/repositories/tenant.pg-repository.js';

export interface CreateTenantInput {
  name: string;
  status?: string;
}

export interface UpdateTenantInput {
  id: string;
  name?: string;
  status?: string;
}

export class CreateTenantUseCase {
  private logger = new StructuredLogger('CreateTenantUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly tenantRepo?: TenantRepository
  ) {}

  async execute(tenantId: string, input: CreateTenantInput): Promise<Tenant> {
    this.logger.info('Creating tenant', { name: input.name, tenantId });

    const newTenantId = randomUUID();
    const entity = new Tenant();
    entity.id = newTenantId;
    entity.tenantId = newTenantId; // It is its own tenant
    entity.name = input.name;
    entity.status = input.status || 'ACTIVE';

    const repo = this.tenantRepo || new TenantPgRepository(this.db!);

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'tenant.created',
      'v1',
      {
        newTenantId,
        name: entity.name,
        status: entity.status,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'identity-service',
        partitionKey: newTenantId,
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
          }, 'Tenant', newTenantId);
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

export class GetTenantUseCase {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async execute(id: string, tenantId: string): Promise<Tenant> {
    return this.tenantRepo.findById(id, tenantId);
  }
}

export class UpdateTenantUseCase {
  private logger = new StructuredLogger('UpdateTenantUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly tenantRepo?: TenantRepository
  ) {}

  async execute(tenantId: string, input: UpdateTenantInput): Promise<Tenant> {
    this.logger.info('Updating tenant', { id: input.id, tenantId });

    const repo = this.tenantRepo || new TenantPgRepository(this.db!);
    const entity = await repo.findById(input.id, tenantId);

    if (input.name) {
      entity.name = input.name;
    }
    if (input.status) {
      entity.status = input.status;
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'tenant.updated',
      'v1',
      {
        tenantId: entity.id,
        name: entity.name,
        status: entity.status,
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
          }, 'Tenant', entity.id);
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

export class DeleteTenantUseCase {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async execute(id: string, tenantId: string): Promise<boolean> {
    return this.tenantRepo.delete(id, tenantId);
  }
}

export class ListTenantsUseCase {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async execute(tenantId: string, options?: any): Promise<any> {
    return this.tenantRepo.findAll(tenantId, options);
  }
}
