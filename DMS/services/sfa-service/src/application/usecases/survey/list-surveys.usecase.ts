import { Survey } from '../../../domain/entities/survey.js';
import { SurveyRepository } from '../../../domain/repositories/survey.repository.js';
import { BusinessRuleViolationError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListSurveysInput {
  tenantId: string;
  agentId?: string;
  outletId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export class ListSurveysUseCase {
  constructor(
    private db: PostgresDatabaseClient | undefined,
    private repo: SurveyRepository
  ) {}

  async execute(
    principal: Principal,
    input: ListSurveysInput
  ): Promise<{ items: Survey[]; total: number; page: number; pageSize: number }> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== input.tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'surveys:read')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to view surveys');
    }

    const result = await this.repo.list(input);
    return result;
  }
}
