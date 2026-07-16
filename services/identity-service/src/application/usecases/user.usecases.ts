import { randomUUID } from 'node:crypto';
import { deriveFromPassphrase } from '@dms/pkg-crypto';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { User } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserPgRepository } from '../../infrastructure/database/repositories/user.pg-repository.js';

export interface CreateUserInput {
  email: string;
  password?: string;
  status?: string;
}

export interface UpdateUserInput {
  id: string;
  status?: string;
  password?: string;
}

export class CreateUserUseCase {
  private logger = new StructuredLogger('CreateUserUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly userRepo?: UserRepository
  ) {}

  async execute(tenantId: string, input: CreateUserInput): Promise<User> {
    this.logger.info('Creating user', { email: input.email, tenantId });

    const userId = randomUUID();
    const password = input.password || 'default_pass_123';
    const salt = Buffer.alloc(16, input.email);
    const derived = await deriveFromPassphrase(password, salt);
    const passwordHash = derived.toString('hex');

    const entity = new User();
    entity.id = userId;
    entity.tenantId = tenantId;
    entity.email = input.email;
    entity.passwordHash = passwordHash;
    entity.status = input.status || 'ACTIVE';
    entity.version = 1;
    entity.lastLoginAt = null;

    const repo = this.userRepo || new UserPgRepository(this.db!);

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'user.created',
      'v1',
      {
        userId,
        email: entity.email,
        status: entity.status,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'identity-service',
        partitionKey: userId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          await repo.save(entity, tenantId);

          // Save outbox event
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'User', userId);
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

export class GetUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(id: string, tenantId: string): Promise<User> {
    return this.userRepo.findById(id, tenantId);
  }
}

export class UpdateUserUseCase {
  private logger = new StructuredLogger('UpdateUserUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly userRepo?: UserRepository
  ) {}

  async execute(tenantId: string, input: UpdateUserInput): Promise<User> {
    this.logger.info('Updating user', { id: input.id, tenantId });

    const repo = this.userRepo || new UserPgRepository(this.db!);
    const entity = await repo.findById(input.id, tenantId);

    if (input.status) {
      entity.status = input.status;
    }
    if (input.password) {
      const salt = Buffer.alloc(16, entity.email);
      const derived = await deriveFromPassphrase(input.password, salt);
      entity.passwordHash = derived.toString('hex');
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'user.updated',
      'v1',
      {
        userId: entity.id,
        email: entity.email,
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
          }, 'User', entity.id);
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

export class DeleteUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(id: string, tenantId: string): Promise<boolean> {
    return this.userRepo.delete(id, tenantId);
  }
}

export class ListUsersUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(tenantId: string, options?: any): Promise<any> {
    return this.userRepo.findAll(tenantId, options);
  }
}
