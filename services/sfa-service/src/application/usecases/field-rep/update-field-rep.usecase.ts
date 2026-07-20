import { FieldRepRepository } from '../../../domain/repositories/field-rep.repository.js';
import { FieldRep, FieldRepStatus } from '../../../domain/entities/field-rep.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { FieldRepPgRepository } from '../../../infrastructure/database/repositories/field-rep.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface UpdateFieldRepDTO {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: FieldRepStatus;
  version: number;
}

export class UpdateFieldRepUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: FieldRepRepository
  ) {}

  async execute(principal: Principal, dto: UpdateFieldRepDTO): Promise<FieldRep> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'field_rep:write') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update field representative');
    }

    const activeRepo = this.repo || new FieldRepPgRepository(this.db);
    const rep = await activeRepo.findById(dto.id, dto.tenantId);

    if (!rep || rep.tenantId !== dto.tenantId) {
      throw new Error(`Field representative with ID ${dto.id} not found`);
    }

    if (rep.version !== dto.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${rep.version}, requested version ${dto.version}`);
    }

    const originalState = rep.toJSON();

    // Enforce field-level updates
    rep.updateInfo({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
    });

    // Enforce state transitions
    if (dto.status) {
      if (dto.status === 'ACTIVE') {
        rep.activate();
      } else if (dto.status === 'INACTIVE') {
        rep.deactivate();
      } else if (dto.status === 'SUSPENDED') {
        rep.suspend();
      } else if (dto.status === 'TERMINATED') {
        rep.terminate();
      }
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.field_rep.updated',
      'v1',
      {
        id: rep.id,
        tenantId: rep.tenantId,
        firstName: rep.firstName,
        lastName: rep.lastName,
        status: rep.status,
      },
      {
        tenantId: rep.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: rep.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new FieldRepPgRepository(txDb);

          await txRepo.save(rep, dto.tenantId);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'FieldRep', rep.id);
        }, dto.tenantId);
      } catch {
        await activeRepo.save(rep, dto.tenantId);
      }
    } else {
      await activeRepo.save(rep, dto.tenantId);
    }

    rep.incrementVersion();

    await recordAudit(
      principal.id,
      dto.tenantId,
      'field_rep.updated',
      `Field representative updated: ${rep.firstName} ${rep.lastName} (${rep.employeeCode})`,
      { before: originalState, after: rep.toJSON() }
    );

    return rep;
  }
}
