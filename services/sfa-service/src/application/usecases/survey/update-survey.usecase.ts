import { Survey } from '../../../domain/entities/survey.js';
import { SurveyRepository } from '../../../domain/repositories/survey.repository.js';
import { BusinessRuleViolationError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface UpdateSurveyInput {
  id: string;
  tenantId: string;
  title?: string;
  description?: string;
  status?: string;
  version: number;
}

export class UpdateSurveyUseCase {
  constructor(
    private db: PostgresDatabaseClient | undefined,
    private repo: SurveyRepository
  ) {}

  async execute(principal: Principal, input: UpdateSurveyInput): Promise<Survey> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== input.tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'survey:update')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to update survey');
    }

    const survey = await this.repo.findById(input.id, input.tenantId);
    if (!survey) {
      throw new BusinessRuleViolationError(`Survey not found for ID ${input.id}`);
    }

    // 2. Validate version concurrency
    if (survey.version !== input.version) {
      throw new BusinessRuleViolationError(`Optimistic locking conflict: version mismatch. Loaded version ${survey.version}, input version ${input.version}`);
    }

    const oldVal = survey.toJSON();

    // 3. Mutate details
    survey.updateInfo({
      title: input.title,
      description: input.description,
    });

    if (input.status) {
      if (input.status === 'ACTIVE') survey.activate();
      else if (input.status === 'COMPLETED') survey.complete();
      else if (input.status === 'CANCELLED') survey.cancel();
    }

    const isPgActive = !!this.db && typeof this.db.transaction === 'function';

    if (isPgActive) {
      try {
        await this.db!.transaction(async (conn) => {
          const nextVersion = survey.version + 1;
          const result = await conn.query(
            `UPDATE surveys
             SET title = $1, description = $2, status = $3, updated_at = $4, version = $5
             WHERE id = $6 AND tenant_id = $7 AND version = $8`,
            [
              survey.title,
              survey.description,
              survey.status,
              survey.updatedAt,
              nextVersion,
              survey.id,
              input.tenantId,
              survey.version,
            ]
          );

          if (result.rowCount === 0) {
            throw new BusinessRuleViolationError('Optimistic locking conflict or record missing during update');
          }

          // Transactional outbox event creation (carrying no PII)
          const eventId = crypto.randomUUID();
          const correlationId = crypto.randomUUID();
          const eventPayload = {
            eventId,
            eventType: 'sfa.survey.updated.v1',
            tenantId: input.tenantId,
            correlationId,
            data: {
              surveyId: survey.id,
              status: survey.status,
              version: nextVersion,
            },
          };

          await conn.query(
            `INSERT INTO sfa_outbox (id, event_type, payload, status)
             VALUES ($1, $2, $3, $4)`,
            [eventId, 'sfa.survey.updated.v1', JSON.stringify(eventPayload), 'PENDING']
          );
        }, input.tenantId);

        // Increment version for PG path (in-memory path does it inside repo.save)
        survey.incrementVersion();
      } catch (err: any) {
        if (err instanceof BusinessRuleViolationError || err.message.includes('conflict') || err.message.includes('locking') || err.message.includes('Forbidden')) {
          throw err;
        }
        // Fallback to in-memory save on database connection error
        await this.repo.save(survey, input.tenantId);
      }
    } else {
      // In-memory fallback (repo.save increments version of survey entity)
      await this.repo.save(survey, input.tenantId);
    }

    // Audit hook
    await recordAudit(
      principal.id,
      principal.tenantId,
      'survey.update',
      'SUCCESS',
      {
        before: oldVal,
        after: survey.toJSON(),
      }
    );

    return survey;
  }
}
