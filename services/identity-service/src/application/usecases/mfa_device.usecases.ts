import { randomUUID } from 'node:crypto';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { MFADevice } from '../../domain/entities/mfa_device.js';
import { MFADeviceRepository } from '../../domain/repositories/mfa_device.repository.js';
import { MFADevicePgRepository } from '../../infrastructure/database/repositories/mfa_device.pg-repository.js';

export interface CreateMFADeviceInput {
  userId: string;
  type: string;
  secretEncrypted: string;
  isActive?: boolean;
}

export interface UpdateMFADeviceInput {
  id: string;
  isActive?: boolean;
  lastUsedAt?: Date;
}

export class CreateMFADeviceUseCase {
  private logger = new StructuredLogger('CreateMFADeviceUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly mfaRepo?: MFADeviceRepository
  ) {}

  async execute(tenantId: string, input: CreateMFADeviceInput): Promise<MFADevice> {
    this.logger.info('Creating MFA device', { userId: input.userId, type: input.type, tenantId });

    const mfaDeviceId = randomUUID();
    const entity = new MFADevice();
    entity.id = mfaDeviceId;
    entity.tenantId = tenantId;
    entity.userId = input.userId;
    entity.type = input.type;
    entity.secretEncrypted = input.secretEncrypted;
    entity.isActive = input.isActive ?? false;
    entity.lastUsedAt = null;
    entity.version = 1;

    const repo = this.mfaRepo || new MFADevicePgRepository(this.db!);

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'mfa.device.created',
      'v1',
      {
        mfaDeviceId,
        userId: entity.userId,
        type: entity.type,
        isActive: entity.isActive,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'identity-service',
        partitionKey: mfaDeviceId,
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
          }, 'MFADevice', mfaDeviceId);
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

export class GetMFADeviceUseCase {
  constructor(private readonly mfaRepo: MFADeviceRepository) {}

  async execute(id: string, tenantId: string): Promise<MFADevice> {
    return this.mfaRepo.findById(id, tenantId);
  }
}

export class UpdateMFADeviceUseCase {
  private logger = new StructuredLogger('UpdateMFADeviceUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'identity_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly mfaRepo?: MFADeviceRepository
  ) {}

  async execute(tenantId: string, input: UpdateMFADeviceInput): Promise<MFADevice> {
    this.logger.info('Updating MFA device', { id: input.id, tenantId });

    const repo = this.mfaRepo || new MFADevicePgRepository(this.db!);
    const entity = await repo.findById(input.id, tenantId);

    if (input.isActive !== undefined) {
      entity.isActive = input.isActive;
    }
    if (input.lastUsedAt !== undefined) {
      entity.lastUsedAt = input.lastUsedAt;
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'mfa.device.updated',
      'v1',
      {
        mfaDeviceId: entity.id,
        userId: entity.userId,
        isActive: entity.isActive,
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
          }, 'MFADevice', entity.id);
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

export class DeleteMFADeviceUseCase {
  constructor(private readonly mfaRepo: MFADeviceRepository) {}

  async execute(id: string, tenantId: string): Promise<boolean> {
    return this.mfaRepo.delete(id, tenantId);
  }
}

export class ListMFADevicesUseCase {
  constructor(private readonly mfaRepo: MFADeviceRepository) {}

  async execute(tenantId: string, options?: any): Promise<any> {
    return this.mfaRepo.findAll(tenantId, options);
  }
}
