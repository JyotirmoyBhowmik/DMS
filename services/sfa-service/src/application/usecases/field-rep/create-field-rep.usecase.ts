import { FieldRepRepository } from '../../../domain/repositories/field-rep.repository.js';
import { FieldRep } from '../../../domain/entities/field-rep.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { FieldRepPgRepository } from '../../../infrastructure/database/repositories/field-rep.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface CreateFieldRepDTO {
  id?: string;
  tenantId: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export class CreateFieldRepUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: FieldRepRepository
  ) {}

  async execute(principal: Principal, dto: CreateFieldRepDTO): Promise<FieldRep> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'field_rep:write') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create field representative');
    }

    const activeRepo = this.repo || new FieldRepPgRepository(this.db);

    // Business precondition: check uniqueness of employee code and user ID
    const existingCode = await activeRepo.findByEmployeeCode(dto.employeeCode, dto.tenantId);
    if (existingCode) {
      throw new Error(`A field representative with employee code ${dto.employeeCode} already exists.`);
    }

    const existingUser = await activeRepo.findByUserId(dto.userId, dto.tenantId);
    if (existingUser) {
      throw new Error(`A field representative with user ID ${dto.userId} already exists.`);
    }

    const fieldRep = FieldRep.create({
      id: dto.id || randomUUID(),
      tenantId: dto.tenantId,
      userId: dto.userId,
      employeeCode: dto.employeeCode,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      status: 'ACTIVE',
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.field_rep.created',
      'v1',
      {
        id: fieldRep.id,
        tenantId: fieldRep.tenantId,
        userId: fieldRep.userId,
        employeeCode: fieldRep.employeeCode,
        firstName: fieldRep.firstName,
        lastName: fieldRep.lastName,
        email: fieldRep.email,
        phone: fieldRep.phone,
      },
      {
        tenantId: fieldRep.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: fieldRep.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new FieldRepPgRepository(txDb);

          await txRepo.save(fieldRep, dto.tenantId);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'FieldRep', fieldRep.id);
        }, dto.tenantId);
      } catch {
        await activeRepo.save(fieldRep, dto.tenantId);
      }
    } else {
      await activeRepo.save(fieldRep, dto.tenantId);
    }

    await recordAudit(
      principal.id,
      dto.tenantId,
      'field_rep.created',
      `Field representative created: ${fieldRep.firstName} ${fieldRep.lastName} (${fieldRep.employeeCode})`,
      { before: null, after: fieldRep.toJSON() }
    );

    return fieldRep;
  }
}
