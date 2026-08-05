import { Distributor } from '../../../domain/entities/distributor.js';
import { DistributorRepository } from '../../../domain/repositories/distributor.repository.js';
import { BusinessRuleViolationError, EntityNotFoundError, ConcurrencyConflictError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';
import { UpdateDistributorSchema } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export interface UpdateDistributorInput {
  id: string;
  tenantId: string;
  name?: string;
  region?: string;
  creditLimit?: number;
  version: number;
}

export class UpdateDistributorUseCase {
  constructor(
    private db: PostgresDatabaseClient | undefined,
    private repo: DistributorRepository
  ) {}

  async execute(principal: Principal, input: UpdateDistributorInput): Promise<Distributor> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== input.tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'distributor:update')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to update distributor');
    }

    // 2. Validate input schema
    const validated = UpdateDistributorSchema.parse(input);

    // Fetch existing distributor
    let existing: Distributor;
    try {
      existing = await this.repo.findById(validated.id, input.tenantId);
    } catch {
      throw new EntityNotFoundError('Distributor', validated.id);
    }

    // Verify optimistic locking version
    if (existing.version !== validated.version) {
      throw new ConcurrencyConflictError('Distributor', validated.id);
    }

    const beforeState = existing.toJSON();

    // Mutate state using domain methods
    existing.updateInfo({
      name: validated.name,
      region: validated.region,
      creditLimit: validated.creditLimit,
    });

    const isPgActive = !!this.db && typeof this.db.transaction === 'function';

    if (isPgActive) {
      try {
        await this.db!.transaction(async (conn) => {
          // Double-check unique constraint in database if name changed
          if (validated.name && validated.name.toLowerCase() !== beforeState.name.toLowerCase()) {
            const checkSql = `SELECT id FROM distributors WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3`;
            const checkRes = await conn.query(checkSql, [input.tenantId, validated.name, validated.id]);
            if (checkRes.rows && checkRes.rows.length > 0) {
              throw new BusinessRuleViolationError(`Unique constraint violation: distributor with name "${validated.name}" already exists`);
            }
          }

          // Update distributor row with version verification
          const updateSql = `
            UPDATE distributors
            SET name = $1, region = $2, credit_limit = $3, updated_at = NOW(), version = version + 1
            WHERE id = $4 AND tenant_id = $5 AND version = $6
            RETURNING *
          `;
          const updateRes = await conn.query(updateSql, [
            existing.name,
            existing.region,
            existing.creditLimit.cents,
            existing.id,
            input.tenantId,
            validated.version,
          ]);

          if (updateRes.rows.length === 0) {
            throw new ConcurrencyConflictError('Distributor', existing.id);
          }

          existing.incrementVersion();

          // Write domain event to outbox in same transaction
          const eventId = randomUUID();
          const correlationId = randomUUID();
          const eventPayload = {
            eventId,
            eventType: 'dms.distributor.updated.v1',
            tenantId: input.tenantId,
            correlationId,
            data: {
              distributorId: existing.id,
              name: existing.name,
              region: existing.region,
              creditLimit: existing.creditLimit.cents,
              version: existing.version,
            },
          };

          await conn.query(
            `INSERT INTO dms_outbox (id, event_type, payload, destination_topic, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [eventId, 'dms.distributor.updated.v1', JSON.stringify(eventPayload), 'dms-events', 'PENDING']
          );
        }, input.tenantId);
      } catch (err: any) {
        if (err instanceof BusinessRuleViolationError || err instanceof ConcurrencyConflictError || err.message.includes('Unique') || err.message.includes('Forbidden')) {
          throw err;
        }
        // Fallback to repository
        await this.repo.update(existing, input.tenantId);
      }
    } else {
      // In-memory fallback
      await this.repo.update(existing, input.tenantId);
    }

    // 3. Record Audit
    await recordAudit(
      principal.id,
      principal.tenantId,
      'distributor.update',
      'SUCCESS',
      { before: beforeState, after: existing.toJSON() }
    );

    return existing;
  }
}
