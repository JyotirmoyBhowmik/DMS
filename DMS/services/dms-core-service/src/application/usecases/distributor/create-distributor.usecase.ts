import { Distributor } from '../../../domain/entities/distributor.js';
import { DistributorRepository } from '../../../domain/repositories/distributor.repository.js';
import { BusinessRuleViolationError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';
import { CreateDistributorSchema } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export interface CreateDistributorInput {
  id?: string;
  tenantId: string;
  name: string;
  region: string;
  creditLimit: number;
}

export class CreateDistributorUseCase {
  constructor(
    private db: PostgresDatabaseClient | undefined,
    private repo: DistributorRepository
  ) {}

  async execute(principal: Principal, input: CreateDistributorInput): Promise<Distributor> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== input.tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'distributor:create')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to create distributor');
    }

    // 2. Validate input schema
    const validated = CreateDistributorSchema.parse(input);

    const id = validated.id || randomUUID();
    const distributor = Distributor.create({
      id,
      tenantId: input.tenantId,
      name: validated.name,
      region: validated.region,
      creditLimit: validated.creditLimit,
    });

    const isPgActive = !!this.db && typeof this.db.transaction === 'function';

    if (isPgActive) {
      try {
        await this.db!.transaction(async (conn) => {
          // Check uniqueness constraints before inserting
          const checkSql = `SELECT id FROM distributors WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)`;
          const checkRes = await conn.query(checkSql, [input.tenantId, validated.name]);
          if (checkRes.rows && checkRes.rows.length > 0) {
            throw new BusinessRuleViolationError(`Unique constraint violation: distributor with name "${validated.name}" already exists`);
          }

          // Insert distributor
          await conn.query(
            `INSERT INTO distributors (id, tenant_id, name, region, credit_limit, balance, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              distributor.id,
              distributor.tenantId,
              distributor.name,
              distributor.region,
              distributor.creditLimit.cents,
              distributor.balance.cents,
              distributor.version,
              distributor.createdAt,
              distributor.updatedAt,
            ]
          );

          // Write domain event to outbox in same transaction
          const eventId = randomUUID();
          const correlationId = randomUUID();
          const eventPayload = {
            eventId,
            eventType: 'dms.distributor.created.v1',
            tenantId: input.tenantId,
            correlationId,
            data: {
              distributorId: distributor.id,
              name: distributor.name,
              region: distributor.region,
              creditLimit: distributor.creditLimit.cents,
              version: distributor.version,
            },
          };

          await conn.query(
            `INSERT INTO dms_outbox (id, event_type, payload, destination_topic, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [eventId, 'dms.distributor.created.v1', JSON.stringify(eventPayload), 'dms-events', 'PENDING']
          );
        }, input.tenantId);
      } catch (err: any) {
        if (err instanceof BusinessRuleViolationError || err.message.includes('Unique') || err.message.includes('Forbidden')) {
          throw err;
        }
        // Fallback to repository
        await this.repo.save(distributor, input.tenantId);
      }
    } else {
      // In-memory fallback
      await this.repo.save(distributor, input.tenantId);
    }

    // 3. Record Audit
    await recordAudit(
      principal.id,
      principal.tenantId,
      'distributor.create',
      'SUCCESS',
      { after: distributor.toJSON() }
    );

    return distributor;
  }
}
