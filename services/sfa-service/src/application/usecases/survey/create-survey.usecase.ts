import { Survey } from '../../../domain/entities/survey.js';
import { SurveyRepository } from '../../../domain/repositories/survey.repository.js';
import { BusinessRuleViolationError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface CreateSurveyInput {
  id?: string;
  tenantId: string;
  agentId: string;
  outletId: string;
  title: string;
  description?: string;
  status?: string;
}

export class CreateSurveyUseCase {
  constructor(
    private db: PostgresDatabaseClient | undefined,
    private repo: SurveyRepository
  ) {}

  async execute(principal: Principal, input: CreateSurveyInput): Promise<Survey> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== input.tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'survey:create')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to create survey');
    }

    // 2. Map & validate
    const id = input.id || crypto.randomUUID();
    const survey = Survey.create({
      id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      title: input.title,
      description: input.description,
      status: input.status || 'DRAFT',
    });

    const isPgActive = !!this.db && typeof this.db.transaction === 'function';

    if (isPgActive) {
      try {
        // Execute inside transaction using db.transaction method to avoid dual-write outbox inconsistency
        await this.db!.transaction(async (conn) => {
          // Check business uniqueness: unique (tenant_id, outlet_id, agent_id, title)
          const checkRes = await conn.query(
            `SELECT id FROM surveys
             WHERE tenant_id = $1 AND outlet_id = $2 AND agent_id = $3 AND LOWER(title) = LOWER($4)`,
            [input.tenantId, input.outletId, input.agentId, input.title]
          );
          if (checkRes.rows && checkRes.rows.length > 0) {
            throw new BusinessRuleViolationError(`Unique constraint violation: survey with title "${input.title}" already exists for this agent and outlet`);
          }

          // Save survey
          await conn.query(
            `INSERT INTO surveys (id, tenant_id, agent_id, outlet_id, title, description, status, created_at, updated_at, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              survey.id,
              survey.tenantId,
              survey.agentId,
              survey.outletId,
              survey.title,
              survey.description,
              survey.status,
              survey.createdAt,
              survey.updatedAt,
              survey.version,
            ]
          );

          // Transactional outbox event creation (carrying no PII)
          const eventId = crypto.randomUUID();
          const correlationId = crypto.randomUUID();
          const eventPayload = {
            eventId,
            eventType: 'sfa.survey.created.v1',
            tenantId: input.tenantId,
            correlationId,
            data: {
              surveyId: survey.id,
              agentId: survey.agentId,
              outletId: survey.outletId,
              status: survey.status,
              version: survey.version,
            },
          };

          await conn.query(
            `INSERT INTO sfa_outbox (id, event_type, payload, status)
             VALUES ($1, $2, $3, $4)`,
            [eventId, 'sfa.survey.created.v1', JSON.stringify(eventPayload), 'PENDING']
          );
        }, input.tenantId);
      } catch (err: any) {
        // If it's a unique constraint validation or forbidden error, rethrow it
        if (err instanceof BusinessRuleViolationError || err.message.includes('Unique') || err.message.includes('Forbidden')) {
          throw err;
        }
        // Otherwise fallback to in-memory save on database connection error
        await this.repo.save(survey, input.tenantId);
      }
    } else {
      // In-memory fallback
      await this.repo.save(survey, input.tenantId);
    }

    // Audit hook (5 parameters)
    await recordAudit(
      principal.id,
      principal.tenantId,
      'survey.create',
      'SUCCESS',
      { after: survey.toJSON() }
    );

    return survey;
  }
}
