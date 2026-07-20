import { Survey } from '../../../domain/entities/survey.js';
import { SurveyRepository } from '../../../domain/repositories/survey.repository.js';
import { BusinessRuleViolationError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GetSurveyUseCase {
  constructor(
    private db: PostgresDatabaseClient | undefined,
    private repo: SurveyRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<Survey> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'survey:read')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to view survey');
    }

    const survey = await this.repo.findById(id, tenantId);
    if (!survey) {
      throw new BusinessRuleViolationError(`Survey not found for ID ${id}`);
    }

    return survey;
  }
}
